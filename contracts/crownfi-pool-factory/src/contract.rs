use cosmwasm_std::{
	attr, to_json_binary, Addr, Binary, CosmosMsg, Deps, DepsMut, Env, MessageInfo, Reply, ReplyOn, Response, StdError,
	SubMsg, WasmMsg,
};
use crownfi_cw_common::storage::item::StoredItem;
use crownfi_pool_pair_contract::{
	msg::{PoolPairExecuteMsg, PoolPairInstantiateMsg},
	state::PoolPairConfigJsonable,
};
use crownfi_swaps_common::{
	data_types::pair_id::CanonicalPoolPairIdentifier, error::CrownfiSwapsCommonError, validation::msg::two_coins,
};
use cw2::set_contract_version;
use cw_utils::{nonpayable, parse_reply_instantiate_data, ParseReplyError};
use sei_cosmwasm::{SeiMsg, SeiQueryWrapper};

use crate::{
	error::PoolFactoryContractError,
	msg::{PoolFactoryCreatedPair, PoolFactoryExecuteMsg, PoolFactoryInstantiateMsg, PoolFactoryQueryMsg},
	state::{
		get_pool_addresses_store, PoolFactoryConfig, PoolFactoryConfigFlags,
		PoolFactoryConfigJsonable,
	},
};

const CONTRACT_NAME: &str = "crownfi-pool-factory";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

/// `reply` call code IDs used in a sub-message.
const INSTANTIATE_PAIR_REPLY_ID: u64 = 0xf09f8fad62727272;

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
#[inline]
pub fn instantiate(
	deps: DepsMut<SeiQueryWrapper>,
	_env: Env,
	msg_info: MessageInfo,
	msg: PoolFactoryInstantiateMsg,
) -> Result<Response<SeiMsg>, PoolFactoryContractError> {
	nonpayable(&msg_info)?;
	set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
	PoolFactoryConfig::try_from(&msg.config)?.save()?;
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
	match msg {
		PoolFactoryExecuteMsg::UpdateConfig {
			admin,
			fee_receiver,
			pair_code_id,
			default_total_fee_bps,
			default_maker_fee_bps,
			permissionless_pool_cration,
		} => process_update_config(
			deps,
			msg_info,
			admin,
			fee_receiver,
			pair_code_id,
			default_total_fee_bps,
			default_maker_fee_bps,
			permissionless_pool_cration,
		),
		PoolFactoryExecuteMsg::CreatePool {
			left_denom,
			initial_shares_receiver,
		} => process_create_pool(deps, env, msg_info, left_denom, initial_shares_receiver),
		PoolFactoryExecuteMsg::UpdateFeesForPool {
			pair,
			total_fee_bps,
			maker_fee_bps,
		} => process_update_fees_for_pool(deps, msg_info, pair, total_fee_bps, maker_fee_bps),
		PoolFactoryExecuteMsg::UpdateGlobalConfigForPool { after, limit } => {
			process_update_global_config_for_pool(deps, msg_info, after, limit)
		}
	}
}

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
#[inline]
pub fn reply(_deps: DepsMut, _env: Env, msg: Reply) -> Result<Response<SeiMsg>, PoolFactoryContractError> {
	match msg.id {
		INSTANTIATE_PAIR_REPLY_ID => {
			let msg = parse_reply_instantiate_data(msg)?;
			let new_pair = CanonicalPoolPairIdentifier::load_non_empty()?;
			CanonicalPoolPairIdentifier::remove();
			// We shouldn't have to check if the pair created matches the one we expected as that's the only scenerio
			// where we asked for a reply on anything.
			let new_pair_addr = Addr::unchecked(msg.contract_address);
			let pool_map = get_pool_addresses_store();
			pool_map.set(&new_pair, &(&new_pair_addr).try_into()?)?;
			Ok(Response::new().add_attributes(vec![
				attr("action", "create_pair"),
				attr("pair", new_pair.to_string()),
				attr("contract_addr", new_pair_addr),
			]))
		}
		_ => Err(PoolFactoryContractError::FailedReply(ParseReplyError::ParseFailure(
			format!("Reply ID {0} is unknown", msg.id),
		))),
	}
}

fn process_update_config(
	_deps: DepsMut<SeiQueryWrapper>,
	msg_info: MessageInfo,
	admin: Option<Addr>,
	fee_receiver: Option<Addr>,
	pair_code_id: Option<u64>,
	default_total_fee_bps: Option<u16>,
	default_maker_fee_bps: Option<u16>,
	permissionless_pool_cration: Option<bool>,
) -> Result<Response<SeiMsg>, PoolFactoryContractError> {
	nonpayable(&msg_info)?;
	let mut config = PoolFactoryConfig::load_non_empty()?;
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
	config.save()?;
	Ok(Response::new().add_attribute("action", "update_config"))
}

fn process_create_pool(
	_deps: DepsMut<SeiQueryWrapper>,
	env: Env,
	msg_info: MessageInfo,
	left_denom: String,
	initial_shares_receiver: Option<Addr>,
) -> Result<Response<SeiMsg>, PoolFactoryContractError> {
	let pool_coins = two_coins(&msg_info)?;
	let new_pool_id = CanonicalPoolPairIdentifier::from([pool_coins[0].denom.clone(), pool_coins[1].denom.clone()]);
	if get_pool_addresses_store().has(&new_pool_id) {
		return Err(PoolFactoryContractError::PairAlreadyExists);
	}
	let config = PoolFactoryConfig::load_non_empty()?;
	let is_admin = config.admin == (&msg_info.sender).try_into()?;
	if !is_admin
		&& !config
			.flags
			.contains(PoolFactoryConfigFlags::PERMISSIONLESS_POOL_CRATION)
	{
		return Err(CrownfiSwapsCommonError::Unauthorized("Permissionless pool creation is disabled".into()).into());
	}
	// This later gets referenced in the reply.
	new_pool_id.save()?;
	Ok(Response::new().add_submessage(SubMsg {
		id: INSTANTIATE_PAIR_REPLY_ID,
		msg: CosmosMsg::from(WasmMsg::Instantiate {
			admin: Some(env.contract.address.clone().into_string()),
			code_id: config.pair_code_id,
			msg: to_json_binary(&PoolPairInstantiateMsg {
				shares_receiver: initial_shares_receiver.unwrap_or(msg_info.sender.clone()),
				config: PoolPairConfigJsonable {
					admin: env.contract.address.clone(),
					fee_receiver: config.fee_receiver.try_into()?,
					total_fee_bps: config.default_total_fee_bps,
					maker_fee_bps: config.default_maker_fee_bps,
					inverse: left_denom == new_pool_id.right,
					endorsed: is_admin,
				},
			})?,
			funds: pool_coins.into(),
			label: format!("CrownFi Sei Swap Pool {}", &new_pool_id),
		}),
		gas_limit: None,
		reply_on: ReplyOn::Success,
	}))
}

fn process_update_fees_for_pool(
	_deps: DepsMut<SeiQueryWrapper>,
	msg_info: MessageInfo,
	pair: [String; 2],
	total_fee_bps: Option<u16>,
	maker_fee_bps: Option<u16>,
) -> Result<Response<SeiMsg>, PoolFactoryContractError> {
	nonpayable(&msg_info)?;
	let config = PoolFactoryConfig::load_non_empty()?;
	if config.admin != msg_info.sender.try_into()? {
		return Err(
			CrownfiSwapsCommonError::Unauthorized("Sender is not the currently configured admin".into()).into(),
		);
	}
	let pool_addr = get_pool_addresses_store()
		.get(&pair.into())?
		.ok_or(StdError::not_found("pair address"))?;

	Ok(Response::new().add_message(WasmMsg::Execute {
		contract_addr: pool_addr.to_string(),
		msg: to_json_binary(&PoolPairExecuteMsg::UpdateConfig {
			admin: None,
			fee_receiver: None,
			total_fee_bps,
			maker_fee_bps,
			endorsed: None,
		})?,
		funds: Vec::new(),
	}))
}

fn process_update_global_config_for_pool(
	_deps: DepsMut<SeiQueryWrapper>,
	msg_info: MessageInfo,
	after: Option<[String; 2]>,
	limit: Option<u32>,
) -> Result<Response<SeiMsg>, PoolFactoryContractError> {
	nonpayable(&msg_info)?;
	let config = PoolFactoryConfig::load_non_empty()?;
	Ok(Response::new().add_messages(
		get_pool_addresses_store()
			.iter_range(after.map(|v| v.into()), None)?
			.map(|(_, addr)| WasmMsg::Execute {
				contract_addr: addr.to_string(),
				msg: to_json_binary(&PoolPairExecuteMsg::UpdateConfig {
					admin: None,
					fee_receiver: Some(
						config
							.fee_receiver
							.try_into()
							.expect("address stringification shouldn't fail"),
					),
					total_fee_bps: None,
					maker_fee_bps: None,
					endorsed: None,
				})
				.expect("serialization shouldn't fail"),
				funds: Vec::new(),
			})
			.take(limit.unwrap_or(u32::MAX) as usize),
	))
}

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
pub fn query(
	_deps: Deps<SeiQueryWrapper>,
	_env: Env,
	msg: PoolFactoryQueryMsg,
) -> Result<Binary, PoolFactoryContractError> {
	Ok(match msg {
		PoolFactoryQueryMsg::Config => to_json_binary(&PoolFactoryConfigJsonable::try_from(
			PoolFactoryConfig::load_non_empty()?.as_ref(),
		)?)?,
		PoolFactoryQueryMsg::PairAddr { pair } => to_json_binary(
			&get_pool_addresses_store()
				.get(&pair.into())?
				.map(|addr| Addr::try_from(addr.as_ref()))
				.transpose()?,
		)?,
		PoolFactoryQueryMsg::Pairs { after, limit } => {
			let pair_addr_store = get_pool_addresses_store();
			to_json_binary(
				&pair_addr_store
					.iter_range(after.map(|after| after.into()), None)?
					.map(|(pair, address)| PoolFactoryCreatedPair {
						canonical_pair: pair.into(),
						address: address.as_ref().try_into().expect("address stringification shouldn't fail"),
					})
					.take(limit.unwrap_or(u32::MAX) as usize)
					.collect::<Vec<_>>(),
			)?
		}
	})
}
