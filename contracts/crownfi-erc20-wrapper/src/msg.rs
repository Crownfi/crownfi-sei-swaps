use cosmwasm_std::{Addr, Binary, Uint128};

#[cosmwasm_schema::cw_serde]
pub enum ERC20WrapperExecMsg {
	Wrap {
		evm_sender: Binary,
		recipient: Option<Addr>,
		token_addr: String,
		amount: Uint128,
	},
	Unwrap {
		evm_recipient: Binary,
	},
}
