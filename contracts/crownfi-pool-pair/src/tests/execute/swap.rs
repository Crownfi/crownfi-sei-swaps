use cosmwasm_std::{
	coin,
	testing::{mock_env, mock_info},
	BankMsg, Decimal, SubMsg, Uint128,
};
use cw_utils::PaymentError;

use crate::{
	contract::execute,
	error::PoolPairContractError,
	msg::PoolPairExecuteMsg,
	tests::{
		deps, init, pool_balance, share_in_assets, LEFT_TOKEN_AMT, LP_TOKEN, PAIR_DENOMS, RANDOM_ADDRESS,
		RANDOM_ADDRESS2, RIGHT_TOKEN_AMT,
	},
	workarounds::total_supply_workaround,
};

#[test]
fn must_pay_only_one_of_the_pair() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::Swap {
		expected_result: None,
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};
	let info = mock_info(RANDOM_ADDRESS2, &[coin(5000, LP_TOKEN)]);
	let res = execute(deps.as_mut(), env.clone(), info, msg.clone());
	assert_eq!(
		res,
		Err(PoolPairContractError::PaymentError(PaymentError::ExtraDenom(
			LP_TOKEN.to_string()
		)))
	);

	let info = mock_info(
		RANDOM_ADDRESS2,
		&[coin(5000, PAIR_DENOMS[0]), coin(2500, PAIR_DENOMS[1])],
	);
	let res = execute(deps.as_mut(), env, info, msg);
	assert_eq!(
		res,
		Err(PoolPairContractError::PaymentError(PaymentError::MultipleDenoms {}))
	);
}

#[test]
fn slippage_tolerance_must_not_exceed_limit() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::Swap {
		expected_result: None,
		slippage_tolerance: Some(Decimal::bps(5001)),
		receiver: None,
		receiver_payload: None,
	};
	let info = mock_info(RANDOM_ADDRESS2, &[coin(500, PAIR_DENOMS[1])]);
	let res = execute(deps.as_mut(), env, info, msg);
	assert_eq!(res, Err(PoolPairContractError::ToleranceTooHigh));
}

#[test]
fn slippage_tolerance_must_be_respected() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::Swap {
		expected_result: Some(Uint128::new(900)),
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};

	let info = mock_info(RANDOM_ADDRESS2, &[coin(500, PAIR_DENOMS[1])]);
	let res = execute(deps.as_mut(), env, info, msg);
	assert!(matches!(res, Err(PoolPairContractError::SlippageTooHigh(_))));
}

#[test]
// #[ignore = "failing"]
fn swap_calculation_is_correct() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::Swap {
		expected_result: None,
		slippage_tolerance: Some(Decimal::bps(1000)),
		receiver: None,
		receiver_payload: None,
	};
	let info = mock_info(RANDOM_ADDRESS2, &[coin(50000, PAIR_DENOMS[1])]);

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	// let (return_amount, _, commission_amount) = calc_swap(50000, 1, pb, Decimal::bps(50));
	let total_shares = total_supply_workaround(LP_TOKEN);
	let share_value = share_in_assets(pb, 50000, total_shares.u128());
	let res = execute(deps.as_mut(), env.clone(), info, msg).unwrap();
	assert_eq!(
		res.messages,
		vec![
			SubMsg::new(BankMsg::Send {
				to_address: RANDOM_ADDRESS.to_string(),
				amount: vec![coin(500, PAIR_DENOMS[0])]
			}),
			SubMsg::new(BankMsg::Send {
				to_address: RANDOM_ADDRESS2.to_string(),
				amount: vec![coin(99000, PAIR_DENOMS[0])]
			})
		]
	);
	deps.querier.update_balance(
		env.contract.address,
		vec![
			coin(LEFT_TOKEN_AMT - (99000 + 500), PAIR_DENOMS[0]),
			coin(RIGHT_TOKEN_AMT + 50000, PAIR_DENOMS[1]),
		],
	);

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let total_shares = total_supply_workaround(LP_TOKEN);
	let share_value_after_swap = share_in_assets(pb.clone(), 50000, total_shares.u128());
	assert_ne!(share_value, share_value_after_swap);
}
