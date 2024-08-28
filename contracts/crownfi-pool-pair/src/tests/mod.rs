use cosmwasm_std::{coin, testing::*, Addr, Coin, Decimal, MemoryStorage, QuerierWrapper, Response};
use cosmwasm_std::{OwnedDeps, Uint128};
use sei_cosmwasm::{SeiMsg, SeiQueryWrapper};

use crate::contract::*;
use crate::msg::*;
use crate::state::*;
use crate::workarounds::total_supply_workaround;

mod execute;
mod instantiate;
mod query;

const RANDOM_ADDRESS: &str = "sei1zgfgerl8qt9uldlr0y9w7qe97p7zyv5kwg2pge";
const RANDOM_ADDRESS2: &str = "sei1grzhksjfvg2s8mvgetmkncv67pr90kk37cfdhq";
const DUST: u128 = 1;
const LP_TOKEN: &str = "factory/cosmos2contract/lp";
const PAIR_DENOMS: [&str; 2] = ["abc", "cba"];
const ONE_BILLION: u128 = 1_000_000;

type TestDeps = OwnedDeps<MemoryStorage, MockApi, MockQuerier<SeiQueryWrapper>, SeiQueryWrapper>;

fn deps(balances: &[(&str, &[Coin])]) -> TestDeps {
	let querier = MockQuerier::<SeiQueryWrapper>::new(balances);

	let mem = Box::new(MockStorage::default());
	let mem_ptr = Box::leak(mem) as *mut MockStorage;
	crownfi_cw_common::storage::base::set_global_storage(unsafe { Box::from_raw(mem_ptr) });

	OwnedDeps {
		querier,
		storage: unsafe { mem_ptr.read() },
		api: MockApi::default(),
		custom_query_type: Default::default(),
	}
}

const LEFT_TOKEN_AMT: u128 = ONE_BILLION;
const RIGHT_TOKEN_AMT: u128 = ONE_BILLION / 2;

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
		&[
			coin(LEFT_TOKEN_AMT, PAIR_DENOMS[0]),
			coin(RIGHT_TOKEN_AMT, PAIR_DENOMS[1]),
		],
	);

	let res = instantiate(deps.as_mut(), env.clone(), info, msg).unwrap();

	deps.querier.update_balance(
		env.contract.address.clone(),
		vec![
			coin(LEFT_TOKEN_AMT, PAIR_DENOMS[0]),
			coin(RIGHT_TOKEN_AMT, PAIR_DENOMS[1]),
		],
	);

	res
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

fn share_in_assets<T: Into<Uint128> + Copy>(pool: [T; 2], amount: T, total_share: T) -> [Coin; 2] {
	let total_share = total_share.into();

	let mut share_ratio = Decimal::zero();
	if !total_share.is_zero() {
		share_ratio = Decimal::from_ratio(amount.into(), total_share);
	}

	[
		coin((pool[0].into() * share_ratio).u128(), PAIR_DENOMS[0]),
		coin((pool[1].into() * share_ratio).u128(), PAIR_DENOMS[1]),
	]
}

// fn calc_swap<T: Into<Uint128> + Copy>(
// 	offer: T,
// 	offer_idx: usize,
// 	pool: [T; 2],
// 	commission_rate: Decimal,
// ) -> (Uint128, Uint128, Uint128) {
// 	assert!(offer_idx <= 1);
// 	let pool: [Uint256; 2] = pool.map(|x| x.into().into());
// 	let offer: Uint256 = offer.into().into();
// 	let commission_rate = Decimal256::from(commission_rate);

// 	let ask_pool = pool[offer_idx ^ 1];
// 	let offer_pool = pool[offer_idx];
// 	let cp = offer_pool * ask_pool;

// 	let return_amount: Uint256 =
// 		(Decimal256::from_ratio(ask_pool, 1u8) - Decimal256::from_ratio(cp, offer_pool + offer)) * Uint256::from(1u8);
// 	let spread_amount: Uint256 = (offer * Decimal256::from_ratio(ask_pool, offer_pool)).saturating_sub(return_amount);
// 	let commission_amount: Uint256 = return_amount * commission_rate;
// 	let return_amount: Uint256 = return_amount - commission_amount;

// 	(
// 		return_amount.try_into().unwrap(),
// 		spread_amount.try_into().unwrap(),
// 		commission_amount.try_into().unwrap(),
// 	)
// }
