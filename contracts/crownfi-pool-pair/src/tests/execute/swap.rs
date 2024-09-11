use cosmwasm_std::{
	attr, coin,
	testing::{mock_env, mock_info},
	Addr, BankMsg, CosmosMsg, Decimal, SubMsg, Uint128,
};
use cw_utils::PaymentError;

use crate::{
	contract::execute,
	error::PoolPairContractError,
	msg::PoolPairExecuteMsg,
	tests::{
		deps, init, inner_share_in_assets, pool_balance, share_in_assets, AddressFactory, PoolPairConfig,
		LEFT_TOKEN_AMT, LP_TOKEN, PAIR_DENOMS, RIGHT_TOKEN_AMT,
	},
	workarounds::total_supply_workaround,
};

#[test]
fn must_pay_only_one_of_the_pair() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::Swap {
		expected_result: None,
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};
	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(5000, LP_TOKEN)]);
	let res = execute(deps.as_mut(), env.clone(), info, msg.clone());
	assert_eq!(
		res,
		Err(PoolPairContractError::PaymentError(PaymentError::ExtraDenom(
			LP_TOKEN.to_string()
		)))
	);

	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(5000, PAIR_DENOMS[0]), coin(2500, PAIR_DENOMS[1])]);
	let res = execute(deps.as_mut(), env, info, msg);
	assert_eq!(
		res,
		Err(PoolPairContractError::PaymentError(PaymentError::MultipleDenoms {}))
	);
}

#[test]
fn slippage_tolerance_must_not_exceed_limit() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::Swap {
		expected_result: None,
		slippage_tolerance: Some(Decimal::bps(5001)),
		receiver: None,
		receiver_payload: None,
	};
	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(500, PAIR_DENOMS[1])]);
	let res = execute(deps.as_mut(), env.clone(), info.clone(), msg);
	assert_eq!(res, Err(PoolPairContractError::ToleranceTooHigh));

	let msg = PoolPairExecuteMsg::Swap {
		expected_result: None,
		slippage_tolerance: Some(Decimal::bps(5000)),
		receiver: None,
		receiver_payload: None,
	};
	let res = execute(deps.as_mut(), env, info, msg);
	assert!(res.is_ok());
}

#[test]
fn slippage_tolerance_must_be_respected() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::Swap {
		expected_result: Some(Uint128::new(990)),
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};

	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(500, PAIR_DENOMS[1])]);
	let res = execute(deps.as_mut(), env.clone(), info.clone(), msg);
	assert!(matches!(res, Err(PoolPairContractError::SlippageTooHigh(_))));

	// the same operation also works with a different slippage
	let msg = PoolPairExecuteMsg::Swap {
		expected_result: Some(Uint128::new(990)),
		slippage_tolerance: Some(Decimal::bps(1000)),
		receiver: None,
		receiver_payload: None,
	};

	let res = execute(deps.as_mut(), env, info, msg);
	assert!(res.is_ok());
}

#[test]
fn swap_calculation_is_correct() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::Swap {
		expected_result: None,
		slippage_tolerance: Some(Decimal::bps(1000)),
		receiver: None,
		receiver_payload: None,
	};
	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(50000, PAIR_DENOMS[1])]);

	let share_value = share_in_assets(deps.as_ref(), 50000);
	let res = execute(deps.as_mut(), env.clone(), info, msg).unwrap();
	assert_eq!(
		res.messages,
		vec![
			SubMsg::new(BankMsg::Send {
				to_address: AddressFactory::FEE_RECEIVER.into(),
				amount: vec![coin(500, PAIR_DENOMS[0])]
			}),
			SubMsg::new(BankMsg::Send {
				to_address: sender.to_string(),
				amount: vec![coin(99000, PAIR_DENOMS[0])]
			})
		]
	);
	deps.querier.update_balance(
		env.contract.address,
		vec![
			coin(LEFT_TOKEN_AMT - (99000 + 500), PAIR_DENOMS[0]),
			coin(RIGHT_TOKEN_AMT + 50000, PAIR_DENOMS[1]),
		],
	);

	let share_value_after_swap = share_in_assets(deps.as_ref(), 50000);
	assert_ne!(share_value, share_value_after_swap);
}

#[test]
fn naive_result_is_used_when_expected_result_is_unspecified() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::Swap {
		expected_result: Some(Uint128::new(1200)),
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};

	let msg_without_expected_result = PoolPairExecuteMsg::Swap {
		expected_result: None,
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};

	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(500, PAIR_DENOMS[1])]);
	let res = execute(deps.as_mut(), env.clone(), info.clone(), msg);
	// fails since the slippage being calculated uses a way higher expected output of tokens, exceeding it's limit
	assert!(matches!(res, Err(PoolPairContractError::SlippageTooHigh(_))));
	let res = execute(deps.as_mut(), env, info, msg_without_expected_result);
	assert!(res.is_ok());
}

#[test]
fn maker_fee_sent_to_correct_address() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::Swap {
		expected_result: None,
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};

	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(500, PAIR_DENOMS[1])]);
	let res = execute(deps.as_mut(), env, info, msg).unwrap();

	let pool_conf = PoolPairConfig::load_non_empty().unwrap();
	assert_eq!(
		res.messages[0],
		SubMsg::new(BankMsg::Send {
			to_address: pool_conf.fee_receiver.to_string(),
			amount: vec![coin(5, PAIR_DENOMS[0])]
		})
	)
}

#[test]
fn pool_fees_stay_within_pool() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::Swap {
		expected_result: None,
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};

	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(500, PAIR_DENOMS[1])]);

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let naive: Uint128 = Uint128::new(500)
		.full_mul(pb[0])
		.checked_div(pb[1].into())
		.unwrap()
		.try_into()
		.unwrap();

	let res = execute(deps.as_mut(), env, info, msg).unwrap();

	let spread_amt = res
		.attributes
		.iter()
		.find(|x| x.key == "spread_amount")
		.unwrap()
		.value
		.parse::<u128>()
		.unwrap();

	let expected_sent_plus_fees = naive.u128() - spread_amt;

	let total_sent = res
		.messages
		.into_iter()
		.filter_map(|x| match x.msg {
			CosmosMsg::Bank(BankMsg::Send { amount, .. }) => Some(amount[0].amount),
			_ => None,
		})
		.sum::<Uint128>();

	assert!(total_sent.u128() < expected_sent_plus_fees);
}

#[test]
fn events_emitted_with_correct_values() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let receiver = AddressFactory::random_address();
	let msg = PoolPairExecuteMsg::Swap {
		expected_result: None,
		slippage_tolerance: None,
		receiver: Some(Addr::unchecked(&receiver)),
		receiver_payload: None,
	};
	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(500, PAIR_DENOMS[1])]);
	let res = execute(deps.as_mut(), env, info, msg).unwrap();

	assert_eq!(
		res.attributes,
		vec![
			attr("action", "swap"),
			attr("sender", &sender),
			attr("receiver", &receiver),
			attr("in_coin", coin(500, PAIR_DENOMS[1]).to_string()),
			attr("out_coin", coin(990, PAIR_DENOMS[0]).to_string()),
			attr("spread_amount", "1"),
			attr("total_fee_amount", "10"),
			attr("maker_fee_amount", "5"),
		]
	);
}

#[test]
fn share_values_correctly_updated() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::Swap {
		expected_result: None,
		slippage_tolerance: Some(Decimal::bps(1000)),
		receiver: None,
		receiver_payload: None,
	};
	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(10000, PAIR_DENOMS[1])]);

	let total_supply = total_supply_workaround(LP_TOKEN);
	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let res = execute(deps.as_mut(), env.clone(), info, msg).unwrap();

	let total_sent = res
		.messages
		.into_iter()
		.filter_map(|x| match x.msg {
			CosmosMsg::Bank(BankMsg::Send { amount, .. }) => Some(amount[0].amount),
			_ => None,
		})
		.sum::<Uint128>();

	let expected_share_value =
		inner_share_in_assets([pb[0] - total_sent.u128(), pb[1] + 10000], 1000, total_supply.u128());

	deps.querier.update_balance(
		&env.contract.address,
		vec![
			coin(LEFT_TOKEN_AMT - total_sent.u128(), PAIR_DENOMS[0]),
			coin(RIGHT_TOKEN_AMT + 10000, PAIR_DENOMS[1]),
		],
	);

	let new_share_value = share_in_assets(deps.as_ref(), 1000);
	assert_eq!(new_share_value, expected_share_value);
}
