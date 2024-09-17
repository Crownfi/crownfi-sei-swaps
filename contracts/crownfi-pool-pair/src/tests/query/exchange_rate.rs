use cosmwasm_std::{
	coin, from_json,
	testing::{mock_env, mock_info},
	Decimal, Timestamp,
};

use crate::{
	contract::{execute, query},
	msg::{ExchangeRateQueryResponse, PoolPairExecuteMsg, PoolPairQueryMsg},
	tests::{deps, init, AddressFactory, PAIR_DENOMS},
};

#[test]
fn hourly_exchange_rate() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let mut env = mock_env();
	env.block.time = Timestamp::from_seconds(1725408002);

	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(100000, PAIR_DENOMS[0])]);
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

	env.block.time = Timestamp::from_seconds(1725410702);
	let info = mock_info(&sender, &[coin(50000, PAIR_DENOMS[1])]);
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

	env.block.time = Timestamp::from_seconds(1725411002);
	let exchange_rate: ExchangeRateQueryResponse = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::ExchangeRateHourly { past_hours: Some(1) },
		)
		.unwrap(),
	)
	.unwrap();

	// The hour hasn't passed yet, so we're still at 0
	assert_eq!(exchange_rate.exchange_rate_high.to_string().as_str(), "0");
	// Approaching infinity
	assert_eq!(exchange_rate.exchange_rate_low.to_string().as_str(), "340282366920938463463.374607431768211455");
	assert_eq!(exchange_rate.exchange_rate_avg.to_string().as_str(), "340282366920938463463.374607431768211455");

	// ...but we can still get stats for the current hour so far
	let exchange_rate: ExchangeRateQueryResponse = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::ExchangeRateHourly { past_hours: None },
		)
		.unwrap(),
	)
	.unwrap();

	assert!(exchange_rate.exchange_rate_low.to_string().starts_with("0.49749"));
	assert!(exchange_rate.exchange_rate_high.to_string().starts_with("0.50251"));
	assert!(approximated_equality(
		exchange_rate.exchange_rate_avg.to_string().parse().unwrap(),
		(exchange_rate.exchange_rate_low.to_string().parse::<f64>().unwrap()
			+ exchange_rate.exchange_rate_high.to_string().parse::<f64>().unwrap())
			/ 2.0,
		3
	));

	env.block.time = Timestamp::from_seconds(1725411600);
	let exchange_rate: ExchangeRateQueryResponse = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::ExchangeRateHourly { past_hours: Some(1) },
		)
		.unwrap(),
	)
	.unwrap();

	assert!(exchange_rate.exchange_rate_low.to_string().starts_with("0.49749"));
	assert!(exchange_rate.exchange_rate_high.to_string().starts_with("0.50251"));
	assert!(approximated_equality(
		exchange_rate.exchange_rate_avg.to_string().parse().unwrap(),
		(exchange_rate.exchange_rate_low.to_string().parse::<f64>().unwrap()
			+ exchange_rate.exchange_rate_high.to_string().parse::<f64>().unwrap())
			/ 2.0,
		3
	));

	// A new hour's been started, but there are no trades yet. So the default is to return the balance ratio
	let exchange_rate2: ExchangeRateQueryResponse = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::ExchangeRateHourly { past_hours: None },
		)
		.unwrap(),
	)
	.unwrap();
	assert_eq!(exchange_rate2.exchange_rate_avg.to_string(), "0.5");
	assert_eq!(exchange_rate2.exchange_rate_low.to_string(), "0.5");
	assert_eq!(exchange_rate2.exchange_rate_high.to_string(), "0.5");

	env.block.time = Timestamp::from_seconds(1725414000);
	let exchange_rate3: ExchangeRateQueryResponse = from_json(
		query(
			deps.as_ref(),
			env,
			PoolPairQueryMsg::ExchangeRateHourly { past_hours: Some(2) },
		)
		.unwrap(),
	)
	.unwrap();
	assert_eq!(exchange_rate.exchange_rate_avg, exchange_rate3.exchange_rate_avg);
	assert_eq!(exchange_rate.exchange_rate_low, exchange_rate3.exchange_rate_low);
	assert_eq!(exchange_rate.exchange_rate_high, exchange_rate3.exchange_rate_high);
}

#[test]
fn daily_exchange_rate() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let mut env = mock_env();
	env.block.time = Timestamp::from_seconds(1725408002);

	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(100000, PAIR_DENOMS[0])]);
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

	env.block.time = Timestamp::from_seconds(1725490800);
	let info = mock_info(&sender, &[coin(50000, PAIR_DENOMS[1])]);
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

	env.block.time = Timestamp::from_seconds(1725493500);
	let exchange_rate: ExchangeRateQueryResponse = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::ExchangeRateDaily { past_days: Some(1) },
		)
		.unwrap(),
	)
	.unwrap();

	// The day hasn't passed yet, so we're still at 0
	assert_eq!(exchange_rate.exchange_rate_high.to_string().as_str(), "0");
	// Approaching infinity
	assert_eq!(exchange_rate.exchange_rate_low.to_string().as_str(), "340282366920938463463.374607431768211455");
	assert_eq!(exchange_rate.exchange_rate_avg.to_string().as_str(), "340282366920938463463.374607431768211455");
	
	// ...but we can still get stats for the current day so far.
	let exchange_rate: ExchangeRateQueryResponse = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::ExchangeRateDaily { past_days: None },
		)
		.unwrap(),
	)
	.unwrap();
	assert!(exchange_rate.exchange_rate_low.to_string().starts_with("0.49749"));
	assert!(exchange_rate.exchange_rate_high.to_string().starts_with("0.50251"));
	assert!(approximated_equality(
		exchange_rate.exchange_rate_avg.to_string().parse().unwrap(),
		(exchange_rate.exchange_rate_low.to_string().parse::<f64>().unwrap()
			+ exchange_rate.exchange_rate_high.to_string().parse::<f64>().unwrap())
			/ 2.0,
		3
	));

	// It is now the next day
	env.block.time = Timestamp::from_seconds(1725494400);
	let exchange_rate: ExchangeRateQueryResponse = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::ExchangeRateDaily { past_days: Some(1) },
		)
		.unwrap(),
	)
	.unwrap();
	assert!(exchange_rate.exchange_rate_low.to_string().starts_with("0.49749"));
	assert!(exchange_rate.exchange_rate_high.to_string().starts_with("0.50251"));
	assert!(approximated_equality(
		exchange_rate.exchange_rate_avg.to_string().parse().unwrap(),
		(exchange_rate.exchange_rate_low.to_string().parse::<f64>().unwrap()
			+ exchange_rate.exchange_rate_high.to_string().parse::<f64>().unwrap())
			/ 2.0,
		3
	));

	// A new day's been started, but there are no trades yet. So the default is to return the balance ratio
	let exchange_rate2: ExchangeRateQueryResponse = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::ExchangeRateDaily { past_days: None },
		)
		.unwrap(),
	)
	.unwrap();
	assert_eq!(exchange_rate2.exchange_rate_avg.to_string(), "0.5");
	assert_eq!(exchange_rate2.exchange_rate_low.to_string(), "0.5");
	assert_eq!(exchange_rate2.exchange_rate_high.to_string(), "0.5");

	env.block.time = Timestamp::from_seconds(1725494401);
	let exchange_rate3: ExchangeRateQueryResponse = from_json(
		query(
			deps.as_ref(),
			env,
			PoolPairQueryMsg::ExchangeRateDaily { past_days: Some(2) },
		)
		.unwrap(),
	)
	.unwrap();
	assert_eq!(exchange_rate.exchange_rate_avg, exchange_rate3.exchange_rate_avg);
	assert_eq!(exchange_rate.exchange_rate_low, exchange_rate3.exchange_rate_low);
	assert_eq!(exchange_rate.exchange_rate_high, exchange_rate3.exchange_rate_high);
}

#[test]
fn exchange_rate_all_time() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let mut env = mock_env();
	env.block.time = Timestamp::from_seconds(1725408002);

	let sender = AddressFactory::random_address();
	let amt = 100000;
	let info = mock_info(&sender, &[coin(amt, PAIR_DENOMS[0])]);
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

	env.block.time = Timestamp::from_seconds(1725409802);
	let exchange_rate: ExchangeRateQueryResponse =
		from_json(query(deps.as_ref(), env.clone(), PoolPairQueryMsg::ExchangeRateAllTime).unwrap()).unwrap();

	assert!(exchange_rate.exchange_rate_high.to_string().starts_with("0.49749"));
	assert!(exchange_rate.exchange_rate_low.to_string().starts_with("0.49749"));
	assert!(approximated_equality(
		exchange_rate.exchange_rate_avg.to_string().parse().unwrap(),
		(exchange_rate.exchange_rate_low.to_string().parse::<f64>().unwrap()
			+ exchange_rate.exchange_rate_high.to_string().parse::<f64>().unwrap())
			/ 2.0,
		3
	));
}

fn approximated_equality(a: f64, b: f64, decimals: i32) -> bool {
	let f = 10.0f64.powi(decimals);
	let a = (a * f).trunc();
	let b = (b * f).trunc();
	a == b
}
