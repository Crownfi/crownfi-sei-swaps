use cosmwasm_std::{coin, from_json, testing::mock_env};

use crate::{
	msg::PoolPairQueryMsg,
	tests::{deps, init, pool::PoolPairCalcSwapResult, query, PAIR_DENOMS},
};

#[test]
fn matches_actual_swap_function() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

	let simulate_swap: PoolPairCalcSwapResult = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::SimulateSwap {
				offer: coin(10000, PAIR_DENOMS[0]),
			},
		)
		.unwrap(),
	)
	.unwrap();

	assert_eq!(4902, simulate_swap.result_amount.u128());
	assert_eq!(49, simulate_swap.spread_amount.u128());
	assert_eq!(24, simulate_swap.maker_fee_amount.u128());
	assert_eq!(49, simulate_swap.total_fee_amount.u128());
}
