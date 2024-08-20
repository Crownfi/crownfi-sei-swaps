use cosmwasm_std::{coin, testing::*, Addr, BankMsg, Coin, MemoryStorage, Response, SubMsg};
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
