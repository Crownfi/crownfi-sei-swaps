use cosmwasm_std::{Coin, Env};

pub static LP_SUBDENOM: &str = "lp";

#[inline]
pub fn lp_denom(env: &Env) -> String {
	// TODO: See if we can use OnceCell or something
	"factory/".to_string() + env.contract.address.as_str() + "/" + LP_SUBDENOM
}
#[inline]
pub fn lp_coin(env: &Env, amount: u128) -> Coin {
	Coin::new(amount, lp_denom(env))
}
