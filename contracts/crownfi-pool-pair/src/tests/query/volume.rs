use cosmwasm_std::{from_json, testing::mock_env, Uint128};

use crate::{
	contract::query,
	msg::{PoolPairQueryMsg, VolumeQueryResponse},
	tests::{deps, init},
};

#[test]
#[ignore = "contract side code not implemented"]
fn hoyrly_volume_sum() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

	let hourly_volume_sum: VolumeQueryResponse = from_json(
		query(
			deps.as_ref(),
			env,
			PoolPairQueryMsg::HourlyVolumeSum { past_hours: Some(1) },
		)
		.unwrap(),
	)
	.unwrap();
	assert_eq!(hourly_volume_sum.volume, [Uint128::zero(), Uint128::zero()]);
}

#[test]
#[ignore = "contract side code not implemented"]
fn daily_volume_sum() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

	let daily_volume_sum: VolumeQueryResponse = from_json(
		query(
			deps.as_ref(),
			env,
			PoolPairQueryMsg::DailyVolumeSum { past_days: Some(1) },
		)
		.unwrap(),
	)
	.unwrap();
	assert_eq!(daily_volume_sum.volume, [Uint128::zero(), Uint128::zero()]);
}

#[test]
#[ignore = "contract side code not implemented"]
fn total_volume_sum() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

	let total_volume_sum: VolumeQueryResponse =
		from_json(query(deps.as_ref(), env.clone(), PoolPairQueryMsg::TotalVolumeSum).unwrap()).unwrap();
	assert_eq!(total_volume_sum.volume, [Uint128::zero(), Uint128::zero()]);
}
