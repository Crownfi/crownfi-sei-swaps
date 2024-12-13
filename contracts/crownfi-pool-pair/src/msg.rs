use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::{Addr, Binary, Coin, Decimal, Uint128};

use crate::{
	contract::pool::{PoolPairCalcNaiveSwapResult, PoolPairCalcSwapResult},
	state::PoolPairConfigJsonable,
};

/// This structure stores the basic settings for creating a new factory contract.
#[cw_serde]
pub struct PoolPairInstantiateMsg {
	pub shares_receiver: Addr,
	pub config: PoolPairConfigJsonable,
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
		/// If true, this has been endorsed by the admin.
		endorsed: Option<bool>,
	},
	/// ProvideLiquidity allows someone to provide liquidity in the pool
	ProvideLiquidity {
		/// The slippage tolerance that allows liquidity provision only if the price in the pool doesn't move too much
		slippage_tolerance: Option<Decimal>,
		/// The receiver of pool share
		receiver: Option<Addr>,
		/// If the receiver is a contract, you can execute it by passing the encoded message here verbatim.
		receiver_payload: Option<Binary>,
	},
	/// Withdraw liquidity from the pool
	WithdrawLiquidity {
		/// The receiver of the share value
		receiver: Option<Addr>,
		/// If the receiver is a contract, you can execute it by passing the encoded message here verbatim.
		receiver_payload: Option<Binary>,
	},
	/// Withdraw liquidity from the pool, but also allows you to specify different destinations for both tokens. Note
	/// That the "left" and "right" coins correspond to the denoms in canonical, that is, lexicographical order.
	WithdrawAndSplitLiquidity {
		/// The receiver of the share value
		left_coin_receiver: Option<Addr>,
		/// If the receiver is a contract, you can execute it by passing the encoded message here verbatim.
		left_coin_receiver_payload: Option<Binary>,
		/// The receiver of the share value
		right_coin_receiver: Option<Addr>,
		/// If the receiver is a contract, you can execute it by passing the encoded message here verbatim.
		right_coin_receiver_payload: Option<Binary>,
	},
	/// Swap performs a swap in the pool
	Swap {
		/// The expected amount after swap, before fees are taken. By default this will be `incoming_coin *
		/// exchange_rate`
		expected_result: Option<Uint128>,
		/// A value between 0 and 1 determining the difference tolerance between `expected_result` and the actual
		/// result of the swap before fees. e.g. 0.1 means a 10% slippage tolerance. By default this will be to 0.5%.
		slippage_tolerance: Option<Decimal>,
		/// The account receiving the payout
		receiver: Option<Addr>,
		/// If the receiver is a contract, you can execute it by passing the encoded message here verbatim.
		receiver_payload: Option<Binary>,
	},
}

#[cw_serde]
#[derive(Default)]
pub struct VolumeQueryResponse {
	pub volume: [Uint128; 2],
	pub from_timestamp_ms: u64,
	pub to_timestamp_ms: u64,
}

#[cw_serde]
#[derive(Default)]
pub struct ExchangeRateQueryResponse {
	pub exchange_rate_low: Decimal,
	pub exchange_rate_high: Decimal,
	pub exchange_rate_avg: Decimal,
	pub from_timestamp_ms: u64,
	pub to_timestamp_ms: u64,
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum PoolPairQueryMsg {
	/// Returns the pair denoms as they are marketed.
	#[returns([String; 2])]
	PairDenoms,
	/// Returns the pair denoms as it's internally represented (Denoms are in lexicographical order).
	#[returns([String; 2])]
	CanonicalPairDenoms,
	/// Returns the pair identifier as it's marketed.
	#[returns(String)]
	PairIdentifier,
	/// Returns the pair identifier as it's internally represented (Denoms are in lexicographical order).
	#[returns(String)]
	CanonicalPairIdentifier,
	/// Config returns contract settings specified in the custom [`ConfigResponse`] structure.
	#[returns(PoolPairConfigJsonable)]
	Config,
	/// Returns the total amount of shares known to the contract
	#[returns(Uint128)]
	TotalShares,
	/// Returns the current value of shares
	#[returns([Coin; 2])]
	ShareValue { amount: Uint128 },
	/// Simulates a deposit and tells you how many pool shares you'd recieve, along with their value.
	#[returns(PoolPairQuerySimulateDepositResponse)]
	SimulateProvideLiquidity { offer: [Coin; 2] },
	/// Simulates a swap and tells you how much you'd get in return, the spread, and the fees involved.
	#[returns(PoolPairCalcSwapResult)]
	SimulateSwap { offer: Coin },
	/// Simulates a swap assuming infinite liquidity, i.e. having no effect on the exchange rate.
	#[returns(PoolPairCalcNaiveSwapResult)]
	SimulateNaiveSwap { offer: Coin },
	/// If past_hours is specified and is greater than 0, returns the total volume in the past specified hours.
	/// e.g. 24 means volume over the past 24 hours, updated every hour (UTC).
	///
	/// Otherwise, returns the amount of volume since this hour started (UTC).
	///
	/// Data older than 24 hours is not guaranteed.
	#[returns(VolumeQueryResponse)]
	HourlyVolumeSum { past_hours: Option<u8> },
	/// If past_days is specified and is greater than 0, returns the total volume in the past specified days.
	/// e.g. 7 means volume over the past 7 days, updated every midnight (UTC).
	///
	/// Otherwise, returns the amount of volume since midnight (UTC).
	///
	/// Data older than 30 days is not guaranteed.
	#[returns(VolumeQueryResponse)]
	DailyVolumeSum { past_days: Option<u8> },
	/// Get the all time volume from since the first trade happened.
	#[returns(VolumeQueryResponse)]
	TotalVolumeSum,
	/// If past_hours is specified and is greater than 0, returns exchange rate stats for the past specified hours.
	/// e.g. 24 means price stats over the past 24 hours, updated every hour (UTC).
	///Each of the 24 bits of the significand (including the implicit 24th bit), bit 23 to bit 0, represents a value, starting at 1 and halves for each bit, as follows:
	/// Otherwise, returns the price stats since this hour started (UTC).
	///
	/// Data older than 24 hours is not guaranteed.
	///
	/// The stored encoding for highest and lowest price is lossy and gets more accurate as the exhange rate approaches 1:1
	#[returns(ExchangeRateQueryResponse)]
	ExchangeRateHourly { past_hours: Option<u8> },
	/// If past_days is specified and is greater than 0, returns exchange rate stats for the past specified days.
	/// e.g. 7 means price stats over the past 7 days, updated every midnight (UTC).
	///
	/// Otherwise, returns the price stats since midnight (UTC).
	///
	/// Data older than 30 days is not guaranteed.
	///
	/// The stored encoding for highest and lowest price is lossy and gets more accurate as the exhange rate approaches 1:1
	#[returns(ExchangeRateQueryResponse)]
	ExchangeRateDaily { past_days: Option<u8> },
	#[returns(ExchangeRateQueryResponse)]
	/// Returns the average, highest, and lowest price
	ExchangeRateAllTime,
	#[returns(Decimal)]
	/// Returns an estimated APY using the volume from the past specified amount of days
	///
	/// Data older than 30 days is not guaranteed.
	EstimateApy { past_days: u8 },
}

#[cw_serde]
pub struct PoolPairQuerySimulateDepositResponse {
	pub share_amount: Uint128,
	pub share_value: [Coin; 2],
}
