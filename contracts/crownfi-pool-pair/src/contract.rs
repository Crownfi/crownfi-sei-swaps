use std::num::NonZeroU8;

use bytemuck::Zeroable;
use cosmwasm_std::{
	coin, to_json_binary, Addr, BankMsg, Binary, CosmosMsg, Decimal, Deps, DepsMut, Env, MessageInfo, Response,
	Uint128, WasmMsg,
};
use crownfi_cw_common::storage::item::StoredItem;
use crownfi_swaps_common::{
	data_types::pair_id::{CanonicalPoolPairIdentifier, PoolPairIdentifier},
	error::CrownfiSwapsCommonError,
	validation::msg::{must_pay_one_of_pair, must_pay_pair, two_coins},
};
use cw2::set_contract_version;
use cw_utils::{must_pay, nonpayable, PaymentError};
use sei_cosmwasm::{SeiMsg, SeiQueryWrapper};

use crate::{
	attributes::{attr_provide_liquidity, attr_swap, attr_withdraw_and_split_liquidity, attr_withdraw_liquidity},
	error::PoolPairContractError,
	msg::{PoolPairExecuteMsg, PoolPairInstantiateMsg, PoolPairQueryMsg, PoolPairQuerySimulateDepositResponse},
	state::{PoolPairConfig, PoolPairConfigFlags, PoolPairConfigJsonable, VolumeStatisticsCounter},
	workarounds::{burn_token_workaround, mint_workaround, total_supply_workaround},
};

use self::{
	pool::{
		balances_into_share_value, calc_naive_swap, calc_shares_to_mint, calc_swap, get_pool_balance, DEFAULT_SLIPPAGE,
		MAX_ALLOWED_TOLERANCE,
	},
	shares::{lp_denom, LP_SUBDENOM},
};

pub mod pool;
pub mod shares;

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

	PoolPairConfig::try_from(&msg.config)?.save()?;
	let new_denom = lp_denom(&env);

	let pool_id = PoolPairIdentifier {
		left: left_coin.denom.clone(),
		right: right_coin.denom.clone(),
	};
	pool_id
		.as_canonical()
		.expect("incoming coins should already be canonical")
		.save()?;

	set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
	let mint_amount = calc_shares_to_mint(
		Uint128::zero(),
		&[Uint128::zero(), Uint128::zero()],
		&[left_coin.amount, right_coin.amount],
		Decimal::percent(1), // This value is not considered in initial mints anyway
	)?;
	Ok(mint_workaround(
		Response::new().add_message(SeiMsg::CreateDenom {
			subdenom: LP_SUBDENOM.to_string(),
		}),
		coin(mint_amount.u128(), new_denom.clone()),
	)?
	.add_message(BankMsg::Send {
		to_address: msg.shares_receiver.into_string(),
		amount: vec![coin(mint_amount.u128(), new_denom)],
	}))
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
			endorsed,
		} => process_update_config(deps, info, admin, fee_receiver, total_fee_bps, maker_fee_bps, endorsed),
		PoolPairExecuteMsg::ProvideLiquidity {
			slippage_tolerance,
			receiver,
			receiver_payload,
		} => process_provide_liquidity(deps, env, info, slippage_tolerance, receiver, receiver_payload),
		PoolPairExecuteMsg::WithdrawLiquidity {
			receiver,
			receiver_payload,
		} => process_withdraw_liquidity(deps, env, info, receiver, receiver_payload),
		PoolPairExecuteMsg::WithdrawAndSplitLiquidity {
			left_coin_receiver,
			left_coin_receiver_payload,
			right_coin_receiver,
			right_coin_receiver_payload,
		} => process_withdraw_and_split_liquidity(
			deps,
			env,
			info,
			left_coin_receiver,
			left_coin_receiver_payload,
			right_coin_receiver,
			right_coin_receiver_payload,
		),
		PoolPairExecuteMsg::Swap {
			expected_result,
			slippage_tolerance,
			receiver,
			receiver_payload,
		} => process_swap(
			deps,
			env,
			info,
			expected_result,
			slippage_tolerance,
			receiver,
			receiver_payload,
		),
	}
}

fn process_update_config(
	_deps: DepsMut<SeiQueryWrapper>,
	msg_info: MessageInfo,
	admin: Option<Addr>,
	fee_receiver: Option<Addr>,
	total_fee_bps: Option<u16>,
	maker_fee_bps: Option<u16>,
	endorsed: Option<bool>,
) -> Result<Response<SeiMsg>, PoolPairContractError> {
	nonpayable(&msg_info)?;
	let mut config = PoolPairConfig::load_non_empty()?;
	if config.admin != msg_info.sender.try_into()? {
		return Err(
			CrownfiSwapsCommonError::Unauthorized("Sender is not the currently configured admin".into()).into(),
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
	config.save()?;
	Ok(Response::new().add_attribute("action", "update_config"))
}

pub fn process_provide_liquidity(
	deps: DepsMut<SeiQueryWrapper>,
	env: Env,
	msg_info: MessageInfo,
	slippage_tolerance: Option<Decimal>,
	receiver: Option<Addr>,
	receiver_payload: Option<Binary>,
) -> Result<Response<SeiMsg>, PoolPairContractError> {
	let slippage_tolerance = slippage_tolerance.unwrap_or(DEFAULT_SLIPPAGE);
	if slippage_tolerance > MAX_ALLOWED_TOLERANCE {
		return Err(PoolPairContractError::ToleranceTooHigh);
	}
	let receiver = receiver.unwrap_or(msg_info.sender.clone());
	let pool_id = CanonicalPoolPairIdentifier::load_non_empty()?;
	let pool_lp_denom = lp_denom(&env);

	// The balance has been added before this function is called.
	let current_balances = get_pool_balance(&deps.querier, &env, &pool_id)?;
	let incoming_assets = must_pay_pair(&msg_info, &pool_id)?;

	let mint_amount = calc_shares_to_mint(
		total_supply_workaround(&pool_lp_denom),
		&[
			current_balances[0].amount - incoming_assets[0].amount,
			current_balances[1].amount - incoming_assets[1].amount,
		],
		&[incoming_assets[0].amount, incoming_assets[1].amount],
		slippage_tolerance,
	)?;
	if mint_amount.is_zero() {
		return Err(CrownfiSwapsCommonError::PayoutIsZero.into());
	}
	Ok(mint_workaround(
		Response::new(),
		coin(mint_amount.u128(), pool_lp_denom.clone()),
	)?
	.add_attributes(attr_provide_liquidity(
		msg_info.sender.clone(),
		receiver.clone(),
		incoming_assets,
		mint_amount,
	))
	.add_message(if let Some(receiver_payload) = receiver_payload {
		CosmosMsg::from(WasmMsg::Execute {
			contract_addr: receiver.into_string(),
			msg: receiver_payload,
			funds: vec![coin(mint_amount.u128(), pool_lp_denom)],
		})
	} else {
		CosmosMsg::from(BankMsg::Send {
			to_address: receiver.into_string(),
			amount: vec![coin(mint_amount.u128(), pool_lp_denom)],
		})
	}))
}

pub fn process_withdraw_liquidity(
	deps: DepsMut<SeiQueryWrapper>,
	env: Env,
	msg_info: MessageInfo,
	receiver: Option<Addr>,
	receiver_payload: Option<Binary>,
) -> Result<Response<SeiMsg>, PoolPairContractError> {
	let receiver = receiver.unwrap_or(msg_info.sender.clone());
	let pool_id = CanonicalPoolPairIdentifier::load_non_empty()?;
	let pool_lp_denom = lp_denom(&env);

	let withdrawn_share_amount = must_pay(&msg_info, &pool_lp_denom)?;
	let total_share_supply = total_supply_workaround(&pool_lp_denom);

	// The balance has been added before this function is called.
	let refund_assets = balances_into_share_value(
		withdrawn_share_amount,
		total_share_supply,
		get_pool_balance(&deps.querier, &env, &pool_id)?,
	);
	if refund_assets[0].amount.is_zero() || refund_assets[1].amount.is_zero() {
		return Err(CrownfiSwapsCommonError::PayoutIsZero.into());
	}
	Ok(
		burn_token_workaround(Response::new(), msg_info.funds[0].clone())?
			.add_attributes(attr_withdraw_liquidity(
				msg_info.sender,
				receiver.clone(),
				withdrawn_share_amount,
				[&refund_assets[0], &refund_assets[1]],
			))
			.add_message(if let Some(receiver_payload) = receiver_payload {
				CosmosMsg::from(WasmMsg::Execute {
					contract_addr: receiver.into_string(),
					msg: receiver_payload,
					funds: refund_assets.into(),
				})
			} else {
				CosmosMsg::from(BankMsg::Send {
					to_address: receiver.into_string(),
					amount: refund_assets.into(),
				})
			}),
	)
}

pub fn process_withdraw_and_split_liquidity(
	deps: DepsMut<SeiQueryWrapper>,
	env: Env,
	msg_info: MessageInfo,
	left_receiver: Option<Addr>,
	left_receiver_payload: Option<Binary>,
	right_receiver: Option<Addr>,
	right_receiver_payload: Option<Binary>,
) -> Result<Response<SeiMsg>, PoolPairContractError> {
	let left_receiver = left_receiver.unwrap_or(msg_info.sender.clone());
	let right_receiver = right_receiver.unwrap_or(msg_info.sender.clone());
	let pool_id = CanonicalPoolPairIdentifier::load_non_empty()?;
	let pool_lp_denom = lp_denom(&env);

	let withdrawn_share_amount = must_pay(&msg_info, &pool_lp_denom)?;
	let total_share_supply = total_supply_workaround(&pool_lp_denom);

	// The balance has been added before this function is called.
	let refund_assets = balances_into_share_value(
		withdrawn_share_amount,
		total_share_supply,
		get_pool_balance(&deps.querier, &env, &pool_id)?,
	);
	if refund_assets[0].amount.is_zero() || refund_assets[1].amount.is_zero() {
		return Err(CrownfiSwapsCommonError::PayoutIsZero.into());
	}
	Ok(
		burn_token_workaround(Response::new(), msg_info.funds[0].clone())?
			.add_attributes(attr_withdraw_and_split_liquidity(
				msg_info.sender,
				[&left_receiver, &right_receiver],
				withdrawn_share_amount,
				[&refund_assets[0], &refund_assets[1]],
			))
			.add_message(if let Some(receiver_payload) = left_receiver_payload {
				CosmosMsg::from(WasmMsg::Execute {
					contract_addr: left_receiver.into_string(),
					msg: receiver_payload,
					funds: refund_assets[0..1].into(),
				})
			} else {
				CosmosMsg::from(BankMsg::Send {
					to_address: left_receiver.into_string(),
					amount: refund_assets[0..1].into(),
				})
			})
			.add_message(if let Some(receiver_payload) = right_receiver_payload {
				CosmosMsg::from(WasmMsg::Execute {
					contract_addr: right_receiver.into_string(),
					msg: receiver_payload,
					funds: refund_assets[1..].into(),
				})
			} else {
				CosmosMsg::from(BankMsg::Send {
					to_address: right_receiver.into_string(),
					amount: refund_assets[1..].into(),
				})
			}),
	)
}

pub fn process_swap(
	deps: DepsMut<SeiQueryWrapper>,
	env: Env,
	msg_info: MessageInfo,
	expected_result: Option<Uint128>,
	slippage_tolerance: Option<Decimal>,
	receiver: Option<Addr>,
	receiver_payload: Option<Binary>,
) -> Result<Response<SeiMsg>, PoolPairContractError> {
	let slippage_tolerance = slippage_tolerance.unwrap_or(DEFAULT_SLIPPAGE);
	if slippage_tolerance > MAX_ALLOWED_TOLERANCE {
		return Err(PoolPairContractError::ToleranceTooHigh);
	}
	let receiver = receiver.unwrap_or(msg_info.sender.clone());
	let pool_id = CanonicalPoolPairIdentifier::load_non_empty()?;
	let pool_config = PoolPairConfig::load_non_empty()?;
	let payment = must_pay_one_of_pair(&msg_info, &pool_id)?;

	let mut pool_balances = get_pool_balance(&deps.querier, &env, &pool_id)?;
	// The exchange calculations must be done from when before the funds where recieved.
	pool_balances[payment.inverse as usize].amount -= payment.amount;

	let swap_result = calc_swap(
		&pool_balances.map(|coin| coin.amount),
		payment.amount,
		pool_config.total_fee_bps,
		if pool_config.fee_receiver == Zeroable::zeroed() {
			0
		} else {
			pool_config.maker_fee_bps
		},
		payment.inverse,
		expected_result,
		slippage_tolerance,
	)?;
	if swap_result.result_amount.is_zero() {
		return Err(CrownfiSwapsCommonError::PayoutIsZero.into());
	}

	let out_coin = coin(swap_result.result_amount.u128(), pool_id.denom(!payment.inverse));

	let response = if swap_result.maker_fee_amount.is_zero() {
		Response::new()
	} else {
		// Because a function that takes `&mut self` and returns `&mut self` is too 5head apparently
		Response::new().add_message(BankMsg::Send {
			to_address: receiver.clone().into_string(),
			amount: vec![coin(
				swap_result.maker_fee_amount.u128(),
				pool_id.denom(!payment.inverse),
			)],
		})
	};
	Ok(response
		.add_attributes(attr_swap(
			msg_info.sender,
			receiver.clone(),
			&msg_info.funds[0],
			&out_coin,
			swap_result.spread_amount,
			swap_result.total_fee_amount,
			swap_result.maker_fee_amount,
		))
		.add_message(if let Some(receiver_payload) = receiver_payload {
			CosmosMsg::from(WasmMsg::Execute {
				contract_addr: receiver.into_string(),
				msg: receiver_payload,
				funds: vec![out_coin],
			})
		} else {
			CosmosMsg::from(BankMsg::Send {
				to_address: receiver.into_string(),
				amount: vec![out_coin],
			})
		}))
}

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
pub fn query(deps: Deps<SeiQueryWrapper>, env: Env, msg: PoolPairQueryMsg) -> Result<Binary, PoolPairContractError> {
	Ok(match msg {
		PoolPairQueryMsg::PairDenoms => {
			let config = PoolPairConfig::load_non_empty()?;
			let mut pool_id: PoolPairIdentifier = CanonicalPoolPairIdentifier::load_non_empty()?.into_inner().into();
			if config.flags.contains(PoolPairConfigFlags::INVERSE) {
				pool_id.swap();
			}
			to_json_binary(&<[String; 2]>::from(pool_id))?
		}
		PoolPairQueryMsg::CanonicalPairDenoms => to_json_binary(&<[String; 2]>::from(
			CanonicalPoolPairIdentifier::load_non_empty()?.into_inner(),
		))?,
		PoolPairQueryMsg::PairIdentifier => {
			let config = PoolPairConfig::load_non_empty()?;
			let mut pool_id: PoolPairIdentifier = CanonicalPoolPairIdentifier::load_non_empty()?.into_inner().into();
			if config.flags.contains(PoolPairConfigFlags::INVERSE) {
				pool_id.swap();
			}
			to_json_binary(&pool_id.to_string())?
		}
		PoolPairQueryMsg::CanonicalPairIdentifier => {
			to_json_binary(&CanonicalPoolPairIdentifier::load_non_empty()?.to_string())?
		}
		PoolPairQueryMsg::Config => to_json_binary(&PoolPairConfigJsonable::try_from(
			PoolPairConfig::load_non_empty()?.as_ref()
		)?)?,
		PoolPairQueryMsg::TotalShares => {
			to_json_binary(&total_supply_workaround(&lp_denom(&env)))?
		}
		PoolPairQueryMsg::ShareValue { amount } => {
			let pool_id = CanonicalPoolPairIdentifier::load_non_empty()?;
			let share_supply = total_supply_workaround(&lp_denom(&env));
			let pool_balances = get_pool_balance(&deps.querier, &env, &pool_id)?;
			to_json_binary(&balances_into_share_value(amount, share_supply, pool_balances))?
		}
		PoolPairQueryMsg::SimulateProvideLiquidity { offer } => {
			let pool_id = CanonicalPoolPairIdentifier::load_non_empty()?;
			if offer[0].denom != pool_id.left || offer[1].denom != pool_id.right {
				return Err(PoolPairContractError::DepositQueryDenomMismatch);
			}
			let mut share_supply = total_supply_workaround(&lp_denom(&env));
			let mut pool_balances = get_pool_balance(&deps.querier, &env, &pool_id)?;
			let new_shares = calc_shares_to_mint(
				share_supply,
				&[pool_balances[0].amount, pool_balances[1].amount],
				&[offer[0].amount, offer[1].amount],
				Decimal::MAX,
			)?;
			// Uint128 type implicitly panics on overflow
			share_supply += new_shares;
			pool_balances[0].amount += offer[0].amount;
			pool_balances[1].amount += offer[1].amount;
			to_json_binary(&PoolPairQuerySimulateDepositResponse {
				share_amount: new_shares,
				share_value: balances_into_share_value(new_shares, share_supply, pool_balances),
			})?
		}
		PoolPairQueryMsg::SimulateSwap { offer } => {
			let pool_id = CanonicalPoolPairIdentifier::load_non_empty()?;
			if !pool_id.is_in_pair(&offer.denom) {
				return Err(PaymentError::ExtraDenom(offer.denom).into());
			}
			let config = PoolPairConfig::load_non_empty()?;
			let pool_balances = get_pool_balance(&deps.querier, &env, &pool_id)?;
			to_json_binary(&calc_swap(
				&pool_balances.map(|coin| coin.amount),
				offer.amount,
				config.total_fee_bps,
				config.maker_fee_bps,
				offer.denom == pool_id.right,
				None,
				Decimal::MAX,
			)?)?
		}
		PoolPairQueryMsg::SimulateNaiveSwap { offer } => {
			let pool_id = CanonicalPoolPairIdentifier::load_non_empty()?;
			if !pool_id.is_in_pair(&offer.denom) {
				return Err(PaymentError::ExtraDenom(offer.denom).into());
			}
			let config = PoolPairConfig::load_non_empty()?;
			let pool_balances = get_pool_balance(&deps.querier, &env, &pool_id)?;
			to_json_binary(&calc_naive_swap(
				&pool_balances.map(|coin| coin.amount),
				offer.amount,
				config.total_fee_bps,
				config.maker_fee_bps,
				offer.denom == pool_id.right,
			)?)?
		}
		PoolPairQueryMsg::HourlyVolumeSum { past_hours } => {
			let volume_stats = VolumeStatisticsCounter::new()?;
			to_json_binary(
				&if let Some(past_hours) = NonZeroU8::new(past_hours.unwrap_or_default()) {
					volume_stats.get_volume_per_hours(env.block.time, past_hours)?
				} else {
					volume_stats.get_volume_since_hour_start(env.block.time)?
				},
			)?
		}
		PoolPairQueryMsg::DailyVolumeSum { past_days } => {
			let volume_stats = VolumeStatisticsCounter::new()?;
			to_json_binary(
				&if let Some(past_days) = NonZeroU8::new(past_days.unwrap_or_default()) {
					volume_stats.get_volume_per_days(env.block.time, past_days)?
				} else {
					volume_stats.get_volume_since_day_start(env.block.time)?
				},
			)?
		}
		PoolPairQueryMsg::TotalVolumeSum => {
			let volume_stats = VolumeStatisticsCounter::new()?;
			to_json_binary(&volume_stats.get_volume_all_time(env.block.time)?)?
		}
	})
}
