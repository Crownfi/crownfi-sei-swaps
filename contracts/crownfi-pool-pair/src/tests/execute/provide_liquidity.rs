use cosmwasm_std::{
	attr, coin,
	testing::{mock_env, mock_info},
	Addr, BankMsg, Binary, SubMsg, WasmMsg,
};
use crownfi_swaps_common::error::CrownfiSwapsCommonError;
use cw_utils::PaymentError;
use sei_cosmwasm::SeiMsg;

use crate::{
	contract::execute,
	error::PoolPairContractError,
	msg::PoolPairExecuteMsg,
	tests::{calc_shares, deps, init, pool_balance, LP_TOKEN, PAIR_DENOMS, RANDOM_ADDRESS, RANDOM_ADDRESS2},
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
	let info = mock_info(RANDOM_ADDRESS2, &[coin(50, PAIR_DENOMS[0]), coin(20, PAIR_DENOMS[1])]);
	let res = execute(deps.as_mut(), env, info, provide_liquidity_msg);

	assert_eq!(res, Err(PoolPairContractError::DepositTooImbalanced));
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

	let info = mock_info(RANDOM_ADDRESS2, &[coin(50, PAIR_DENOMS[0])]);
	let res = execute(deps.as_mut(), env.clone(), info, provide_liquidity_msg.clone());
	assert_eq!(
		res,
		Err(PoolPairContractError::SwapsCommonError(
			CrownfiSwapsCommonError::MustPayPair
		))
	);

	let info = mock_info(RANDOM_ADDRESS2, &[coin(50, PAIR_DENOMS[0]), coin(6969, LP_TOKEN)]);
	let res = execute(deps.as_mut(), env.clone(), info, provide_liquidity_msg.clone());
	assert_eq!(
		res,
		Err(PoolPairContractError::SwapsCommonError(
			CrownfiSwapsCommonError::PaymentError(PaymentError::ExtraDenom(LP_TOKEN.into()))
		))
	);

	let info = mock_info(RANDOM_ADDRESS2, &[coin(50, PAIR_DENOMS[0]), coin(0, PAIR_DENOMS[1])]);
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
	init(&mut deps);

	let provide_liquidity_msg = PoolPairExecuteMsg::ProvideLiquidity {
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};

	let env = mock_env();
	let info = mock_info(RANDOM_ADDRESS2, &[coin(50, PAIR_DENOMS[0]), coin(25, PAIR_DENOMS[1])]);
	let res = execute(deps.as_mut(), env.clone(), info.clone(), provide_liquidity_msg.clone()).unwrap();

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let lp_amt = calc_shares([50u128, 25u128], pb);

	assert_eq!(
		res.messages,
		vec![
			SubMsg::new(SeiMsg::MintTokens {
				amount: coin(lp_amt, LP_TOKEN)
			}),
			SubMsg::new(BankMsg::Send {
				to_address: RANDOM_ADDRESS2.into(),
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
	let info = mock_info(RANDOM_ADDRESS2, &assets);

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let lp_amt = calc_shares([500u128, 250u128], pb);
	execute(deps.as_mut(), env, info, provide_liquidity_msg).unwrap();
	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let lp_amt_after = calc_shares([500u128, 250u128], pb);
	assert_ne!(lp_amt, lp_amt_after);
}

#[test]
fn returns_wasm_message_when_payload_provided() {
	let mut deps = deps(&[]);
	init(&mut deps);
	let env = mock_env();

	let msg_with_payload = PoolPairExecuteMsg::ProvideLiquidity {
		slippage_tolerance: None,
		receiver: Some(Addr::unchecked(RANDOM_ADDRESS)),
		receiver_payload: Some(cosmwasm_std::Binary(b"anana".into())),
	};
	let info = mock_info(RANDOM_ADDRESS2, &[coin(50, PAIR_DENOMS[0]), coin(25, PAIR_DENOMS[1])]);

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
				contract_addr: RANDOM_ADDRESS.into(),
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

	let provide_liquidity_msg = PoolPairExecuteMsg::ProvideLiquidity {
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};

	let assets = [coin(5000, PAIR_DENOMS[0]), coin(2510, PAIR_DENOMS[1])];
	let info = mock_info(RANDOM_ADDRESS2, &assets);
	let res = execute(deps.as_mut(), env, info, provide_liquidity_msg).unwrap();

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let share = calc_shares([5000, 2510], pb);

	assert_eq!(
		res.attributes,
		vec![
			attr("action", "provide_liquidity"),
			attr("sender", RANDOM_ADDRESS2),
			attr("receiver", RANDOM_ADDRESS2),
			attr("assets", format!("{}, {}", assets[0], assets[1])),
			attr("share", share.to_string())
		]
	)
}
