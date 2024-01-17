use cosmwasm_schema::{cw_serde, QueryResponses};

use cosmwasm_std::{Decimal, Uint128};
use cw20::Cw20ReceiveMsg;

use crate::asset::AssetInfo;

pub const MAX_SWAP_OPERATIONS: usize = 50;

/// This structure holds the parameters used for creating a contract.
#[cw_serde]
pub struct AstroRouteInstantiateMsg {
    /// The astroport factory contract address
    pub astroport_factory: String,
}

/// This enum describes a swap operation.
#[cw_serde]
pub enum AstroRouteSwapOperation {
    /// Native swap
    NativeSwap {
        /// The name (denomination) of the native asset to swap from
        offer_denom: String,
        /// The name (denomination) of the native asset to swap to
        ask_denom: String,
    },
    /// ASTRO swap
    AstroSwap {
        /// Information about the asset being swapped
        offer_asset_info: AssetInfo,
        /// Information about the asset we swap to
        ask_asset_info: AssetInfo,
    },
}

impl AstroRouteSwapOperation {
    pub fn get_target_asset_info(&self) -> AssetInfo {
        match self {
            AstroRouteSwapOperation::NativeSwap { ask_denom, .. } => AssetInfo::NativeToken {
                denom: ask_denom.clone(),
            },
            AstroRouteSwapOperation::AstroSwap { ask_asset_info, .. } => ask_asset_info.clone(),
        }
    }
}

/// This structure describes the execute messages available in the contract.
#[cw_serde]
pub enum AstroRouteExecuteMsg {
    /// Receive receives a message of type [`Cw20ReceiveMsg`] and processes it depending on the received template
    Receive(Cw20ReceiveMsg),
    /// ExecuteSwapOperations processes multiple swaps while mentioning the minimum amount of tokens to receive for the last swap operation
    ExecuteSwapOperations {
        operations: Vec<AstroRouteSwapOperation>,
        minimum_receive: Option<Uint128>,
        to: Option<String>,
        max_spread: Option<Decimal>,
    },

    /// Internal use
    /// ExecuteSwapOperation executes a single swap operation
    ExecuteSwapOperation {
        operation: AstroRouteSwapOperation,
        to: Option<String>,
        max_spread: Option<Decimal>,
        single: bool,
    },
    /// Internal use
    /// AssertMinimumReceive checks that a receiver will get a minimum amount of tokens from a swap
    AssertMinimumReceive {
        asset_info: AssetInfo,
        prev_balance: Uint128,
        minimum_receive: Uint128,
        receiver: String,
    },
}

#[cw_serde]
pub enum AstroRouteCw20HookMsg {
    ExecuteSwapOperations {
        /// A vector of swap operations
        operations: Vec<AstroRouteSwapOperation>,
        /// The minimum amount of tokens to get from a swap
        minimum_receive: Option<Uint128>,
        /// The recipient
        to: Option<String>,
        /// Max spread
        max_spread: Option<Decimal>,
    },
}

/// This structure describes the query messages available in the contract.
#[cw_serde]
#[derive(QueryResponses)]
pub enum AstroRouteQueryMsg {
    /// Config returns configuration parameters for the contract using a custom [`ConfigResponse`] structure
    #[returns(AstroRouteConfigResponse)]
    Config {},
    /// SimulateSwapOperations simulates multi-hop swap operations
    #[returns(AstroRouteSimulateSwapOperationsResponse)]
    SimulateSwapOperations {
        /// The amount of tokens to swap
        offer_amount: Uint128,
        /// The swap operations to perform, each swap involving a specific pool
        operations: Vec<AstroRouteSwapOperation>,
    },
}

/// This structure describes a custom struct to return a query response containing the base contract configuration.
#[cw_serde]
pub struct AstroRouteConfigResponse {
    /// The Astroport factory contract address
    pub astroport_factory: String,
}

/// This structure describes a custom struct to return a query response containing the end amount of a swap simulation
#[cw_serde]
pub struct AstroRouteSimulateSwapOperationsResponse {
    /// The amount of tokens received in a swap simulation
    pub amount: Uint128,
}

/// This structure describes a migration message.
/// We currently take no arguments for migrations.
#[cw_serde]
pub struct AstroRouteMigrateMsg {}
