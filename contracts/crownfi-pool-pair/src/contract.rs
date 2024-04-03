use bytemuck::Zeroable;
use cosmwasm_std::{coin, Addr, BankMsg, Decimal, DepsMut, Env, Fraction, MessageInfo, Response, Uint128};
use crownfi_cw_common::storage::item::StoredItem;
use crownfi_swaps_common::{data_types::pair_id::{CanonicalPoolPairIdentifier, PoolPairIdentifier}, error::CrownfiSwapsCommonError, validation::msg::{self, must_pay_non_zero, must_pay_one_of_pair, must_pay_pair, two_coins}};
use cw2::set_contract_version;
use cw_utils::{must_pay, nonpayable, PaymentError};
use sei_cosmwasm::{SeiMsg, SeiQueryWrapper};

use crate::{attributes::{attr_provide_liquidity, attr_swap, attr_withdraw_liquidity}, error::PoolPairContractError, msg::{PoolPairExecuteMsg, PoolPairInstantiateMsg}, state::{PoolPairConfig, PoolPairConfigFlags}, workarounds::{burn_token_workaround, mint_to_workaround, total_supply_workaround}};

use self::{pool::{balances_into_share_value, calc_shares_to_mint, calc_swap, get_pool_balance, DEFAULT_SLIPPAGE, MAX_ALLOWED_TOLERANCE}, shares::{lp_denom, LP_SUBDENOM}};

pub mod shares;
pub mod pool;

const CONTRACT_NAME: &str = "crownfi-pool-pair-contract";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
#[inline]
pub fn instantiate(
	deps: DepsMut<SeiQueryWrapper>,
	env: Env,
	msg_info: MessageInfo,
	msg: PoolPairInstantiateMsg,
) -> Result<Response<SeiMsg>, PoolPairContractError> {
	let [left_coin, right_coin] = two_coins(&msg_info)?;
	must_pay_non_zero(&msg_info)?; // TODO: Is this needed?
	
	PoolPairConfig::try_from(&msg.config)?.save(deps.storage)?;
	let new_denom = lp_denom(&env);
	
	let pool_id = PoolPairIdentifier {
		left: left_coin.denom.clone(),
		right: right_coin.denom.clone()
	};
	pool_id
		.as_canonical()
		.expect("incoming coins should already be canonical")
		.save(deps.storage)?;

	set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
	let mint_amount = calc_shares_to_mint(
		Uint128::zero(),
		&[Uint128::zero(), Uint128::zero()],
		&[left_coin.amount, right_coin.amount],
		Decimal::percent(1) // This value is not considered in initial mints anyway
	)?;
	Ok(
		mint_to_workaround(
			Response::new()
				.add_message(
					SeiMsg::CreateDenom {
						subdenom: LP_SUBDENOM.to_string()
					}
				),
			deps.storage,
			&msg.shares_receiver,
			coin(mint_amount.u128(), new_denom)
		)?
	)
}


#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
pub fn execute(
    deps: DepsMut<SeiQueryWrapper>,
    env: Env,
    info: MessageInfo,
    msg: PoolPairExecuteMsg,
) -> Result<Response<SeiMsg>, PoolPairContractError> {
	match msg {
		PoolPairExecuteMsg::UpdateConfig {
			admin,
			fee_receiver,
			total_fee_bps,
			maker_fee_bps,
			endorsed
		} => {
			process_update_config(
				deps,
				info,
				admin,
				fee_receiver,
				total_fee_bps,
				maker_fee_bps,
				endorsed
			)
		},
		PoolPairExecuteMsg::ProvideLiquidity {
			slippage_tolerance,
			receiver
		} => {
			process_provide_liquidity(
				deps,
				env,
				info,
				slippage_tolerance,
				receiver
			)
		},
		PoolPairExecuteMsg::WithdrawLiquidity { receiver } => {
			process_withdraw_liquidity(
				deps,
				env,
				info,
				receiver
			)
		},
		PoolPairExecuteMsg::Swap {
			expected_result,
			slippage_tolerance,
			receiver
		} => {
			process_swap(
				deps,
				env,
				info,
				expected_result,
				slippage_tolerance,
				receiver
			)
		},
	}
}

fn process_update_config(
	deps: DepsMut<impl cosmwasm_std::CustomQuery>,
	msg_info: MessageInfo,
	admin: Option<Addr>,
	fee_receiver: Option<Addr>,
	total_fee_bps: Option<u16>,
	maker_fee_bps: Option<u16>,
	endorsed: Option<bool>
) -> Result<Response<SeiMsg>, PoolPairContractError> {
	nonpayable(&msg_info)?;
	let mut config = PoolPairConfig::load_non_empty(deps.storage)?;
	if config.admin != msg_info.sender.try_into()? {
		return Err(
			CrownfiSwapsCommonError::Unauthorized("Sender is not the currently configured admin".into()).into()
		);
	}
	if let Some(admin) = admin {
		config.admin = admin.try_into()?;
	}
	if let Some(fee_receiver) = fee_receiver {
		config.fee_receiver = fee_receiver.try_into()?;
	}
	if let Some(total_fee_bps) = total_fee_bps {
		config.total_fee_bps = total_fee_bps;
	}
	if let Some(maker_fee_bps) = maker_fee_bps {
		config.maker_fee_bps = maker_fee_bps;
	}
	if let Some(endorsed) = endorsed {
		if endorsed {
			config.flags |= PoolPairConfigFlags::ENDORSED;
		} else {
			config.flags &= !PoolPairConfigFlags::ENDORSED;
		}
	}
	config.save(deps.storage)?;
	Ok(Response::new().add_attribute("action", "update_config"))
}

pub fn process_provide_liquidity(
	deps: DepsMut<SeiQueryWrapper>,
	env: Env,
	msg_info: MessageInfo,
	slippage_tolerance: Option<Decimal>,
	receiver: Option<Addr>,
) -> Result<Response<SeiMsg>, PoolPairContractError> {
	let slippage_tolerance = slippage_tolerance.unwrap_or(DEFAULT_SLIPPAGE);
	if slippage_tolerance > MAX_ALLOWED_TOLERANCE {
		return Err(PoolPairContractError::ToleranceTooHigh);
	}
	let receiver = receiver.unwrap_or(msg_info.sender.clone());
	let pool_id = CanonicalPoolPairIdentifier::load_non_empty(deps.storage)?;
	let pool_lp_denom = lp_denom(&env);

	// The balance has been added before this function is called.
	let current_balances = get_pool_balance(&deps.querier, &env, &pool_id)?;
	let incoming_assets = must_pay_pair(&msg_info, &pool_id)?;

	let mint_amount = calc_shares_to_mint(
		total_supply_workaround(deps.storage, &pool_lp_denom),
		&[
			current_balances[0].amount - incoming_assets[0].amount,
			current_balances[1].amount - incoming_assets[1].amount
		],
		&[incoming_assets[0].amount, incoming_assets[1].amount],
		slippage_tolerance
	)?;
	Ok(
		mint_to_workaround(
			Response::new(),
			deps.storage,
			&receiver,
			coin(mint_amount.u128(), pool_lp_denom)
		)?.add_attributes(
			attr_provide_liquidity(
				msg_info.sender.clone(),
				receiver,
				incoming_assets,
				mint_amount
			)
		)
	)
}

pub fn process_withdraw_liquidity(
	deps: DepsMut<SeiQueryWrapper>,
	env: Env,
	msg_info: MessageInfo,
	receiver: Option<Addr>,
) -> Result<Response<SeiMsg>, PoolPairContractError> {
	let receiver = receiver.unwrap_or(msg_info.sender.clone());
	let pool_id = CanonicalPoolPairIdentifier::load_non_empty(deps.storage)?;
	let pool_lp_denom = lp_denom(&env);
	
	let withdrawn_share_amount = must_pay(&msg_info, &pool_lp_denom)?;
	let total_share_supply = total_supply_workaround(deps.storage, &pool_lp_denom);

	// The balance has been added before this function is called.
	let refund_assets = balances_into_share_value(
		withdrawn_share_amount,
		total_share_supply,
		get_pool_balance(&deps.querier, &env, &pool_id)?
	);
	
	Ok(
		burn_token_workaround(
			Response::new(),
			deps.storage,
			msg_info.funds[0].clone()
		)?.add_attributes(
			attr_withdraw_liquidity(
				msg_info.sender,
				receiver.clone(),
				withdrawn_share_amount,
				[&refund_assets[0], &refund_assets[1]]
			)
		).add_message(
			BankMsg::Send {
				to_address: receiver.into_string(),
				amount: refund_assets.into()
			}
		)
	)
}


pub fn process_swap(
	deps: DepsMut<SeiQueryWrapper>,
	env: Env,
	msg_info: MessageInfo,
	expected_result: Option<Uint128>,
	slippage_tolerance: Option<Decimal>,
	receiver: Option<Addr>,
) -> Result<Response<SeiMsg>, PoolPairContractError> {
	let slippage_tolerance = slippage_tolerance.unwrap_or(DEFAULT_SLIPPAGE);
	if slippage_tolerance > MAX_ALLOWED_TOLERANCE {
		return Err(PoolPairContractError::ToleranceTooHigh);
	}
	let receiver = receiver.unwrap_or(msg_info.sender.clone());
	let pool_id = CanonicalPoolPairIdentifier::load_non_empty(deps.storage)?;
	let pool_config = PoolPairConfig::load_non_empty(deps.storage)?;
	let payment = must_pay_one_of_pair(&msg_info, &pool_id)?;

	let mut pool_balances = get_pool_balance(&deps.querier, &env, &pool_id)?;
	// The exchange calculations must be done from when before the funds where recieved.
	pool_balances[payment.inverse as usize].amount -= payment.amount;

	let swap_result = calc_swap(
		&pool_balances.map(|coin| {coin.amount}),
		payment.amount,
		pool_config.total_fee_bps,
		if pool_config.fee_receiver == Zeroable::zeroed() {
			0
		} else {
			pool_config.maker_fee_bps
		},
		payment.inverse,
		expected_result,
		slippage_tolerance
	)?;

	let out_coin = coin(swap_result.result_amount.u128(), pool_id.denom(!payment.inverse));

	let response = if swap_result.maker_fee_amount.is_zero() {
		Response::new()
	} else {
		// Because a function that takes `&mut self` and returns `&mut self` is too 5head apparently
		Response::new().add_message(
			BankMsg::Send {
				to_address: receiver.clone().into_string(),
				amount: vec![
					coin(swap_result.maker_fee_amount.u128(), pool_id.denom(!payment.inverse))
				]
			}
		)
	};
    Ok(
		response.add_attributes(
			attr_swap(
				msg_info.sender,
				receiver.clone(),
				&msg_info.funds[0],
				&out_coin,
				swap_result.spread_amount,
				swap_result.total_fee_amount,
				swap_result.maker_fee_amount
			)
		).add_message(
			BankMsg::Send {
				to_address: receiver.into_string(),
				amount: vec![out_coin]
			}
		)
	)
}
