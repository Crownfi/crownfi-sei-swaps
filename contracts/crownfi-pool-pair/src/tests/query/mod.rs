use cosmwasm_std::{
	coin,
	testing::{mock_env, mock_info},
};

use crate::{
	contract::execute,
	msg::*,
	tests::{deps, init, LP_TOKEN, PAIR_DENOMS, RANDOM_ADDRESS2},
};

mod basic_queries;
mod share_value;
mod total_shares;

#[test]
fn queries() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

	// XXX: FAILS WITH `ATTEMPT TO SUBTRACT WITH OVERFLOW`
	#[cfg(feature = "failing-tests")]
	{
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
		let share_amount = calc_shares([500, 250], pb);
		assert_eq!(share_value, simulate_provide_liquidity.share_value);
		assert_eq!(share_amount, simulate_provide_liquidity.share_amount.u128());
	}

	// XXX: same reason as the `swap()` tests
	#[cfg(feature = "failing-tests")]
	{
		use pool::{PoolPairCalcNaiveSwapResult, PoolPairCalcSwapResult};

		let simulate_swap: PoolPairCalcSwapResult = from_json(
			query(
				deps.as_ref(),
				env.clone(),
				PoolPairQueryMsg::SimulateSwap {
					offer: coin(1000, PAIR_DENOMS[0]),
				},
			)
			.unwrap(),
		)
		.unwrap();
		let pb = pool_balance(PAIR_DENOMS, &deps.querier);
		let (return_, spread, commission) = calc_swap(1000, 0, pb, Decimal::bps(50));
		assert_eq!(return_, simulate_swap.result_amount);
		assert_eq!(spread, simulate_swap.spread_amount);
		assert_eq!(commission, simulate_swap.maker_fee_amount);
		assert_eq!(commission.u128() * 2, simulate_swap.total_fee_amount.u128());

		let simulate_naive_swap: PoolPairCalcNaiveSwapResult = from_json(
			query(
				deps.as_ref(),
				env.clone(),
				PoolPairQueryMsg::SimulateNaiveSwap {
					offer: coin(1000, PAIR_DENOMS[0]),
				},
			)
			.unwrap(),
		)
		.unwrap();
		let pb = pool_balance(PAIR_DENOMS, &deps.querier);
		let (return_, spread, commission) = calc_swap(1000, 0, pb, Decimal::bps(50));
		let (return_, commission) = (
			return_ - spread * Decimal::bps(100),
			commission + spread * Decimal::bps(50),
		);
		assert_eq!(return_, simulate_naive_swap.result_amount);
		assert_eq!(commission, simulate_naive_swap.maker_fee_amount);
		assert_eq!(
			commission.u128() * 2 + spread.u128(),
			simulate_naive_swap.total_fee_amount.u128()
		);
	}

	execute(
		deps.as_mut(),
		env.clone(),
		mock_info(
			RANDOM_ADDRESS2,
			&[coin(1000, PAIR_DENOMS[0]), coin(500, PAIR_DENOMS[1])],
		),
		PoolPairExecuteMsg::ProvideLiquidity {
			slippage_tolerance: None,
			receiver: None,
			receiver_payload: None,
		},
	)
	.unwrap();
	execute(
		deps.as_mut(),
		env.clone(),
		mock_info(RANDOM_ADDRESS2, &[coin(500, LP_TOKEN)]),
		PoolPairExecuteMsg::WithdrawLiquidity {
			receiver: None,
			receiver_payload: None,
		},
	)
	.unwrap();
	execute(
		deps.as_mut(),
		env.clone(),
		mock_info(RANDOM_ADDRESS2, &[coin(1000, PAIR_DENOMS[1])]),
		PoolPairExecuteMsg::Swap {
			expected_result: None,
			slippage_tolerance: None,
			receiver: None,
			receiver_payload: None,
		},
	)
	.unwrap();

	// panicking cuz of parsing errors
	// TODO: properly implement those tests once the feature is implemented
	#[cfg(feature = "failing-tests")]
	{
		let hourly_volume_sum: VolumeQueryResponse = from_json(
			query(
				deps.as_ref(),
				env.clone(),
				PoolPairQueryMsg::HourlyVolumeSum { past_hours: Some(1) },
			)
			.unwrap(),
		)
		.unwrap();
		assert_eq!(hourly_volume_sum.volume, [Uint128::zero(), Uint128::zero()]);

		let daily_volume_sum: VolumeQueryResponse = from_json(
			query(
				deps.as_ref(),
				env.clone(),
				PoolPairQueryMsg::DailyVolumeSum { past_days: Some(1) },
			)
			.unwrap(),
		)
		.unwrap();
		assert_eq!(daily_volume_sum.volume, [Uint128::zero(), Uint128::zero()]);

		let total_volume_sum: VolumeQueryResponse =
			from_json(query(deps.as_ref(), env.clone(), PoolPairQueryMsg::TotalVolumeSum).unwrap()).unwrap();
		assert_eq!(total_volume_sum.volume, [Uint128::zero(), Uint128::zero()]);
	}
}
