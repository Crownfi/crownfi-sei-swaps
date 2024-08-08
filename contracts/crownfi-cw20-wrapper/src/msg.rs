use cosmwasm_schema::QueryResponses;
use cosmwasm_std::Addr;

#[cosmwasm_schema::cw_serde]
pub enum CW20WrapperExecMsg {
	Receive(cw20::Cw20ReceiveMsg),
	Unwrap { receiver: Option<Addr> },
}

#[cosmwasm_schema::cw_serde]
#[derive(QueryResponses)]
pub enum CW20WrapperQueryMsg {
	#[returns(Option<Addr>)]
	UnwrappedAddrOf { denom: String },
	#[returns(Option<String>)]
	WrappedDenomOf { cw20: Addr },
}
