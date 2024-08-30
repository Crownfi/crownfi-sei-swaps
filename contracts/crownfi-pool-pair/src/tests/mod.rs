use cosmwasm_std::{coin, from_json, testing::*, Addr, Coin, Deps, MemoryStorage, QuerierWrapper, Response};
use cosmwasm_std::{OwnedDeps, Uint128};
use crownfi_cw_common::data_types::canonical_addr::SeiCanonicalAddr;
use sei_cosmwasm::{SeiMsg, SeiQueryWrapper};

use crate::contract::*;
use crate::msg::*;
use crate::state::*;
use crate::workarounds::total_supply_workaround;

mod execute;
mod instantiate;
mod query;

const DUST: u128 = 1;
const LP_TOKEN: &str = "factory/cosmos2contract/lp";
const PAIR_DENOMS: [&str; 2] = ["abc", "cba"];
const ONE_BILLION: u128 = 1_000_000;

type TestDeps = OwnedDeps<MemoryStorage, MockApi, MockQuerier<SeiQueryWrapper>, SeiQueryWrapper>;

enum AddressFactory {}
impl AddressFactory {
	/// supposed to be used as the contract owner/fee receiver etc
	pub(crate) const MAIN_ADDRESS: &'static str = "sei1zgfgerl8qt9uldlr0y9w7qe97p7zyv5kwg2pge";

	fn random_address() -> String {
		let random_addr: [u8; 20] = rand::random();
		SeiCanonicalAddr::from(random_addr).to_string()
	}
}

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
		shares_receiver: Addr::unchecked(AddressFactory::MAIN_ADDRESS),
		config: PoolPairConfigJsonable {
			admin: Addr::unchecked(AddressFactory::MAIN_ADDRESS),
			inverse: false,
			endorsed: true,
			fee_receiver: Addr::unchecked(AddressFactory::MAIN_ADDRESS),
			total_fee_bps: 100,
			maker_fee_bps: 50,
		},
	};

	let env = mock_env();
	let info = mock_info(
		AddressFactory::MAIN_ADDRESS,
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

fn share_in_assets(deps: Deps<'_, SeiQueryWrapper>, amt: u128) -> [Coin; 2] {
	let msg = PoolPairQueryMsg::ShareValue { amount: amt.into() };
	let env = mock_env();
	from_json(query(deps, env, msg).unwrap()).unwrap()
}
