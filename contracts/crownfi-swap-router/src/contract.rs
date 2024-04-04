use cosmwasm_std::{Binary, Deps, DepsMut, Env, MessageInfo, Reply, Response};
use cw2::set_contract_version;
use cw_utils::{nonpayable, parse_reply_instantiate_data, ParseReplyError};
use sei_cosmwasm::{SeiMsg, SeiQueryWrapper};

use crate::{error::SwapRouterContractError, msg::{SwapRouterExecuteMsg, SwapRouterInstantiateMsg, SwapRouterQueryMsg}};

const CONTRACT_NAME: &str = "crownfi-swap-router";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
#[inline]
pub fn instantiate(
	deps: DepsMut<SeiQueryWrapper>,
	_env: Env,
	msg_info: MessageInfo,
	msg: SwapRouterInstantiateMsg
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
	env: Env,
	msg_info: MessageInfo,
	msg: SwapRouterExecuteMsg,
) -> Result<Response<SeiMsg>, SwapRouterContractError> {
	todo!()
}

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
#[inline]
pub fn reply(deps: DepsMut, _env: Env, msg: Reply) -> Result<Response<SeiMsg>, SwapRouterContractError> {
	match msg.id {
		0 => {
			let msg = parse_reply_instantiate_data(msg)?;
			todo!()
		},
		_ => {
			Err(SwapRouterContractError::FailedReply(ParseReplyError::ParseFailure(
				format!("Reply ID {0} is unknown", msg.id)
			)))
		}
	}
}


#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
pub fn query(
	deps: Deps<SeiQueryWrapper>,
	_env: Env,
	msg: SwapRouterQueryMsg
) -> Result<Binary, SwapRouterContractError> {
	Ok(
		todo!()	
	)
}
