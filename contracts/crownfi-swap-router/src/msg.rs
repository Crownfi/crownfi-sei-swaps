use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::{Addr, Coin, Decimal, Uint128};

#[cw_serde]
pub struct SwapRouterInstantiateMsg {
	// Nothing to do, this contract has no state worth holding
}

#[cw_serde]
pub struct SwapRouterExpectation {
	/// The amount of the resulting asset you expect to receive after all swaps are done and all fees are taken. (Not
	/// including network gas fees).
	pub expected_amount: Uint128,
	/// A value between 0 and 1 determining the difference tolerance between `expected_result` and the actual result.
	/// For example, 0.1 means a 10% slippage tolerance.
	pub slippage_tolerance: Decimal,
}

#[cw_serde]
pub enum SwapRouterExecuteMsg {
	ExecuteSwaps {
		/// The contract(s) to use to execute the swaps
		swappers: Vec<Addr>,
		/// The slippage tolerance for each step of the way, default value is at the each swapper's discretion, though
		/// the CrownFi swap contracts have a default of 0.5%.
		intermediate_slippage_tolerance: Option<Decimal>,
		/// If you want the swap to fail due to an excessive difference between what you're expecting and what you're
		/// getting, specify your terms here.
		expectation: Option<SwapRouterExpectation>,
		/// If the resulting denom wraps another asset, use this contract to unwrap it
		unwrapper: Option<Addr>,
		/// The account receiving the resulting asset, defaults to the sender.
		receiver: Option<Addr>,
	},
	NextStep,
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum SwapRouterQueryMsg {
	#[returns(SwapRouterSimulateSwapsResponse)]
	SimulateSwaps { offer: Coin, swappers: Vec<Addr> },
}
#[cw_serde]
pub struct SwapRouterSimulateSwapsResponse {
	/// The denom receieved.
	pub result_denom: String,
	/// The final amount received.
	pub result_amount: Uint128,
	/// The difference between the "actual result" and the "naive result", i.e. assuming the swaps would have 0 affect
	/// on the exchange rate while still considering the swap fees.
	pub slip_amount: Uint128,
}
