use cosmwasm_std::{
	coin, from_json,
	testing::{mock_env, mock_info},
	Attribute, Decimal, Timestamp, Uint128,
};

use crate::{
	contract::{execute, query},
	msg::{PoolPairExecuteMsg, PoolPairQueryMsg, VolumeQueryResponse},
	tests::{deps, init, AddressFactory, PAIR_DENOMS},
};

#[test]
fn hourly_volume_sum() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let mut env = mock_env();
	env.block.time = Timestamp::from_seconds(1725408002);

	let sender = AddressFactory::random_address();
	let amt1 = 100000;
	let info = mock_info(&sender, &[coin(amt1, PAIR_DENOMS[0])]);
	let res = execute(
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
	let maker_fee_amt1 = maker_fee_from_attrs(res.attributes);

	env.block.time = Timestamp::from_seconds(1725410702);
	let amt2 = 50000;
	let info = mock_info(&sender, &[coin(amt2, PAIR_DENOMS[1])]);
	let res = execute(
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
	let maker_fee_amt2 = maker_fee_from_attrs(res.attributes);

	env.block.time = Timestamp::from_seconds(1725411002);
	let hourly_volume_sum: VolumeQueryResponse = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::HourlyVolumeSum { past_hours: Some(1) },
		)
		.unwrap(),
	)
	.unwrap();

	assert_eq!(hourly_volume_sum.volume.each_ref().map(Uint128::u128), [0, 0]);

	env.block.time = Timestamp::from_seconds(1725411002);
	let hourly_volume_sum: VolumeQueryResponse = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::HourlyVolumeSum { past_hours: None },
		)
		.unwrap(),
	)
	.unwrap();

	assert_eq!(
		hourly_volume_sum.volume.each_ref().map(Uint128::u128),
		[amt1 + (amt2 * 2 - maker_fee_amt2), (amt1 / 2 - maker_fee_amt1) + amt2]
	);

	let hourly_volume_sum2: VolumeQueryResponse = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::HourlyVolumeSum { past_hours: None },
		)
		.unwrap(),
	)
	.unwrap();
	assert_eq!(hourly_volume_sum.volume, hourly_volume_sum2.volume);

	env.block.time = Timestamp::from_seconds(1725414000);
	let hourly_volume_sum3: VolumeQueryResponse = from_json(
		query(
			deps.as_ref(),
			env,
			PoolPairQueryMsg::HourlyVolumeSum { past_hours: Some(2) },
		)
		.unwrap(),
	)
	.unwrap();
	assert_eq!(hourly_volume_sum.volume, hourly_volume_sum3.volume);
}

#[test]
fn daily_volume_sum() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let mut env = mock_env();
	env.block.time = Timestamp::from_seconds(1725408002);

	let sender = AddressFactory::random_address();
	let amt1 = 100000;
	let info = mock_info(&sender, &[coin(amt1, PAIR_DENOMS[0])]);
	let res = execute(
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
	let maker_fee_amt1 = maker_fee_from_attrs(res.attributes);

	env.block.time = Timestamp::from_seconds(1725490800);
	let amt2 = 50000;
	let info = mock_info(&sender, &[coin(amt2, PAIR_DENOMS[1])]);
	let res = execute(
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
	let maker_fee_amt2 = maker_fee_from_attrs(res.attributes);

	env.block.time = Timestamp::from_seconds(1725493500);

	let daily_volume_sum: VolumeQueryResponse = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::DailyVolumeSum { past_days: Some(1) },
		)
		.unwrap(),
	)
	.unwrap();

	assert_eq!(daily_volume_sum.volume.each_ref().map(Uint128::u128), [0, 0]);

	let daily_volume_sum: VolumeQueryResponse = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::DailyVolumeSum { past_days: None },
		)
		.unwrap(),
	)
	.unwrap();

	assert_eq!(
		daily_volume_sum.volume.each_ref().map(Uint128::u128),
		[amt1 + (amt2 * 2 - maker_fee_amt2), (amt1 / 2 - maker_fee_amt1) + amt2]
	);

	let daily_volume_sum2: VolumeQueryResponse = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::DailyVolumeSum { past_days: None },
		)
		.unwrap(),
	)
	.unwrap();
	assert_eq!(daily_volume_sum.volume, daily_volume_sum2.volume);

	env.block.time = Timestamp::from_seconds(1725494401);
	let daily_volume_sum3: VolumeQueryResponse = from_json(
		query(
			deps.as_ref(),
			env,
			PoolPairQueryMsg::DailyVolumeSum { past_days: Some(2) },
		)
		.unwrap(),
	)
	.unwrap();
	assert_eq!(daily_volume_sum.volume, daily_volume_sum3.volume);
}

#[test]
fn total_volume_sum() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let mut env = mock_env();
	env.block.time = Timestamp::from_seconds(1725408002);

	let sender = AddressFactory::random_address();
	let amt = 100000;
	let info = mock_info(&sender, &[coin(amt, PAIR_DENOMS[0])]);
	let res = execute(
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
	let maker_fee = maker_fee_from_attrs(res.attributes);

	env.block.time = Timestamp::from_seconds(1725409802);
	let total_volume_sum: VolumeQueryResponse =
		from_json(query(deps.as_ref(), env.clone(), PoolPairQueryMsg::TotalVolumeSum).unwrap()).unwrap();

	assert_eq!(
		total_volume_sum.volume.each_ref().map(Uint128::u128),
		[amt, amt / 2 - maker_fee]
	);
}

fn maker_fee_from_attrs(attrs: Vec<Attribute>) -> u128 {
	for attr in attrs {
		if attr.key == "maker_fee_amount" {
			return attr.value.parse().unwrap();
		}
	}

	panic!("wrong attributes");
}
