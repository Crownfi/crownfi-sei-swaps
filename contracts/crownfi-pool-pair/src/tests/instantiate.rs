use cosmwasm_std::{
	coin,
	testing::{mock_env, mock_info},
	Addr, BankMsg, SubMsg,
};
use crownfi_cw_common::storage::item::StoredItem;
use crownfi_swaps_common::{data_types::pair_id::CanonicalPoolPairIdentifier, error::CrownfiSwapsCommonError};
use cw2::get_contract_version;
use sei_cosmwasm::SeiMsg;

use crate::{
	contract::instantiate,
	error::PoolPairContractError,
	tests::{deps, init, shares::LP_SUBDENOM, PoolPairConfig, LP_TOKEN, PAIR_DENOMS, RANDOM_ADDRESS},
	workarounds::total_supply_workaround,
};

use super::{PoolPairConfigJsonable, PoolPairInstantiateMsg, ONE_BILLION};

#[test]
fn must_be_paid_with_2_coins() {
	let mut deps = deps(&[]);
	let msg = PoolPairInstantiateMsg {
		shares_receiver: Addr::unchecked(RANDOM_ADDRESS),
		config: PoolPairConfigJsonable {
			admin: Addr::unchecked(RANDOM_ADDRESS),
			inverse: false,
			endorsed: true,
			fee_receiver: Addr::unchecked(RANDOM_ADDRESS),
			total_fee_bps: 100,
			maker_fee_bps: 50,
		},
	};

	let env = mock_env();
	let info = mock_info(RANDOM_ADDRESS, &[coin(ONE_BILLION, PAIR_DENOMS[0])]);

	let res = instantiate(deps.as_mut(), env.clone(), info, msg.clone());
	assert_eq!(
		res,
		Err(PoolPairContractError::SwapsCommonError(
			CrownfiSwapsCommonError::NeedsTwoCoins
		))
	);

	let info = mock_info(
		RANDOM_ADDRESS,
		&[coin(ONE_BILLION, PAIR_DENOMS[0]), coin(0, PAIR_DENOMS[0])],
	);
	let res = instantiate(deps.as_mut(), env.clone(), info, msg);
	assert_eq!(
		res,
		Err(PoolPairContractError::SwapsCommonError(
			CrownfiSwapsCommonError::PaymentIsZero
		))
	);
}

#[test]
fn contract_version() {
	let mut deps = deps(&[]);
	init(&mut deps);
	let c_version = get_contract_version(&deps.storage).unwrap();
	assert_eq!(c_version.version, env!("CARGO_PKG_VERSION"));
}

#[test]
fn check_config() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let config = PoolPairConfig::load().unwrap().unwrap();

	assert_eq!(config.admin, Addr::unchecked(RANDOM_ADDRESS).try_into().unwrap());
	assert_eq!(config.fee_receiver, Addr::unchecked(RANDOM_ADDRESS).try_into().unwrap());
	assert_eq!(config.maker_fee_bps, 50);
	assert_eq!(config.total_fee_bps, 100);
}

#[test]
fn subdenom_is_created_and_shares_are_minted() {
	let mut deps = deps(&[]);
	let res = init(&mut deps);

	assert_eq!(
		res.messages,
		vec![
			SubMsg::new(SeiMsg::CreateDenom {
				subdenom: LP_SUBDENOM.into()
			}),
			SubMsg::new(SeiMsg::MintTokens {
				amount: coin(707106, LP_TOKEN)
			}),
			SubMsg::new(BankMsg::Send {
				to_address: RANDOM_ADDRESS.into(),
				amount: vec![coin(707106, LP_TOKEN)]
			})
		]
	);
}

#[test]
fn contract_is_aware_of_newly_minted_tokens() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let id = CanonicalPoolPairIdentifier::load().unwrap().unwrap();
	assert_eq!(id.left, PAIR_DENOMS[0]);
	assert_eq!(id.right, PAIR_DENOMS[1]);

	let total_supply = total_supply_workaround(LP_TOKEN);
	assert_eq!(total_supply.u128(), 707106);
}
