use cosmwasm_std::{DepsMut, Env, MessageInfo, Response, Uint128};
use crownfi_cw_common::storage::item::StoredItem;
use crownfi_swaps_common::{data_types::pair_id::{CanonicalPoolPairIdentifier, PoolPairIdentifier}, validation::msg::two_coins};
use cw2::set_contract_version;
use cw_utils::{nonpayable, PaymentError};
use sei_cosmwasm::{SeiMsg, SeiQueryWrapper};

use crate::{error::PoolPairContractError, msg::PoolPairInstantiateMsg, state::PoolPairConfig, workarounds::mint_to_workaround};

use self::shares::{lp_denom, LP_SUBDENOM};

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
	set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
	PoolPairConfig::try_from(&msg.config)?.save(deps.storage)?;
	let new_denom = lp_denom(&env);
	// needs tokens and reply
	let mut pool_id = PoolPairIdentifier {
		left: left_coin.denom.clone(),
		right: right_coin.denom.clone()
	};

	let mint_amount = 0; // FIX THIS FIX THIS FIX THIS
	Ok(
		mint_to_workaround(
			Response::new()
				.add_message(
					SeiMsg::CreateDenom {
						subdenom: LP_SUBDENOM.to_string()
					}
				),
			deps.storage,
			&new_denom,
			&msg.shares_receiver,
			mint_amount
		)?
	)
}
