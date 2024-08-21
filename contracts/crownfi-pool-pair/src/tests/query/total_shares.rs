use cosmwasm_std::{
	coin, from_json,
	testing::{mock_env, mock_info},
	Uint128,
};

use crate::{
	contract::{execute, query},
	msg::PoolPairQueryMsg,
	tests::{deps, init, LP_TOKEN, PAIR_DENOMS, RANDOM_ADDRESS},
	workarounds::total_supply_workaround,
};

use super::PoolPairExecuteMsg;

#[test]
fn must_equal_total_supply() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

	let total_shares = total_supply_workaround(LP_TOKEN);
	let total_shares_query_result: Uint128 =
		from_json(query(deps.as_ref(), env.clone(), PoolPairQueryMsg::TotalShares).unwrap()).unwrap();
	assert_eq!(total_shares, total_shares_query_result);
}

#[test]
fn increases_when_liquidity_provided() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

	let total_shares: Uint128 =
		from_json(query(deps.as_ref(), env.clone(), PoolPairQueryMsg::TotalShares).unwrap()).unwrap();

	execute(
		deps.as_mut(),
		env.clone(),
		mock_info(RANDOM_ADDRESS, &[coin(500, PAIR_DENOMS[0]), coin(250, PAIR_DENOMS[1])]),
		PoolPairExecuteMsg::ProvideLiquidity {
			slippage_tolerance: None,
			receiver: None,
			receiver_payload: None,
		},
	)
	.unwrap();

	let total_shares_after_liquidity_change: Uint128 =
		from_json(query(deps.as_ref(), env, PoolPairQueryMsg::TotalShares).unwrap()).unwrap();

	assert!(total_shares_after_liquidity_change > total_shares);
}

#[test]
#[ignore = "for some reason this test is capturing the enviroment from other tests, even on single threaded mode"]
fn decreases_when_liquidity_burned() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

	let total_shares: Uint128 =
		from_json(query(deps.as_ref(), env.clone(), PoolPairQueryMsg::TotalShares).unwrap()).unwrap();

	execute(
		deps.as_mut(),
		env.clone(),
		mock_info(RANDOM_ADDRESS, &[coin(50, LP_TOKEN)]),
		PoolPairExecuteMsg::WithdrawLiquidity {
			receiver: None,
			receiver_payload: None,
		},
	)
	.unwrap();

	let total_shares_after_liquidity_change: Uint128 =
		from_json(query(deps.as_ref(), env, PoolPairQueryMsg::TotalShares).unwrap()).unwrap();

	assert!(total_shares_after_liquidity_change < total_shares);
}
