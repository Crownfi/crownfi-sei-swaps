use cosmwasm_std::{coin, from_json, testing::mock_env};

use crate::{
	contract::query,
	msg::{PoolPairQueryMsg, PoolPairQuerySimulateDepositResponse},
	tests::{calc_shares, deps, init, pool_balance, share_in_assets, PAIR_DENOMS},
};

#[test]
// #[ignore = "failing with `attempt to subtract with overflow`"]
fn matches_actual_provide_liquidity_fn() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

	let simulate_provide_liquidity: PoolPairQuerySimulateDepositResponse = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::SimulateProvideLiquidity {
				offer: [coin(500, PAIR_DENOMS[0]), coin(250, PAIR_DENOMS[1])],
			},
		)
		.unwrap(),
	)
	.unwrap();
	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let share_amount = calc_shares([500, 250], pb.clone());
	let share_value = share_in_assets(deps.as_ref(), share_amount);

	assert_eq!(share_value, simulate_provide_liquidity.share_value);
	assert_eq!(share_amount, simulate_provide_liquidity.share_amount.u128());
}
