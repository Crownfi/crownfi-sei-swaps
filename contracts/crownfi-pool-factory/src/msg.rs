use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::Addr;

use crate::state::PoolFactoryConfigJsonable;

/// This structure stores the basic settings for creating a new factory contract.
#[cw_serde]
pub struct PoolFactoryInstantiateMsg {
	pub config: PoolFactoryConfigJsonable
}

/// This structure describes the execute messages of the contract.
#[cw_serde]
pub enum PoolFactoryExecuteMsg {
	/// UpdateConfig updates relevant code IDs
	UpdateConfig {
		/// The head honcho
		admin: Option<Addr>,
		/// Where to put the maker fees, set to "sei1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq703fpu" to disable.
		fee_receiver: Option<Addr>,
		/// Code to use when instantiating new pool pairs
		pair_code_id: Option<u64>,
		/// The total fees (in bps) charged by a pair of this type
		default_total_fee_bps: Option<u16>,
		/// The amount of fees (in bps) collected by the Maker contract from this pair type
		default_maker_fee_bps: Option<u16>,
		/// If true, everyone will be able to create new trading pairs
		permissionless_pool_cration: Option<bool>
	},
	/// CreatePool instantiates a new pair pool contract.
	/// The pair is determined by the initial liquidity funds sent to this contract
	CreatePool {
		/// As funds must be given in alphabetical order, this is used to determine whether or not the pair should be
		/// swapped when presented to the user
		left_denom: String
	},
	UpdateFeesForPool {
		pair: [String; 2],
		total_fee_bps: Option<u16>,
		maker_fee_bps: Option<u16>
	},
	UpdateGlobalConfigForPool {
		index: u32,
		limit: u32
	}
}

/// This structure describes the available query messages for the factory contract.
#[cw_serde]
#[derive(QueryResponses)]
pub enum PoolFactoryQueryMsg {
	/// Config returns contract settings specified in the custom [`ConfigResponse`] structure.
	#[returns(PoolFactoryConfigJsonable)]
	Config,
	/// Gets the contract address for a pair. The result may include the inverse pair if it exists.
	#[returns(Option<Addr>)]
	PairAddr {
		pair: [String; 2]
	},
	/// Pairs returns an array of pairs and their information according to the specified parameters in `start_after` and `limit` variables.
	#[returns(Vec<Addr>)]
	Pairs {
		start_after: Option<Addr>,
		limit: Option<u32>
	}
}
