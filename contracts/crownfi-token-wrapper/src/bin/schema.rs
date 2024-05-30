use cosmwasm_schema::write_api;
use cosmwasm_std::Empty;

use crownfi_astro_common::wrapper::TokenWrapperExecMsg;

fn main() {
	write_api! {
		execute: TokenWrapperExecMsg,
		migrate: Empty,
		instantiate: Empty,
	};
}
