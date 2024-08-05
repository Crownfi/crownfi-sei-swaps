use bytemuck::Zeroable;
use cosmwasm_std::{
	coin, to_json_binary, Addr, BankMsg, Binary, CosmosMsg, Decimal, Deps, DepsMut, Env, Fraction, MessageInfo, Reply,
	ReplyOn, Response, SubMsg, WasmMsg,
};
use crownfi_cw_common::storage::{item::StoredItem, SerializableItem};
use crownfi_pool_pair_contract::{
	contract::pool::{PoolPairCalcNaiveSwapResult, PoolPairCalcSwapResult},
	msg::{PoolPairExecuteMsg, PoolPairQueryMsg},
};
use crownfi_swaps_common::data_types::pair_id::CanonicalPoolPairIdentifier;
use cw2::set_contract_version;
use cw_utils::{nonpayable, one_coin, parse_reply_instantiate_data, ParseReplyError};
use sei_cosmwasm::{SeiMsg, SeiQueryWrapper};

use crate::{
	error::SwapRouterContractError,
	msg::{
		SwapReceiver, SwapRouterExecuteMsg, SwapRouterExpectation, SwapRouterInstantiateMsg, SwapRouterQueryMsg,
		SwapRouterSimulateSwapsResponse,
	},
	state::{get_swapper_addresses, SwapRouterState},
};

const CONTRACT_NAME: &str = "crownfi-swap-router";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

/// `reply` call code IDs used in a sub-message.
const SWAP_COMPLETE_REPLY_ID: u64 = 0xf09f92b162727272;

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
#[inline]
pub fn instantiate(
	deps: DepsMut<SeiQueryWrapper>,
	_env: Env,
	msg_info: MessageInfo,
	_msg: SwapRouterInstantiateMsg,
) -> Result<Response<SeiMsg>, SwapRouterContractError> {
	nonpayable(&msg_info)?;
	set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
	// SwapRouterConfig::try_from(&msg.config)?.save(deps.storage)?;
	Ok(Response::new())
}

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
#[inline]
pub fn execute(
	deps: DepsMut<SeiQueryWrapper>,
	_env: Env,
	msg_info: MessageInfo,
	msg: SwapRouterExecuteMsg,
) -> Result<Response<SeiMsg>, SwapRouterContractError> {
	match msg {
		SwapRouterExecuteMsg::ExecuteSwaps {
			swappers,
			intermediate_slippage_tolerance,
			expectation,
			// unwrapper,
			receiver,
		} => process_execute_swaps(
			deps,
			msg_info,
			swappers,
			intermediate_slippage_tolerance,
			expectation,
			// unwrapper,
			receiver,
		),
		SwapRouterExecuteMsg::NextStep {} => process_execute_next_step(deps, msg_info),
	}
}

fn process_execute_swaps(
	deps: DepsMut<SeiQueryWrapper>,
	msg_info: MessageInfo,
	swappers: Vec<Addr>,
	intermediate_slippage_tolerance: Option<Decimal>,
	expectation: Option<SwapRouterExpectation>,
	// unwrapper: Option<Addr>,
	receiver: SwapReceiver,
) -> Result<Response<SeiMsg>, SwapRouterContractError> {
	if SwapRouterState::load()?.is_some() {
		return Err(SwapRouterContractError::AlreadyRoutingSwaps);
	}
	if expectation.as_ref().is_some_and(|e| e.expected_amount.is_zero()) {
		return Err(SwapRouterContractError::ExpectingNothing);
	}

	let querier = sei_cosmwasm::SeiQuerier::new(&deps.querier);
	let (receiver, unwrapper, unwrapper_kind) = match receiver {
		SwapReceiver::Direct(addr) => (addr.try_into()?, Zeroable::zeroed(), 0),
		SwapReceiver::EvmUnwrap { contract, evm_receiver } => {
			let sei_addr = querier.get_sei_address(evm_receiver)?.sei_address;
			let sei_addr = Addr::unchecked(sei_addr).try_into()?;
			(sei_addr, contract.try_into()?, 1)
		}
		SwapReceiver::WasmUnwrap { contract, receiver } => (receiver.try_into()?, contract.try_into()?, 2),
	};

	let new_state = SwapRouterState {
		receiver,
		unwrapper,
		unwrapper_kind,
		intermediate_slippage_tolerance: intermediate_slippage_tolerance
			.map(|num| num.numerator().u128())
			.unwrap_or(u128::MAX),
		expected_amount: expectation
			.as_ref()
			.map(|expectation| expectation.expected_amount.u128())
			.unwrap_or_default(),
		slippage_tolerance: expectation
			.as_ref()
			.map(|expectation| expectation.slippage_tolerance.numerator().u128())
			.unwrap_or(u128::MAX),
	};
	let mut stored_swappers = get_swapper_addresses();
	for swapper in swappers.iter().skip(1).rev() {
		stored_swappers.push(&swapper.try_into()?)?;
	}
	new_state.save()?;

	let Some(first_swapper) = swappers.first() else {
		return Err(SwapRouterContractError::RouteEmpty);
	};
	Ok(Response::new().add_submessage(SubMsg {
		id: SWAP_COMPLETE_REPLY_ID,
		msg: CosmosMsg::from(WasmMsg::Execute {
			contract_addr: first_swapper.to_string(),
			msg: to_json_binary(&PoolPairExecuteMsg::Swap {
				expected_result: None,
				slippage_tolerance: intermediate_slippage_tolerance,
				receiver: None, // self
				receiver_payload: Some(b"\"next_step\"".into()),
			})?,
			funds: msg_info.funds,
		}),
		gas_limit: None,
		reply_on: ReplyOn::Success,
	}))
}

fn process_execute_next_step(
	deps: DepsMut<SeiQueryWrapper>,
	msg_info: MessageInfo,
) -> Result<Response<SeiMsg>, SwapRouterContractError> {
	let router_state = SwapRouterState::load_non_empty()?;
	let mut stored_swappers = get_swapper_addresses();

	if let Some(swapper) = stored_swappers.pop()? {
		let slippage_tolerance = if router_state.intermediate_slippage_tolerance == u128::MAX {
			None
		} else {
			Some(Decimal::new(router_state.intermediate_slippage_tolerance.into()))
		};
		Ok(Response::new().add_message(WasmMsg::Execute {
			contract_addr: Addr::try_from(swapper.as_ref())?.into_string(),
			msg: to_json_binary(&PoolPairExecuteMsg::Swap {
				expected_result: None,
				slippage_tolerance,
				receiver: None, // self
				receiver_payload: Some(b"\"next_step\"".into()),
			})?,
			funds: msg_info.funds,
		}))
	} else {
		let receiver = Addr::try_from(router_state.receiver)?;

		let final_result = one_coin(&msg_info)?;
		if router_state.expected_amount > 0
			&& Decimal::from_ratio(final_result.amount, router_state.expected_amount).abs_diff(Decimal::one())
				> Decimal::raw(router_state.slippage_tolerance)
		{
			return Err(SwapRouterContractError::SlippageTooHigh);
		}
		SwapRouterState::remove();

		if router_state.unwrapper != Zeroable::zeroed() {
			let unwrapper = Addr::try_from(router_state.unwrapper)?;
			let msg = {
				let json_msg = match router_state.unwrapper_kind {
					1 => {
						let querier = sei_cosmwasm::SeiQuerier::new(&deps.querier);
						let evm_addr = querier.get_evm_address(receiver.to_string())?.evm_address;
						format!("{{\"unwrap\":{{\"evm_recipient\":\"{}\"}}}}", evm_addr)
					}
					2 => format!("{{\"unwrap\":{{\"receiver\":\"{}\"}}}}", receiver),
					_ => unreachable!("something is wrong with the state machine"),
				};
				Binary::from(Vec::from(json_msg))
			};

			return Ok(Response::new().add_message(WasmMsg::Execute {
				contract_addr: unwrapper.into_string(),
				msg,
				funds: vec![final_result],
			}));
		}

		Ok(Response::new().add_message(BankMsg::Send {
			to_address: receiver.into_string(),
			amount: vec![final_result],
		}))
	}
}

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
#[inline]
pub fn reply(_deps: DepsMut, _env: Env, msg: Reply) -> Result<Response<SeiMsg>, SwapRouterContractError> {
	match msg.id {
		SWAP_COMPLETE_REPLY_ID => {
			let _ = parse_reply_instantiate_data(msg)?;
			if SwapRouterState::load()?.is_some() || get_swapper_addresses().len() > 0 {
				return Err(SwapRouterContractError::IncompleteRoute);
			}
			Ok(Response::new())
		}
		_ => Err(SwapRouterContractError::FailedReply(ParseReplyError::ParseFailure(
			format!("Reply ID {0} is unknown", msg.id),
		))),
	}
}

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
pub fn query(
	deps: Deps<SeiQueryWrapper>,
	_env: Env,
	msg: SwapRouterQueryMsg,
) -> Result<Binary, SwapRouterContractError> {
	Ok(match msg {
		SwapRouterQueryMsg::SimulateSwaps { offer, swappers } => {
			let mut current_denom = offer.denom;
			let mut current_naive_amount = offer.amount;
			let mut current_actual_amount = offer.amount;
			for swapper_addr in swappers.into_iter() {
				let pool_pair = CanonicalPoolPairIdentifier::deserialize_to_owned(
					&deps
						.querier
						.query_wasm_raw(swapper_addr.clone(), CanonicalPoolPairIdentifier::namespace())?
						.unwrap_or_default(),
				)?;
				// Smart queries are very expensive, crownfi_pool_pair_contract should probably provide helper
				// functions built on top of raw queries to facilitate this. Though this makes us
				// forward-compatible with contracts which have the same functionality.
				let swap_result = deps.querier.query_wasm_smart::<PoolPairCalcSwapResult>(
					swapper_addr.clone(),
					&PoolPairQueryMsg::SimulateSwap {
						offer: coin(current_actual_amount.into(), current_denom.clone()),
					},
				)?;
				current_actual_amount = swap_result.result_amount;
				let naive_swap_result = deps.querier.query_wasm_smart::<PoolPairCalcNaiveSwapResult>(
					swapper_addr.clone(),
					&PoolPairQueryMsg::SimulateNaiveSwap {
						offer: coin(current_actual_amount.into(), current_denom.clone()),
					},
				)?;
				current_naive_amount = naive_swap_result.result_amount;
				current_denom = pool_pair
					.other_denom(&current_denom)
					.ok_or(SwapRouterContractError::FundsIncompatibleWithSwapRoute)?
					.to_owned();
			}
			to_json_binary(&SwapRouterSimulateSwapsResponse {
				result_denom: current_denom,
				result_amount: current_actual_amount,
				slip_amount: current_naive_amount.saturating_sub(current_actual_amount),
			})?
		}
	})
}
