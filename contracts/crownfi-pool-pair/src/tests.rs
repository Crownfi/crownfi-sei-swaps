use cosmwasm_std::{
	attr, coin, from_json, testing::*, Addr, BankMsg, Binary, Coin, CosmosMsg, Decimal, Decimal256, MemoryStorage,
	QuerierWrapper, Response, SubMsg, Uint256, WasmMsg,
};
use cosmwasm_std::{OwnedDeps, Uint128};
use crownfi_cw_common::storage::item::StoredItem;
use crownfi_swaps_common::data_types::pair_id::CanonicalPoolPairIdentifier;
use crownfi_swaps_common::error::CrownfiSwapsCommonError;
use cw2::get_contract_version;
use cw_utils::PaymentError;
use sei_cosmwasm::{SeiMsg, SeiQueryWrapper};

use crate::contract::*;
use crate::error::PoolPairContractError;
use crate::msg::*;
use crate::state::*;
use crate::workarounds::total_supply_workaround;

const RANDOM_ADDRESS: &str = "sei1zgfgerl8qt9uldlr0y9w7qe97p7zyv5kwg2pge";
const RANDOM_ADDRESS2: &str = "sei1grzhksjfvg2s8mvgetmkncv67pr90kk37cfdhq";
const LP_TOKEN: &str = "factory/cosmos2contract/lp";
const PAIR_DENOMS: [&str; 2] = ["abc", "cba"];
const ONE_BILLION: u128 = 1_000_000;

type TestDeps = OwnedDeps<MemoryStorage, MockApi, MockQuerier<SeiQueryWrapper>, SeiQueryWrapper>;

fn deps(balances: &[(&str, &[Coin])]) -> TestDeps {
	let querier = MockQuerier::<SeiQueryWrapper>::new(balances);
	OwnedDeps {
		querier,
		storage: MockStorage::default(),
		api: MockApi::default(),
		custom_query_type: Default::default(),
	}
}

fn init(deps: &mut TestDeps) -> Response<SeiMsg> {
	let msg = PoolPairInstantiateMsg {
		shares_receiver: Addr::unchecked(RANDOM_ADDRESS),
		config: PoolPairConfigJsonable {
			admin: Addr::unchecked(RANDOM_ADDRESS),
			inverse: false,
			endorsed: true,
			fee_receiver: Addr::unchecked(RANDOM_ADDRESS),
			total_fee_bps: 100,
			maker_fee_bps: 50,
		},
	};

	let env = mock_env();
	let info = mock_info(
		RANDOM_ADDRESS,
		&[coin(ONE_BILLION, PAIR_DENOMS[0]), coin(ONE_BILLION / 2, PAIR_DENOMS[1])],
	);

	let res = instantiate(deps.as_mut(), env.clone(), info, msg).unwrap();

	deps.querier.update_balance(
		env.contract.address.clone(),
		vec![coin(ONE_BILLION, PAIR_DENOMS[0]), coin(ONE_BILLION / 2, PAIR_DENOMS[1])],
	);

	res
}

#[test]
fn proper_initialization() {
	let mut deps = deps(&[]);
	let res = init(&mut deps);

	assert_eq!(
		res.messages,
		vec![
			SubMsg::new(SeiMsg::CreateDenom { subdenom: "lp".into() }),
			SubMsg::new(SeiMsg::MintTokens {
				amount: coin(707106, LP_TOKEN)
			}),
			SubMsg::new(BankMsg::Send {
				to_address: RANDOM_ADDRESS.into(),
				amount: vec![coin(707106, LP_TOKEN)]
			})
		]
	);

	let c_version = get_contract_version(&deps.storage).unwrap();
	assert_eq!(c_version.version, env!("CARGO_PKG_VERSION"));

	let id = CanonicalPoolPairIdentifier::load().unwrap().unwrap();
	assert_eq!(id.left, PAIR_DENOMS[0]);
	assert_eq!(id.right, PAIR_DENOMS[1]);

	let config = PoolPairConfig::load().unwrap().unwrap();

	assert_eq!(config.admin, Addr::unchecked(RANDOM_ADDRESS).try_into().unwrap());
	assert_eq!(config.fee_receiver, Addr::unchecked(RANDOM_ADDRESS).try_into().unwrap());
	assert_eq!(config.maker_fee_bps, 50);
	assert_eq!(config.total_fee_bps, 100);
}

#[test]
fn update_config() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let exec_msg = PoolPairExecuteMsg::UpdateConfig {
		admin: Some(Addr::unchecked(RANDOM_ADDRESS2)),
		fee_receiver: Some(Addr::unchecked(RANDOM_ADDRESS2)),
		total_fee_bps: Some(69),
		maker_fee_bps: None,
		endorsed: Some(true),
	};

	let env = mock_env();
	let info = mock_info(RANDOM_ADDRESS2, &[]);
	let res = execute(deps.as_mut(), env.clone().clone(), info, exec_msg.clone());
	assert!(matches!(
		res,
		Err(PoolPairContractError::SwapsCommonError(
			CrownfiSwapsCommonError::Unauthorized(_)
		))
	));

	let env = mock_env();
	let info = mock_info(
		RANDOM_ADDRESS,
		&[Coin {
			denom: PAIR_DENOMS[0].to_string(),
			amount: Uint128::from(1u128),
		}],
	);
	let res = execute(deps.as_mut(), env.clone().clone(), info, exec_msg.clone());
	assert_eq!(
		res,
		Err(PoolPairContractError::PaymentError(PaymentError::NonPayable {}))
	);

	let env = mock_env();
	let info = mock_info(RANDOM_ADDRESS, &[]);
	execute(deps.as_mut(), env.clone().clone(), info, exec_msg).unwrap();

	let config = PoolPairConfig::load().unwrap().unwrap();
	assert_eq!(config.admin, Addr::unchecked(RANDOM_ADDRESS2).try_into().unwrap());
	assert_eq!(
		config.fee_receiver,
		Addr::unchecked(RANDOM_ADDRESS2).try_into().unwrap()
	);
	assert_eq!(config.total_fee_bps, 69);
	assert_eq!(config.maker_fee_bps, 50);
}

fn calc_shares<T: Into<Uint128> + Copy>(deposits: [T; 2], pool: [T; 2]) -> u128 {
	let total_supply = total_supply_workaround(LP_TOKEN);
	std::cmp::min(
		deposits[0].into().multiply_ratio(total_supply, pool[0].into()),
		deposits[1].into().multiply_ratio(total_supply, pool[1].into()),
	)
	.u128()
}

fn pool_balance(pair: [&str; 2], querier: &MockQuerier<SeiQueryWrapper>) -> [u128; 2] {
	let querier = QuerierWrapper::<SeiQueryWrapper>::new(querier);
	[
		querier.query_balance("cosmos2contract", pair[0]).unwrap().amount.u128(),
		querier.query_balance("cosmos2contract", pair[1]).unwrap().amount.u128(),
	]
}

#[test]
fn provide_liquidity_err_checking() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let provide_liquidity_msg = PoolPairExecuteMsg::ProvideLiquidity {
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};

	let env = mock_env();

	let info = mock_info(
		RANDOM_ADDRESS2,
		&[Coin {
			denom: PAIR_DENOMS[0].to_string(),
			amount: Uint128::from(50u128),
		}],
	);
	let res = execute(deps.as_mut(), env.clone().clone(), info, provide_liquidity_msg.clone());
	assert_eq!(
		res,
		Err(PoolPairContractError::SwapsCommonError(
			CrownfiSwapsCommonError::MustPayPair
		))
	);

	let info = mock_info(
		RANDOM_ADDRESS2,
		&[
			Coin {
				denom: PAIR_DENOMS[0].to_string(),
				amount: Uint128::from(50u128),
			},
			Coin {
				denom: PAIR_DENOMS[1].to_string(),
				amount: Uint128::from(0u128),
			},
		],
	);
	let res = execute(deps.as_mut(), env.clone().clone(), info, provide_liquidity_msg.clone());
	assert_eq!(
		res,
		Err(PoolPairContractError::SwapsCommonError(
			CrownfiSwapsCommonError::PaymentIsZero
		))
	);

	let info = mock_info(
		RANDOM_ADDRESS2,
		&[
			Coin {
				denom: PAIR_DENOMS[0].to_string(),
				amount: Uint128::from(50u128),
			},
			Coin {
				denom: "banana".to_string(),
				amount: Uint128::from(0u128),
			},
		],
	);
	let res = execute(deps.as_mut(), env.clone().clone(), info, provide_liquidity_msg.clone());
	assert_eq!(
		res,
		Err(PoolPairContractError::SwapsCommonError(
			CrownfiSwapsCommonError::PaymentError(PaymentError::ExtraDenom("banana".into()))
		))
	);
}

// NOTE: you can't provide more liquidity than the amount in the pool,
// idk if that's wanted behavior, it simply panics with `attempt to subtract with overflow`
#[test]
fn provide_liquidity() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let provide_liquidity_msg = PoolPairExecuteMsg::ProvideLiquidity {
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};

	let env = mock_env();
	let info = mock_info(
		RANDOM_ADDRESS2,
		&[
			Coin {
				denom: PAIR_DENOMS[0].to_string(),
				amount: Uint128::from(50u128),
			},
			Coin {
				denom: PAIR_DENOMS[1].to_string(),
				amount: Uint128::from(25u128),
			},
		],
	);
	let res = execute(deps.as_mut(), env.clone(), info.clone(), provide_liquidity_msg.clone()).unwrap();

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let lp_amt = calc_shares([50u128, 25u128], pb);

	assert_eq!(
		res.messages,
		vec![
			SubMsg::new(SeiMsg::MintTokens {
				amount: coin(lp_amt, LP_TOKEN)
			}),
			SubMsg::new(CosmosMsg::from(BankMsg::Send {
				to_address: RANDOM_ADDRESS2.into(),
				amount: vec![coin(lp_amt, LP_TOKEN)]
			}))
		]
	);

	let msg_with_payload = PoolPairExecuteMsg::ProvideLiquidity {
		slippage_tolerance: None,
		receiver: Some(Addr::unchecked(RANDOM_ADDRESS)),
		receiver_payload: Some(cosmwasm_std::Binary(b"anana".into())),
	};

	let res = execute(deps.as_mut(), env.clone().clone(), info, msg_with_payload).unwrap();
	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let lp_amt = calc_shares([50u128, 25u128], pb);
	assert_eq!(
		res.messages,
		vec![
			SubMsg::new(SeiMsg::MintTokens {
				amount: coin(lp_amt, LP_TOKEN)
			}),
			SubMsg::new(CosmosMsg::from(WasmMsg::Execute {
				contract_addr: RANDOM_ADDRESS.into(),
				msg: Binary(b"anana".into()),
				funds: vec![coin(lp_amt, LP_TOKEN)]
			}))
		]
	);

	let assets = [
		Coin {
			denom: PAIR_DENOMS[0].to_string(),
			amount: Uint128::from(5000u128),
		},
		Coin {
			denom: PAIR_DENOMS[1].to_string(),
			amount: Uint128::from(2510u128),
		},
	];
	let info = mock_info(RANDOM_ADDRESS2, &assets);

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let lp_amt = calc_shares([500u128, 250u128], pb);
	let res = execute(deps.as_mut(), env.clone(), info.clone(), provide_liquidity_msg.clone()).unwrap();
	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let lp_amt_after = calc_shares([500u128, 250u128], pb);
	assert_ne!(lp_amt, lp_amt_after);

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

#[test]
fn withdraw_liquidity_err_checking() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let msg = PoolPairExecuteMsg::WithdrawLiquidity {
		receiver: None,
		receiver_payload: None,
	};

	let env = mock_env();
	let info = mock_info(
		RANDOM_ADDRESS2,
		&[Coin {
			denom: PAIR_DENOMS[0].to_string(),
			amount: Uint128::from(50u128),
		}],
	);

	let response = execute(deps.as_mut(), env.clone(), info, msg.clone());
	assert_eq!(
		response,
		Err(PoolPairContractError::PaymentError(PaymentError::MissingDenom(
			LP_TOKEN.to_string()
		)))
	);

	let info = mock_info(
		RANDOM_ADDRESS2,
		&[
			Coin {
				denom: PAIR_DENOMS[0].to_string(),
				amount: Uint128::from(50u128),
			},
			Coin {
				denom: LP_TOKEN.to_string(),
				amount: 50u128.into(),
			},
		],
	);
	let response = execute(deps.as_mut(), env.clone(), info, msg.clone());
	assert_eq!(
		response,
		Err(PoolPairContractError::PaymentError(PaymentError::MultipleDenoms {}))
	);

	let info = mock_info(
		RANDOM_ADDRESS2,
		&[Coin {
			denom: LP_TOKEN.to_string(),
			amount: 1u128.into(),
		}],
	);
	let response = execute(deps.as_mut(), env, info, msg);
	assert_eq!(
		response,
		Err(PoolPairContractError::SwapsCommonError(
			CrownfiSwapsCommonError::PayoutIsZero
		))
	);
}

fn share_in_assets<T: Into<Uint128> + Copy>(pool: [T; 2], amount: T, total_share: T) -> [Coin; 2] {
	let total_share = total_share.into();

	let mut share_ratio = Decimal::zero();
	if !total_share.is_zero() {
		share_ratio = Decimal::from_ratio(amount.into(), total_share);
	}

	[
		Coin {
			denom: PAIR_DENOMS[0].into(),
			amount: pool[0].into() * share_ratio,
		},
		Coin {
			denom: PAIR_DENOMS[1].into(),
			amount: pool[1].into() * share_ratio,
		},
	]
}

#[test]
fn withdraw_liquidity() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::WithdrawLiquidity {
		receiver: None,
		receiver_payload: None,
	};

	let info = mock_info(
		RANDOM_ADDRESS2,
		&[Coin {
			denom: LP_TOKEN.to_string(),
			amount: Uint128::from(500u128),
		}],
	);

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let total_share = total_supply_workaround(LP_TOKEN);
	let assets = share_in_assets(pb, 500, total_share.u128());
	let share_values = calc_shares(assets.clone().map(|x| x.amount.u128()), pb);

	let response = execute(deps.as_mut(), env.clone(), info.clone(), msg.clone()).unwrap();
	assert_eq!(
		response.messages,
		vec![
			SubMsg::new(BankMsg::Burn {
				amount: vec![coin(500, LP_TOKEN)]
			}),
			SubMsg::new(BankMsg::Send {
				to_address: RANDOM_ADDRESS2.into(),
				amount: assets.clone().into()
			})
		]
	);

	let total_share_after = total_supply_workaround(LP_TOKEN);
	assert_eq!(total_share - Uint128::new(500), total_share_after);
	let new_share_values = calc_shares(assets.clone().map(|x| x.amount.u128()), pb);
	assert_eq!(share_values, new_share_values);

	let msg_with_payload = PoolPairExecuteMsg::WithdrawLiquidity {
		receiver: Some(Addr::unchecked(RANDOM_ADDRESS)),
		receiver_payload: Some(Binary(b"anana".into())),
	};
	let response = execute(deps.as_mut(), env.clone(), info, msg_with_payload).unwrap();
	assert_eq!(
		response.messages,
		vec![
			SubMsg::new(BankMsg::Burn {
				amount: vec![coin(500, LP_TOKEN)]
			}),
			SubMsg::new(WasmMsg::Execute {
				contract_addr: RANDOM_ADDRESS.into(),
				msg: Binary(b"anana".into()),
				funds: assets.clone().into()
			})
		]
	);

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

#[test]
fn withdraw_and_split_liquidity_err_checking() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let msg = PoolPairExecuteMsg::WithdrawAndSplitLiquidity {
		left_coin_receiver: None,
		left_coin_receiver_payload: None,
		right_coin_receiver: None,
		right_coin_receiver_payload: None,
	};

	let env = mock_env();
	let info = mock_info(
		RANDOM_ADDRESS2,
		&[Coin {
			denom: PAIR_DENOMS[0].to_string(),
			amount: Uint128::from(50u128),
		}],
	);

	let response = execute(deps.as_mut(), env.clone(), info, msg.clone());
	assert_eq!(
		response,
		Err(PoolPairContractError::PaymentError(PaymentError::MissingDenom(
			LP_TOKEN.to_string()
		)))
	);

	let info = mock_info(
		RANDOM_ADDRESS2,
		&[
			Coin {
				denom: PAIR_DENOMS[0].to_string(),
				amount: Uint128::from(50u128),
			},
			Coin {
				denom: LP_TOKEN.to_string(),
				amount: 50u128.into(),
			},
		],
	);
	let response = execute(deps.as_mut(), env.clone(), info, msg.clone());
	assert_eq!(
		response,
		Err(PoolPairContractError::PaymentError(PaymentError::MultipleDenoms {}))
	);

	let info = mock_info(
		RANDOM_ADDRESS2,
		&[Coin {
			denom: LP_TOKEN.to_string(),
			amount: 1u128.into(),
		}],
	);
	let response = execute(deps.as_mut(), env, info, msg);
	assert_eq!(
		response,
		Err(PoolPairContractError::SwapsCommonError(
			CrownfiSwapsCommonError::PayoutIsZero
		))
	);
}

#[test]
fn withdraw_and_split_liquidity() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::WithdrawAndSplitLiquidity {
		left_coin_receiver: Some(Addr::unchecked(RANDOM_ADDRESS)),
		left_coin_receiver_payload: None,
		right_coin_receiver: Some(Addr::unchecked(RANDOM_ADDRESS2)),
		right_coin_receiver_payload: None,
	};

	let info = mock_info(
		RANDOM_ADDRESS2,
		&[Coin {
			denom: LP_TOKEN.to_string(),
			amount: Uint128::from(500u128),
		}],
	);

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let total_share = total_supply_workaround(LP_TOKEN);
	let assets = share_in_assets(pb, 500, total_share.u128());
	let share_values = calc_shares(assets.clone().map(|x| x.amount.u128()), pb);

	let response = execute(deps.as_mut(), env.clone(), info.clone(), msg.clone()).unwrap();
	assert_eq!(
		response.messages,
		vec![
			SubMsg::new(BankMsg::Burn {
				amount: vec![coin(500, LP_TOKEN)]
			}),
			SubMsg::new(BankMsg::Send {
				to_address: RANDOM_ADDRESS.into(),
				amount: vec![assets[0].clone()]
			}),
			SubMsg::new(BankMsg::Send {
				to_address: RANDOM_ADDRESS2.into(),
				amount: vec![assets[1].clone()]
			})
		]
	);

	let total_share_after = total_supply_workaround(LP_TOKEN);
	assert_eq!(total_share - Uint128::new(500), total_share_after);
	let new_share_values = calc_shares(assets.clone().map(|x| x.amount.u128()), pb);
	assert_eq!(share_values, new_share_values);

	let msg_with_payload = PoolPairExecuteMsg::WithdrawAndSplitLiquidity {
		left_coin_receiver: None,
		left_coin_receiver_payload: Some(Binary(b"avocado".into())),
		right_coin_receiver: Some(Addr::unchecked(RANDOM_ADDRESS)),
		right_coin_receiver_payload: Some(Binary(b"anana".into())),
	};

	let response = execute(deps.as_mut(), env.clone(), info, msg_with_payload).unwrap();
	assert_eq!(
		response.messages,
		vec![
			SubMsg::new(BankMsg::Burn {
				amount: vec![coin(500, LP_TOKEN)]
			}),
			SubMsg::new(WasmMsg::Execute {
				contract_addr: RANDOM_ADDRESS2.into(),
				msg: Binary(b"avocado".into()),
				funds: vec![assets[0].clone()]
			}),
			SubMsg::new(WasmMsg::Execute {
				contract_addr: RANDOM_ADDRESS.into(),
				msg: Binary(b"anana".into()),
				funds: vec![assets[1].clone()]
			})
		]
	);

	assert_eq!(
		response.attributes,
		vec![
			attr("action", "withdraw_liquidity"),
			attr("sender", RANDOM_ADDRESS2),
			attr(
				"receiver",
				format!(
					"{}, {}",
					Addr::unchecked(RANDOM_ADDRESS2),
					Addr::unchecked(RANDOM_ADDRESS)
				)
			),
			attr("withdrawn_share", "500"),
			attr("refund_assets", format!("{}, {}", assets[0], assets[1]))
		]
	);
}

fn calc_swap<T: Into<Uint128> + Copy>(
	offer: T,
	offer_idx: usize,
	pool: [T; 2],
	commission_rate: Decimal,
) -> (Uint128, Uint128, Uint128) {
	assert!(offer_idx <= 1);
	let pool: [Uint256; 2] = pool.map(|x| x.into().into());
	let offer: Uint256 = offer.into().into();
	let commission_rate = Decimal256::from(commission_rate);

	let ask_pool = pool[offer_idx ^ 1];
	let offer_pool = pool[offer_idx];
	let cp = offer_pool * ask_pool;

	let return_amount: Uint256 =
		(Decimal256::from_ratio(ask_pool, 1u8) - Decimal256::from_ratio(cp, offer_pool + offer)) * Uint256::from(1u8);
	let spread_amount: Uint256 = (offer * Decimal256::from_ratio(ask_pool, offer_pool)).saturating_sub(return_amount);
	let commission_amount: Uint256 = return_amount * commission_rate;
	let return_amount: Uint256 = return_amount - commission_amount;

	(
		return_amount.try_into().unwrap(),
		spread_amount.try_into().unwrap(),
		commission_amount.try_into().unwrap(),
	)
}

#[test]
fn swap_err_checking() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::Swap {
		expected_result: None,
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};
	let info = mock_info(
		RANDOM_ADDRESS2,
		&[Coin {
			denom: LP_TOKEN.to_string(),
			amount: Uint128::from(500u128),
		}],
	);
	let res = execute(deps.as_mut(), env.clone(), info.clone(), msg);
	assert_eq!(
		res,
		Err(PoolPairContractError::PaymentError(PaymentError::ExtraDenom(
			LP_TOKEN.to_string()
		)))
	);

	let msg = PoolPairExecuteMsg::Swap {
		expected_result: Some(Uint128::new(900)),
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};
	let info = mock_info(
		RANDOM_ADDRESS2,
		&[Coin {
			denom: PAIR_DENOMS[1].to_string(),
			amount: Uint128::new(500),
		}],
	);
	let res = execute(deps.as_mut(), env.clone(), info.clone(), msg.clone());
	assert!(matches!(res, Err(PoolPairContractError::SlippageTooHigh(_))));

	// let msg = PoolPairExecuteMsg::Swap {
	// 	expected_result: None,
	// 	slippage_tolerance: Some(Decimal::bps(5)),
	// 	receiver: None,
	// 	receiver_payload: None,
	// };
	// let res = execute(deps.as_mut(), env.clone(), info.clone(), msg.clone());
	// assert_eq!(res, Err(PoolPairContractError::ToleranceTooHigh));
}

#[test]
#[ignore]
fn swap() {
	// MUST CHECK WITH ARITZ
	// apparently the math for the swaps is a bit different in astro port;
	// the results are pretty similar tho.
	// im not sure if im doing anything wrong, but i can't properly test the swaps without further knowledge

	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();
	let msg = PoolPairExecuteMsg::Swap {
		expected_result: None,
		slippage_tolerance: None,
		receiver: None,
		receiver_payload: None,
	};
	let info = mock_info(
		RANDOM_ADDRESS2,
		&[Coin {
			denom: PAIR_DENOMS[1].to_string(),
			amount: Uint128::from(500u128),
		}],
	);

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let (return_amount, _, commission_amount) = calc_swap(500, 1, pb, Decimal::bps(50));
	let total_shares = total_supply_workaround(LP_TOKEN);
	let share_value = share_in_assets(pb, 500, total_shares.u128());
	let res = execute(deps.as_mut(), env.clone(), info.clone(), msg.clone()).unwrap();
	assert_eq!(
		res.messages,
		vec![
			SubMsg::new(BankMsg::Send {
				to_address: RANDOM_ADDRESS.to_string(),
				amount: vec![coin((commission_amount).u128(), PAIR_DENOMS[0])]
			}),
			SubMsg::new(BankMsg::Send {
				to_address: RANDOM_ADDRESS2.to_string(),
				amount: vec![coin(return_amount.u128(), PAIR_DENOMS[0])]
			})
		]
	);

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let total_shares = total_supply_workaround(LP_TOKEN);
	let share_value_after_swap = share_in_assets(pb.clone(), 5000, total_shares.u128());
	assert_ne!(share_value, share_value_after_swap);
}

/// QUERIES
#[test]
fn queries() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

	let pair_denoms: [String; 2] =
		from_json(query(deps.as_ref(), env.clone(), PoolPairQueryMsg::PairDenoms).unwrap()).unwrap();
	let canonical_pair_denoms: [String; 2] =
		from_json(query(deps.as_ref(), env.clone(), PoolPairQueryMsg::CanonicalPairDenoms).unwrap()).unwrap();
	let pair_identifier: String =
		from_json(query(deps.as_ref(), env.clone(), PoolPairQueryMsg::PairIdentifier).unwrap()).unwrap();
	let canonical_pair_identifier: String =
		from_json(query(deps.as_ref(), env.clone(), PoolPairQueryMsg::CanonicalPairIdentifier).unwrap()).unwrap();
	let config: PoolPairConfigJsonable =
		from_json(query(deps.as_ref(), env.clone(), PoolPairQueryMsg::Config).unwrap()).unwrap();

	assert_eq!(pair_denoms, PAIR_DENOMS);
	assert_eq!(canonical_pair_denoms, PAIR_DENOMS);
	assert_eq!(pair_identifier, "abc<>cba");
	assert_eq!(canonical_pair_identifier, "abc<>cba");
	assert_eq!(
		config,
		PoolPairConfigJsonable {
			admin: Addr::unchecked(RANDOM_ADDRESS),
			fee_receiver: Addr::unchecked(RANDOM_ADDRESS),
			total_fee_bps: 100,
			maker_fee_bps: 50,
			inverse: false,
			endorsed: true
		}
	);

	let total_shares = total_supply_workaround(LP_TOKEN);
	let total_shares_query_result: Uint128 =
		from_json(query(deps.as_ref(), env.clone(), PoolPairQueryMsg::TotalShares).unwrap()).unwrap();
	assert_eq!(total_shares, total_shares_query_result);

	let pb = pool_balance(PAIR_DENOMS, &deps.querier);
	let share_value = share_in_assets(pb, 1000, total_shares.u128());
	let share_value_query_result: [Coin; 2] = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::ShareValue {
				amount: Uint128::new(1000),
			},
		)
		.unwrap(),
	)
	.unwrap();
	assert_eq!(share_value, share_value_query_result);

	let info = mock_info(RANDOM_ADDRESS, &[coin(500, LP_TOKEN)]);
	execute(
		deps.as_mut(),
		env.clone(),
		info,
		PoolPairExecuteMsg::WithdrawLiquidity {
			receiver: None,
			receiver_payload: None,
		},
	)
	.unwrap();
	let share_value_query_result2: [Coin; 2] = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::ShareValue {
				amount: Uint128::new(1000),
			},
		)
		.unwrap(),
	)
	.unwrap();
	assert_eq!(share_value_query_result, share_value_query_result2);

	let info = mock_info(
		RANDOM_ADDRESS,
		&[coin(5000, PAIR_DENOMS[0]), coin(2510, PAIR_DENOMS[1])],
	);
	execute(
		deps.as_mut(),
		env.clone(),
		info,
		PoolPairExecuteMsg::ProvideLiquidity {
			slippage_tolerance: None,
			receiver: None,
			receiver_payload: None,
		},
	)
	.unwrap();
	let share_value_query_result3: [Coin; 2] = from_json(
		query(
			deps.as_ref(),
			env.clone(),
			PoolPairQueryMsg::ShareValue {
				amount: Uint128::new(1000),
			},
		)
		.unwrap(),
	)
	.unwrap();
	assert_ne!(share_value_query_result, share_value_query_result3);
}
