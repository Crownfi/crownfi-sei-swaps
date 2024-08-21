use cosmwasm_std::{
	coin, from_json,
	testing::{mock_env, mock_info},
	Coin, Decimal, Uint128,
};

use crate::{
	contract::{execute, query},
	msg::{PoolPairExecuteMsg, PoolPairQueryMsg},
	tests::{calc_swap, deps, init, pool_balance, share_in_assets, LP_TOKEN, ONE_BILLION, PAIR_DENOMS, RANDOM_ADDRESS},
	workarounds::total_supply_workaround,
};

#[test]
fn does_what_it_says() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let total_shares = total_supply_workaround(LP_TOKEN);
	let share_value = share_in_assets(pb, 1000, total_shares.u128());

	let share_value_query_result: [Coin; 2] = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::ShareValue {
				amount: Uint128::new(1000),
			},
		)
		.unwrap(),
	)
	.unwrap();
	assert_eq!(share_value, share_value_query_result);
}

#[test]
fn does_not_change_with_decreased_liquidity() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let total_shares = total_supply_workaround(LP_TOKEN);
	let actual_share_value = share_in_assets(pb, 1000, total_shares.u128());

	let info = mock_info(RANDOM_ADDRESS, &[coin(500, LP_TOKEN)]);
	execute(
		deps.as_mut(),
		env.clone(),
		info,
		PoolPairExecuteMsg::WithdrawLiquidity {
			receiver: None,
			receiver_payload: None,
		},
	)
	.unwrap();

	let share_value_query_result: [Coin; 2] = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::ShareValue {
				amount: Uint128::new(1000),
			},
		)
		.unwrap(),
	)
	.unwrap();

	assert_eq!(actual_share_value, share_value_query_result);
}

#[test]
fn proportionally_changes_if_imbalanced_liquidity_provided() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let total_shares = total_supply_workaround(LP_TOKEN);
	let actual_share_value = share_in_assets(pb, 1000, total_shares.u128());

	let info = mock_info(
		RANDOM_ADDRESS,
		&[coin(50000, PAIR_DENOMS[0]), coin(25100, PAIR_DENOMS[1])],
	);
	execute(
		deps.as_mut(),
		env.clone(),
		info,
		PoolPairExecuteMsg::ProvideLiquidity {
			slippage_tolerance: None,
			receiver: None,
			receiver_payload: None,
		},
	)
	.unwrap();

	let share_value_query_result: [Coin; 2] = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::ShareValue {
				amount: Uint128::new(1000),
			},
		)
		.unwrap(),
	)
	.unwrap();

	assert_ne!(actual_share_value, share_value_query_result);
}

#[test]
fn proportionally_changes_on_swap() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let total_shares = total_supply_workaround(LP_TOKEN);
	let actual_share_value = share_in_assets(pb.clone(), 1000, total_shares.u128());
	let (return_, _, commission) = calc_swap(100000, 0, pb, Decimal::bps(100));

	let info = mock_info(RANDOM_ADDRESS, &[coin(100000, PAIR_DENOMS[0])]);
	execute(
		deps.as_mut(),
		env.clone(),
		info,
		PoolPairExecuteMsg::Swap {
			expected_result: None,
			slippage_tolerance: Some(Decimal::bps(1000)),
			receiver: None,
			receiver_payload: None,
		},
	)
	.unwrap();
	deps.querier.update_balance(
		env.contract.address.clone(),
		vec![
			coin(ONE_BILLION + 100000, PAIR_DENOMS[0]),
			coin(ONE_BILLION / 2 - (return_ + commission).u128(), PAIR_DENOMS[1]),
		],
	);

	let share_value_query_result: [Coin; 2] = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::ShareValue {
				amount: Uint128::new(1000),
			},
		)
		.unwrap(),
	)
	.unwrap();

	assert_ne!(actual_share_value, share_value_query_result);
}
