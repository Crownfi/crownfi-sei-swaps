use cosmwasm_std::{
	attr, coin,
	testing::{mock_env, mock_info},
	Addr, BankMsg, Binary, Decimal, SubMsg, Uint128, WasmMsg,
};
use crownfi_swaps_common::error::CrownfiSwapsCommonError;
use cw_utils::PaymentError;
use sei_cosmwasm::SeiMsg;

use crate::{
	contract::execute,
	error::PoolPairContractError,
	msg::PoolPairExecuteMsg,
	tests::{
		calc_shares, deps, init, pool_balance, AddressFactory, LEFT_TOKEN_AMT, LP_TOKEN, PAIR_DENOMS, RIGHT_TOKEN_AMT,
	},
	workarounds::total_supply_workaround,
};

#[test]
fn slipage_tolerance_must_not_exceed_limit() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let provide_liquidity_msg = PoolPairExecuteMsg::ProvideLiquidity {
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};

	let env = mock_env();
	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(50, PAIR_DENOMS[0]), coin(24, PAIR_DENOMS[1])]);
	let res = execute(deps.as_mut(), env, info, provide_liquidity_msg);

	assert_eq!(res, Err(PoolPairContractError::DepositTooImbalanced));

	// This level of imbalance doesn't work for the default tolerance, but will still succeed with an explicitly set one
	let provide_liquidity_msg = PoolPairExecuteMsg::ProvideLiquidity {
		slippage_tolerance: Some(Decimal::bps(1000)),
		receiver: None,
		receiver_payload: None,
	};

	let env = mock_env();
	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(50, PAIR_DENOMS[0]), coin(24, PAIR_DENOMS[1])]);
	let res = execute(deps.as_mut(), env, info, provide_liquidity_msg);
	assert!(dbg!(res).is_ok());
}

#[test]
fn must_be_given_both_tokens() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let provide_liquidity_msg = PoolPairExecuteMsg::ProvideLiquidity {
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};

	let env = mock_env();

	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(50, PAIR_DENOMS[0])]);
	let res = execute(deps.as_mut(), env.clone(), info, provide_liquidity_msg.clone());
	assert_eq!(
		res,
		Err(PoolPairContractError::SwapsCommonError(
			CrownfiSwapsCommonError::MustPayPair
		))
	);

	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(50, PAIR_DENOMS[0]), coin(6969, LP_TOKEN)]);
	let res = execute(deps.as_mut(), env.clone(), info, provide_liquidity_msg.clone());
	assert_eq!(
		res,
		Err(PoolPairContractError::SwapsCommonError(
			CrownfiSwapsCommonError::PaymentError(PaymentError::ExtraDenom(LP_TOKEN.into()))
		))
	);

	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(50, PAIR_DENOMS[0]), coin(0, PAIR_DENOMS[1])]);
	let res = execute(deps.as_mut(), env, info, provide_liquidity_msg);
	assert_eq!(
		res,
		Err(PoolPairContractError::SwapsCommonError(
			CrownfiSwapsCommonError::PaymentIsZero
		))
	);
}

#[test]
fn shares_are_correctly_minted_and_sent() {
	let mut deps = deps(&[]);
	// set's the contract balance to (1000000left, 500000right)
	init(&mut deps);

	let provide_liquidity_msg = PoolPairExecuteMsg::ProvideLiquidity {
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};

	let env = mock_env();
	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(50, PAIR_DENOMS[0]), coin(25, PAIR_DENOMS[1])]);
	let res = execute(deps.as_mut(), env, info, provide_liquidity_msg).unwrap();

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let lp_amt = calc_shares([50, 25], pb);

	assert_eq!(
		res.messages,
		vec![
			SubMsg::new(SeiMsg::MintTokens {
				amount: coin(lp_amt, LP_TOKEN)
			}),
			SubMsg::new(BankMsg::Send {
				to_address: sender.into(),
				amount: vec![coin(lp_amt, LP_TOKEN)]
			})
		]
	);
}

#[test]
fn contract_is_aware_of_new_shares() {
	let mut deps = deps(&[]);
	init(&mut deps);
	let env = mock_env();

	let provide_liquidity_msg = PoolPairExecuteMsg::ProvideLiquidity {
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};

	let assets = [coin(5000, PAIR_DENOMS[0]), coin(2510, PAIR_DENOMS[1])];
	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &assets);

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let total_supply = total_supply_workaround(LP_TOKEN);
	let lp_amt = calc_shares([500, 250], pb.clone());
	let expected_lp_amt = std::cmp::min(
		Uint128::new(500).multiply_ratio(total_supply.u128() + lp_amt, pb[0] - 500),
		Uint128::new(250).multiply_ratio(total_supply.u128() + lp_amt, pb[1] - 250),
	)
	.u128();

	execute(deps.as_mut(), env.clone(), info, provide_liquidity_msg).unwrap();
	deps.querier.update_balance(
		env.contract.address,
		vec![
			coin(LEFT_TOKEN_AMT + 5000, PAIR_DENOMS[0]),
			coin(RIGHT_TOKEN_AMT + 2510, PAIR_DENOMS[1]),
		],
	);

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let lp_amt_after = calc_shares([500, 250], pb);

	assert_eq!(lp_amt_after, expected_lp_amt);
}

#[test]
fn returns_wasm_message_when_payload_provided() {
	let mut deps = deps(&[]);
	init(&mut deps);
	let env = mock_env();

	let receiver = AddressFactory::random_address();
	let msg_with_payload = PoolPairExecuteMsg::ProvideLiquidity {
		slippage_tolerance: None,
		receiver: Some(Addr::unchecked(&receiver)),
		receiver_payload: Some(cosmwasm_std::Binary(b"anana".into())),
	};
	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(50, PAIR_DENOMS[0]), coin(25, PAIR_DENOMS[1])]);

	let res = execute(deps.as_mut(), env, info, msg_with_payload).unwrap();
	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let lp_amt = calc_shares([50u128, 25u128], pb);
	assert_eq!(
		res.messages,
		vec![
			SubMsg::new(SeiMsg::MintTokens {
				amount: coin(lp_amt, LP_TOKEN)
			}),
			SubMsg::new(WasmMsg::Execute {
				contract_addr: receiver.into(),
				msg: Binary(b"anana".into()),
				funds: vec![coin(lp_amt, LP_TOKEN)]
			})
		]
	);
}

#[test]
fn events_emitted_correctly() {
	let mut deps = deps(&[]);
	init(&mut deps);
	let env = mock_env();

	let receiver = AddressFactory::random_address();
	let provide_liquidity_msg = PoolPairExecuteMsg::ProvideLiquidity {
		slippage_tolerance: None,
		receiver: Some(Addr::unchecked(&receiver)),
		receiver_payload: None,
	};

	let assets = [coin(5000, PAIR_DENOMS[0]), coin(2510, PAIR_DENOMS[1])];
	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &assets);
	let res = execute(deps.as_mut(), env, info, provide_liquidity_msg).unwrap();

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let share = calc_shares([5000, 2510], pb);

	assert_eq!(
		res.attributes,
		vec![
			attr("action", "provide_liquidity"),
			attr("sender", &sender),
			attr("receiver", &receiver),
			attr("assets", format!("{}, {}", assets[0], assets[1])),
			attr("share", share.to_string())
		]
	)
}
