use cosmwasm_std::{
	coin,
	testing::{mock_env, mock_info},
	Addr,
};
use crownfi_cw_common::storage::item::StoredItem;
use crownfi_swaps_common::error::CrownfiSwapsCommonError;
use cw_utils::PaymentError;

use crate::{
	contract::execute,
	error::PoolPairContractError,
	msg::PoolPairExecuteMsg,
	tests::{deps, init, AddressFactory, PoolPairConfig, PAIR_DENOMS},
};

#[test]
fn accepts_no_coins() {
	let mut deps = deps(&[]);
	init(&mut deps);
	let env = mock_env();

	let new_admin = AddressFactory::random_address();
	let new_fee_receiver = AddressFactory::random_address();
	let exec_msg = PoolPairExecuteMsg::UpdateConfig {
		admin: Some(Addr::unchecked(&new_admin)),
		fee_receiver: Some(Addr::unchecked(&new_fee_receiver)),
		total_fee_bps: Some(69),
		maker_fee_bps: None,
		endorsed: Some(true),
	};

	let info = mock_info(AddressFactory::ADMIN, &[coin(1, PAIR_DENOMS[0])]);
	let res = execute(deps.as_mut(), env.clone().clone(), info, exec_msg);
	assert_eq!(
		res,
		Err(PoolPairContractError::PaymentError(PaymentError::NonPayable {}))
	);
}

#[test]
fn sender_must_be_admin() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let fake_admin = AddressFactory::random_address();
	let exec_msg = PoolPairExecuteMsg::UpdateConfig {
		admin: Some(Addr::unchecked(&fake_admin)),
		fee_receiver: Some(Addr::unchecked(&fake_admin)),
		total_fee_bps: Some(69),
		maker_fee_bps: None,
		endorsed: Some(true),
	};

	let env = mock_env();
	let info = mock_info(&fake_admin, &[]);
	let res = execute(deps.as_mut(), env.clone().clone(), info, exec_msg.clone());
	assert!(matches!(
		res,
		Err(PoolPairContractError::SwapsCommonError(
			CrownfiSwapsCommonError::Unauthorized(_)
		))
	));
}

#[test]
fn items_are_set_as_specified() {
	let mut deps = deps(&[]);
	init(&mut deps);
	let env = mock_env();

	let new_admin = AddressFactory::random_address();
	let new_fee_receiver = AddressFactory::random_address();
	let exec_msg = PoolPairExecuteMsg::UpdateConfig {
		admin: Some(Addr::unchecked(&new_admin)),
		fee_receiver: Some(Addr::unchecked(&new_fee_receiver)),
		total_fee_bps: Some(69),
		maker_fee_bps: None,
		endorsed: Some(true),
	};

	let info = mock_info(AddressFactory::ADMIN, &[]);
	execute(deps.as_mut(), env.clone().clone(), info, exec_msg).unwrap();

	let config = PoolPairConfig::load().unwrap().unwrap();
	assert_eq!(config.admin, Addr::unchecked(new_admin).try_into().unwrap());
	assert_eq!(
		config.fee_receiver,
		Addr::unchecked(new_fee_receiver).try_into().unwrap()
	);
	assert_eq!(config.total_fee_bps, 69);
	assert_eq!(config.maker_fee_bps, 50);
}
