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
mod simulate_naive_swap;
mod simulate_provide_liquidity;
mod simulate_swap;
mod total_shares;

#[test]
fn queries() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

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
