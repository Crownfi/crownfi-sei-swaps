use cosmwasm_std::{BankMsg, Coin, Response, StdResult, Uint128};
use crownfi_cw_common::storage::base::{storage_read, storage_write};
use sei_cosmwasm::SeiMsg;

// These workarounds exist because of this issue: https://github.com/sei-protocol/sei-wasmd/issues/38
pub fn mint_workaround(response: Response<SeiMsg>, coin: Coin) -> StdResult<Response<SeiMsg>> {
	let cur_supply = total_supply_workaround(&coin.denom);
	storage_write(
		coin.denom.as_bytes(),
		&cur_supply.checked_add(coin.amount)?.u128().to_le_bytes(),
	);
	Ok(response.add_message(SeiMsg::MintTokens { amount: coin.clone() }))
}

pub fn burn_token_workaround(response: Response<SeiMsg>, coin: Coin) -> StdResult<Response<SeiMsg>> {
	let cur_supply = total_supply_workaround(&coin.denom);
	storage_write(
		coin.denom.as_bytes(),
		&cur_supply.checked_sub(coin.amount)?.u128().to_le_bytes(),
	);
	Ok(response.add_message(BankMsg::Burn { amount: vec![coin] }))
}

pub fn total_supply_workaround(denom: &str) -> Uint128 {
	// We'll never know if users have burned any tokens
	Uint128::new(u128::from_le_bytes(
		storage_read(denom.as_bytes())
			.map(|vec| vec.try_into().unwrap_or_default())
			.unwrap_or_default(),
	))
}
