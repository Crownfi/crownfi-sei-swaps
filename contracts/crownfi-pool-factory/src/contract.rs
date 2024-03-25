use cosmwasm_std::{attr, Addr, Coin, DepsMut, Env, MessageInfo, Reply, Response, StdError};
use crownfi_cw_common::{data_types::canonical_addr::SeiCanonicalAddr, env::ClonableEnvInfoMut, storage::item::StoredItem};
use crownfi_swaps_common::data_types::pair_id::PoolPairIdentifier;
use cw2::set_contract_version;
use cw_utils::{nonpayable, parse_reply_instantiate_data, ParseReplyError};
use sei_cosmwasm::{SeiMsg, SeiQueryWrapper};

use crate::{error::PoolFactoryContractError, msg::{PoolFactoryExecuteMsg, PoolFactoryInstantiateMsg}, state::{PoolFactoryConfig, PoolFactoryConfigFlags}};

const CONTRACT_NAME: &str = "crownfi-pool-factory";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");
/// `reply` call code IDs used in a sub-message.
const INSTANTIATE_PAIR_REPLY_ID: u64 = 1;

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
#[inline]
pub fn instantiate(
	deps: DepsMut<SeiQueryWrapper>,
	_env: Env,
	msg_info: MessageInfo,
	msg: PoolFactoryInstantiateMsg
) -> Result<Response<SeiMsg>, PoolFactoryContractError> {
	nonpayable(&msg_info)?;
	set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
	msg.config.into_storable(deps.api)?.save(deps.storage)?;
	Ok(Response::new())
}

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
#[inline]
pub fn execute(
	deps: DepsMut<SeiQueryWrapper>,
	env: Env,
	msg_info: MessageInfo,
	msg: PoolFactoryExecuteMsg,
) -> Result<Response<SeiMsg>, PoolFactoryContractError> {
	Ok(
		match msg {
			PoolFactoryExecuteMsg::UpdateConfig {
				admin,
				fee_receiver,
				pair_code_id,
				default_total_fee_bps,
				default_maker_fee_bps,
				permissionless_pool_cration
			} => {
				todo!()
			},
			PoolFactoryExecuteMsg::CreatePool { left_denom } => {
				let env_info = ClonableEnvInfoMut::new(deps, env);
				todo!()
			},
			PoolFactoryExecuteMsg::UpdateFeesForPool { pair, total_fee_bps, maker_fee_bps } => {
				todo!();
			}
			PoolFactoryExecuteMsg::UpdateGlobalConfigForPool { index, limit } => {
				todo!()
			},
		}
	)
}

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
#[inline]
pub fn reply(deps: DepsMut, _env: Env, msg: Reply) -> Result<Response, PoolFactoryContractError> {
	match msg.id {
		INSTANTIATE_PAIR_REPLY_ID => {
			let msg = parse_reply_instantiate_data(msg)?;
			let new_pair = PoolPairIdentifier::load_non_empty(deps.storage)?;
			PoolPairIdentifier::remove(deps.storage);
			// We shouldn't have to check if the pair created matches the one we expected as that's the only scenerio
			// where we asked for a reply on anything.
			let new_pair_addr = Addr::unchecked(msg.contract_address);
			//deps.api.
			PoolPairIdentifier::remove(deps.storage);
			Ok(Response::new().add_attributes(vec![
				attr("action", "create_pair"),
				attr("pair", new_pair.to_string()),
				attr("contract_addr", new_pair_addr),
			]))
		},
		_ => {
			Err(PoolFactoryContractError::FailedReply(ParseReplyError::ParseFailure(
				format!("Reply ID {0} is unknown", msg.id)
			)))
		}
	}
}

fn process_update_config(
	deps: DepsMut,
	msg_info: MessageInfo,
	admin: Option<Addr>,
	fee_receiver: Option<Addr>,
	pair_code_id: Option<u64>,
	default_total_fee_bps: Option<u16>,
	default_maker_fee_bps: Option<u16>,
	permissionless_pool_cration: Option<bool>
) -> Result<Response<SeiMsg>, PoolFactoryContractError> {
	nonpayable(&msg_info)?;
	let mut config = PoolFactoryConfig::load_non_empty(deps.storage)?;
	if config.admin != SeiCanonicalAddr::from_addr_using_api(&msg_info.sender, deps.api)? {
		return Err(PoolFactoryContractError::Unauthorized("Sender is not the currently configured admin".into()));
	}
	if let Some(admin) = admin {
		config.admin = SeiCanonicalAddr::from_addr_using_api(&admin, deps.api)?;
	}
	if let Some(fee_receiver) = fee_receiver {
		config.fee_receiver = SeiCanonicalAddr::from_addr_using_api(&fee_receiver, deps.api)?;
	}
	if let Some(pair_code_id) = pair_code_id {
		config.pair_code_id = pair_code_id;
	}
	if let Some(default_total_fee_bps) = default_total_fee_bps {
		config.default_total_fee_bps = default_total_fee_bps;
	}
	if let Some(default_maker_fee_bps) = default_maker_fee_bps {
		config.default_maker_fee_bps = default_maker_fee_bps;
	}
	if let Some(permissionless_pool_cration) = permissionless_pool_cration {
		if permissionless_pool_cration {
			config.flags |= PoolFactoryConfigFlags::PERMISSIONLESS_POOL_CRATION;
		} else {
			config.flags &= !PoolFactoryConfigFlags::PERMISSIONLESS_POOL_CRATION;
		}
	}
	config.save(deps.storage)?;
	Ok(Response::new().add_attribute("action", "update_config"))
}

fn process_create_pool(
	deps: DepsMut,
	msg_info: MessageInfo,
	left_denom: String
) -> Result<Response<SeiMsg>, PoolFactoryContractError> {
	let [token0, token1] = two_coins(&msg_info)?;
	todo!("impl this after pair contract is created");
}

fn process_update_global_config_for_pool(
	env_info: ClonableEnvInfoMut<SeiQueryWrapper>,
	msg_info: MessageInfo,
) -> Result<Response<SeiMsg>, PoolFactoryContractError> {
	todo!("impl this after pair contract is created");
}

pub(crate) fn two_coins<'msg>(
	msg_info: &'msg MessageInfo
) -> Result<&'msg [Coin; 2], PoolFactoryContractError> {
    if msg_info.funds.len() != 2 {
		return Err(
			PoolFactoryContractError::NeedsTwoCoins
		);
	}
	Ok(msg_info.funds.as_slice().try_into().expect("length was already checked"))
}
