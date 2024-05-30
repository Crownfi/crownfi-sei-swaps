use cosmwasm_schema::QueryResponses;
use cosmwasm_std::{Addr, Empty};

#[cosmwasm_schema::cw_serde]
pub enum TokenWrapperExecMsg {
	Receive(cw20::Cw20ReceiveMsg),
	Unwrap { receiver: Option<Addr> },
}

#[cosmwasm_schema::cw_serde]
#[derive(QueryResponses)]
pub enum TokenWrapperQueryMsg {
    #[returns(Empty)]
    Empty {}
}