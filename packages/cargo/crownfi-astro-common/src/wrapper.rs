use cosmwasm_schema::QueryResponses;
use cosmwasm_std::{Addr, Binary, Empty, Uint128};

#[cosmwasm_schema::cw_serde]
pub enum CW20WrapperExecMsg {
	Receive(cw20::Cw20ReceiveMsg),
	Unwrap { receiver: Option<Addr> },
}

#[cosmwasm_schema::cw_serde]
pub enum ERC20WrapperExecMsg {
	Wrap {
		recipient: Binary,
		token_addr: String,
		amount: Uint128,
	},
	Unwrap {
		recipient: Option<Addr>,
	},
}

#[cosmwasm_schema::cw_serde]
#[derive(QueryResponses)]
pub enum TokenWrapperQueryMsg {
	#[returns(Empty)]
	Empty {},
}
