use cosmwasm_schema::write_api;

use crownfi_astro_common::token::TokenInstantiateMsg;
use cw20_base::msg::{ExecuteMsg, QueryMsg};

fn main() {
    write_api! {
        instantiate: TokenInstantiateMsg,
        query: QueryMsg,
        execute: ExecuteMsg,
    }
}
