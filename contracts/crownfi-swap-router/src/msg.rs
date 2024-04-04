use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::Addr;

#[cw_serde]
pub struct SwapRouterInstantiateMsg {
	// TODO (Maybe nothing)
}

#[cw_serde]
pub enum SwapRouterExecuteMsg {
	// TODO
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum SwapRouterQueryMsg {
	// TODO
}
