use cosmwasm_std::{coin, from_json, testing::mock_env};

use crate::{
	msg::PoolPairQueryMsg,
	tests::{deps, init, pool::PoolPairCalcNaiveSwapResult, query, PAIR_DENOMS},
};

#[test]
fn simulate_swap_assuming_infinity_liquidity() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

	let simulate_naive_swap: PoolPairCalcNaiveSwapResult = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::SimulateNaiveSwap {
				offer: coin(10000, PAIR_DENOMS[0]),
			},
		)
		.unwrap(),
	)
	.unwrap();

	assert_eq!(4950, simulate_naive_swap.result_amount.u128());
	assert_eq!(25, simulate_naive_swap.maker_fee_amount.u128());
	assert_eq!(50, simulate_naive_swap.total_fee_amount.u128());
}
