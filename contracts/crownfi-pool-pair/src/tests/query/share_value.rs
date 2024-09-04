use cosmwasm_std::{
	coin, from_json,
	testing::{mock_env, mock_info},
	Coin, Decimal, Uint128,
};

use crate::{
	contract::{execute, query},
	msg::{PoolPairExecuteMsg, PoolPairQueryMsg},
	tests::{
		deps, init, inner_share_in_assets, pool_balance, AddressFactory, LEFT_TOKEN_AMT, LP_TOKEN, PAIR_DENOMS,
		RIGHT_TOKEN_AMT,
	},
	workarounds::total_supply_workaround,
};

#[test]
fn does_what_it_says() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let total_shares = total_supply_workaround(LP_TOKEN);
	let share_value = inner_share_in_assets(pb, 1000, total_shares.u128());

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
	let actual_share_value = inner_share_in_assets(pb, 1000, total_shares.u128());

	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(1000, LP_TOKEN)]);
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

	deps.querier.update_balance(
		&env.contract.address,
		vec![
			coin(LEFT_TOKEN_AMT - actual_share_value[0].amount.u128(), PAIR_DENOMS[0]),
			coin(RIGHT_TOKEN_AMT - actual_share_value[1].amount.u128(), PAIR_DENOMS[1]),
		],
	);

	let share_value_query_result: [Coin; 2] = from_json(
		query(
			deps.as_ref(),
			env,
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

	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(50000, PAIR_DENOMS[0]), coin(25100, PAIR_DENOMS[1])]);
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

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let total_shares = total_supply_workaround(LP_TOKEN);
	let expected_share_value = inner_share_in_assets([pb[0] + 50000, pb[1] + 25100], 1000, total_shares.u128());

	deps.querier.update_balance(
		&env.contract.address,
		vec![
			coin(LEFT_TOKEN_AMT + 50000, PAIR_DENOMS[0]),
			coin(RIGHT_TOKEN_AMT + 25100, PAIR_DENOMS[1]),
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

	assert_eq!(expected_share_value, share_value_query_result);
}

#[test]
fn proportionally_changes_on_swap() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(100000, PAIR_DENOMS[0])]);

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let total_shares = total_supply_workaround(LP_TOKEN);
	let expected_share_value = inner_share_in_assets([pb[0] + 100000, pb[1] - 100000 / 2], 1000, total_shares.u128());

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
			coin(LEFT_TOKEN_AMT + 100000, PAIR_DENOMS[0]),
			coin(RIGHT_TOKEN_AMT - 100000 / 2, PAIR_DENOMS[1]),
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

	assert_eq!(expected_share_value, share_value_query_result);
}
