use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::{Addr, Coin, Decimal, Uint128};

use crate::state::PoolPairConfigJsonable;

/// This structure stores the basic settings for creating a new factory contract.
#[cw_serde]
pub struct PoolPairInstantiateMsg {
	pub shares_receiver: Addr,
	pub config: PoolPairConfigJsonable,
	pub pair_id_swapped: bool
}

/// This structure describes the execute messages available in the contract.
#[cw_serde]
pub enum PoolPairExecuteMsg {
	/// Update the pair configuration
	UpdateConfig {
		/// The head honcho, this is usually the factory contract
		admin: Option<Addr>,
		/// Where to put the maker fees, set to "sei1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq703fpu" to disable.
		fee_receiver: Option<Addr>,
		/// The total fees (in bps) charged by a pair of this type
		total_fee_bps: Option<u16>,
		/// The amount of fees (in bps) collected by the Maker contract from this pair type
		maker_fee_bps: Option<u16>,
		/// If true, this has been endorsed by the market maker (probably CrownFi)
		endorsed: Option<bool>
	},
	/// ProvideLiquidity allows someone to provide liquidity in the pool
	ProvideLiquidity {
		/// The slippage tolerance that allows liquidity provision only if the price in the pool doesn't move too much
		slippage_tolerance: Option<Decimal>,
		/// The receiver of LP tokens
		receiver: Option<Addr>,
	},
	/// Swap performs a swap in the pool
	Swap {
		belief_price: Option<Decimal>,
		max_spread: Option<Decimal>,
		to: Option<Addr>,
	},
	/// Withdraw liquidity from the pool
	WithdrawLiquidity {
		/// The receiver of the share value
		receiver: Option<Addr>,
	}
}

#[cw_serde]
#[derive(Default)]
pub struct VolumeResponse {
	pub volume: [Uint128; 2],
	pub from_timestamp_ms: u64,
	pub to_timestamp_ms: u64
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum PoolPairQueryMsg {
	/// Returns the pair identifier as it's marketed.
	#[returns([String; 2])]
	PairIdentifier,
	/// Returns the pair identifier as it's internally represented (Denoms are in lexicographical order).
	#[returns([String; 2])]
	CanonicalPairIdentifier,
	/// Config returns contract settings specified in the custom [`ConfigResponse`] structure.
	#[returns(PoolPairConfigJsonable)]
	Config,
	#[returns([Coin; 2])]
	ShareValue { amount: Uint128 },
	/// Returns information about a swap simulation in a [`SimulationResponse`] object.
	#[returns(())] // TODO
	Simulation {
		offer: Coin,
	},
	/// If past_hours is 0/null/undefined, returns the amount of volume since this hour started (UTC).
	/// If past_hours is non-zero, returns the total volume in the past specified hours.
	/// (e.g. 24 means volume over the past 24 hours, updated every hour.)
	/// 
	#[returns(VolumeResponse)]
	HourlyVolumeSum {
		past_hours: Option<u8>
	},
	#[returns(VolumeResponse)]
	DailyVolumeSum {
		past_days: Option<u8>
	},
	#[returns(VolumeResponse)]
	TotalVolumeSum
}
