use cosmwasm_std::{
	attr, coin,
	testing::{mock_env, mock_info, MOCK_CONTRACT_ADDR},
	Addr, BankMsg, Binary, CosmosMsg, SubMsg, Uint128, WasmMsg,
};
use crownfi_swaps_common::error::CrownfiSwapsCommonError;
use cw_utils::PaymentError;

use crate::{
	contract::execute,
	error::PoolPairContractError,
	msg::PoolPairExecuteMsg,
	tests::{
		calc_shares, deps, init, pool_balance, share_in_assets, AddressFactory, DUST, LEFT_TOKEN_AMT, LP_TOKEN,
		PAIR_DENOMS, RIGHT_TOKEN_AMT,
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
	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(50, PAIR_DENOMS[0])]);

	let response = execute(deps.as_mut(), env.clone(), info, msg.clone());
	assert_eq!(
		response,
		Err(PoolPairContractError::PaymentError(PaymentError::MissingDenom(
			LP_TOKEN.to_string()
		)))
	);

	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(50, PAIR_DENOMS[0]), coin(50, LP_TOKEN)]);
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

	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(1, LP_TOKEN)]);
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

	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(500, LP_TOKEN)]);

	let assets = share_in_assets(deps.as_ref(), 500);

	let response = execute(deps.as_mut(), env.clone(), info.clone(), msg.clone()).unwrap();
	assert_eq!(
		response.messages,
		vec![
			SubMsg::new(BankMsg::Burn {
				amount: vec![coin(500, LP_TOKEN)]
			}),
			SubMsg::new(BankMsg::Send {
				to_address: sender,
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
	let assets = share_in_assets(deps.as_ref(), 500);
	let share_values = calc_shares(assets.clone().map(|x| x.amount.u128()), pb);

	execute(
		deps.as_mut(),
		mock_env(),
		mock_info(&AddressFactory::random_address(), &[coin(500, LP_TOKEN)]),
		PoolPairExecuteMsg::WithdrawLiquidity {
			receiver: None,
			receiver_payload: None,
		},
	)
	.unwrap();

	deps.querier.update_balance(
		MOCK_CONTRACT_ADDR,
		vec![
			coin(LEFT_TOKEN_AMT - assets[0].amount.u128(), PAIR_DENOMS[0]),
			coin(RIGHT_TOKEN_AMT - assets[1].amount.u128(), PAIR_DENOMS[1]),
		],
	);

	let total_share_after = total_supply_workaround(LP_TOKEN);
	assert_eq!(total_share - Uint128::new(500), total_share_after);
	let new_share_values = calc_shares(assets.clone().map(|x| x.amount.u128()), pb);
	assert_eq!(share_values - DUST, new_share_values);
}

#[test]
fn value_of_share_doesnt_change_for_other_users() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::WithdrawLiquidity {
		receiver: None,
		receiver_payload: None,
	};

	let sender = AddressFactory::random_address();
	let info = mock_info(&sender, &[coin(500, LP_TOKEN)]);

	let assets = share_in_assets(deps.as_ref(), 500);
	let mut starting_balance = [LEFT_TOKEN_AMT, RIGHT_TOKEN_AMT];
	let responses = (0..100).map(|_| {
		starting_balance = [
			starting_balance[0] - assets[0].amount.u128(),
			starting_balance[1] - assets[1].amount.u128(),
		];

		let res = execute(deps.as_mut(), env.clone(), info.clone(), msg.clone()).unwrap();

		deps.querier.update_balance(
			env.contract.address.clone(),
			vec![
				coin(starting_balance[0], PAIR_DENOMS[0]),
				coin(starting_balance[1], PAIR_DENOMS[1]),
			],
		);

		res.messages
			.into_iter()
			.filter_map(|x| match x.msg {
				CosmosMsg::Bank(BankMsg::Send { amount, .. }) => Some(amount[0].amount),
				_ => None,
			})
			.sum::<Uint128>()
	});

	for responses in responses.collect::<Vec<_>>().windows(2) {
		assert_eq!(responses[0], responses[1]);
	}
}

#[test]
fn returns_wasm_message_when_payload_provided() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let assets = share_in_assets(deps.as_ref(), 500);
	let receiver = AddressFactory::random_address();
	let response = execute(
		deps.as_mut(),
		mock_env(),
		mock_info(&AddressFactory::random_address(), &[coin(500, LP_TOKEN)]),
		PoolPairExecuteMsg::WithdrawLiquidity {
			receiver: Some(Addr::unchecked(&receiver)),
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
				contract_addr: receiver,
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

	let assets = share_in_assets(deps.as_ref(), 500);
	let sender = AddressFactory::random_address();
	let receiver = AddressFactory::random_address();
	let response = execute(
		deps.as_mut(),
		mock_env(),
		mock_info(&sender, &[coin(500, LP_TOKEN)]),
		PoolPairExecuteMsg::WithdrawLiquidity {
			receiver: Some(Addr::unchecked(&receiver)),
			receiver_payload: Some(Binary(b"anana".into())),
		},
	)
	.unwrap();

	assert_eq!(
		response.attributes,
		vec![
			attr("action", "withdraw_liquidity"),
			attr("sender", sender),
			attr("receiver", receiver),
			attr("withdrawn_share", "500"),
			attr("refund_assets", format!("{}, {}", assets[0], assets[1]))
		]
	);
}
