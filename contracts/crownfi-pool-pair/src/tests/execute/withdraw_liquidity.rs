use cosmwasm_std::{
	attr, coin,
	testing::{mock_env, mock_info},
	Addr, BankMsg, Binary, SubMsg, Uint128, WasmMsg,
};
use crownfi_swaps_common::error::CrownfiSwapsCommonError;
use cw_utils::PaymentError;

use crate::{
	contract::execute,
	error::PoolPairContractError,
	msg::PoolPairExecuteMsg,
	tests::{
		calc_shares, deps, init, pool_balance, share_in_assets, LP_TOKEN, PAIR_DENOMS, RANDOM_ADDRESS, RANDOM_ADDRESS2,
	},
	workarounds::total_supply_workaround,
};

#[test]
fn only_accept_lp_tokens() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let msg = PoolPairExecuteMsg::WithdrawLiquidity {
		receiver: None,
		receiver_payload: None,
	};

	let env = mock_env();
	let info = mock_info(RANDOM_ADDRESS2, &[coin(50, PAIR_DENOMS[0])]);

	let response = execute(deps.as_mut(), env.clone(), info, msg.clone());
	assert_eq!(
		response,
		Err(PoolPairContractError::PaymentError(PaymentError::MissingDenom(
			LP_TOKEN.to_string()
		)))
	);

	let info = mock_info(RANDOM_ADDRESS2, &[coin(50, PAIR_DENOMS[0]), coin(50, LP_TOKEN)]);
	let response = execute(deps.as_mut(), env, info, msg);
	assert_eq!(
		response,
		Err(PoolPairContractError::PaymentError(PaymentError::MultipleDenoms {}))
	);
}

#[test]
fn error_when_payout_is_zero() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::WithdrawLiquidity {
		receiver: None,
		receiver_payload: None,
	};

	let info = mock_info(RANDOM_ADDRESS2, &[coin(1, LP_TOKEN)]);
	let response = execute(deps.as_mut(), env, info, msg);

	assert_eq!(
		response,
		Err(PoolPairContractError::SwapsCommonError(
			CrownfiSwapsCommonError::PayoutIsZero
		))
	);
}

#[test]
fn burn_lp_token_and_return_proportional_share_value() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::WithdrawLiquidity {
		receiver: None,
		receiver_payload: None,
	};

	let info = mock_info(RANDOM_ADDRESS2, &[coin(500, LP_TOKEN)]);

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let total_share = total_supply_workaround(LP_TOKEN);
	let assets = share_in_assets(pb, 500, total_share.u128());

	let response = execute(deps.as_mut(), env.clone(), info.clone(), msg.clone()).unwrap();
	assert_eq!(
		response.messages,
		vec![
			SubMsg::new(BankMsg::Burn {
				amount: vec![coin(500, LP_TOKEN)]
			}),
			SubMsg::new(BankMsg::Send {
				to_address: RANDOM_ADDRESS2.into(),
				amount: assets.into()
			})
		]
	);
}

#[test]
fn value_of_share_doesnt_change() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let total_share = total_supply_workaround(LP_TOKEN);
	let assets = share_in_assets(pb, 500, total_share.u128());
	let share_values = calc_shares(assets.clone().map(|x| x.amount.u128()), pb);

	execute(
		deps.as_mut(),
		mock_env(),
		mock_info(RANDOM_ADDRESS2, &[coin(500, LP_TOKEN)]),
		PoolPairExecuteMsg::WithdrawLiquidity {
			receiver: None,
			receiver_payload: None,
		},
	)
	.unwrap();

	let total_share_after = total_supply_workaround(LP_TOKEN);
	assert_eq!(total_share - Uint128::new(500), total_share_after);
	let new_share_values = calc_shares(assets.clone().map(|x| x.amount.u128()), pb);
	assert_eq!(share_values, new_share_values);
}

#[test]
fn returns_wasm_message_when_payload_provided() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let total_share = total_supply_workaround(LP_TOKEN);
	let assets = share_in_assets(pb, 500, total_share.u128());
	let response = execute(
		deps.as_mut(),
		mock_env(),
		mock_info(RANDOM_ADDRESS2, &[coin(500, LP_TOKEN)]),
		PoolPairExecuteMsg::WithdrawLiquidity {
			receiver: Some(Addr::unchecked(RANDOM_ADDRESS)),
			receiver_payload: Some(Binary(b"anana".into())),
		},
	)
	.unwrap();

	assert_eq!(
		response.messages,
		vec![
			SubMsg::new(BankMsg::Burn {
				amount: vec![coin(500, LP_TOKEN)]
			}),
			SubMsg::new(WasmMsg::Execute {
				contract_addr: RANDOM_ADDRESS.into(),
				msg: Binary(b"anana".into()),
				funds: assets.into()
			})
		]
	);
}

#[test]
fn events_emitted_correctly() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let total_share = total_supply_workaround(LP_TOKEN);
	let assets = share_in_assets(pb, 500, total_share.u128());
	let response = execute(
		deps.as_mut(),
		mock_env(),
		mock_info(RANDOM_ADDRESS2, &[coin(500, LP_TOKEN)]),
		PoolPairExecuteMsg::WithdrawLiquidity {
			receiver: Some(Addr::unchecked(RANDOM_ADDRESS)),
			receiver_payload: Some(Binary(b"anana".into())),
		},
	)
	.unwrap();

	assert_eq!(
		response.attributes,
		vec![
			attr("action", "withdraw_liquidity"),
			attr("sender", RANDOM_ADDRESS2),
			attr("receiver", RANDOM_ADDRESS),
			attr("withdrawn_share", "500"),
			attr("refund_assets", format!("{}, {}", assets[0], assets[1]))
		]
	);
}
