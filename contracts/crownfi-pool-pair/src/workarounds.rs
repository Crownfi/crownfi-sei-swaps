use cosmwasm_std::{coin, Addr, BankMsg, Response, StdResult, Storage, Uint128};
use sei_cosmwasm::SeiMsg;

// These workarounds exist because of this issue: https://github.com/sei-protocol/sei-wasmd/issues/38
pub fn mint_to_workaround(
	response: Response<SeiMsg>,
	storage: &mut dyn Storage,
	denom: &str,
	addr: &Addr,
	amount: u128
) -> StdResult<Response<SeiMsg>> {
	let cur_supply = total_supply_workaround(
		storage,
		denom
	);
	storage.set(
		denom.as_bytes(),
		&cur_supply.checked_add(amount.into())?.u128().to_le_bytes()
	);
	Ok(
		response.add_message(
			SeiMsg::MintTokens {
				amount: coin(
					amount,
					denom
				)
			}
		)
		.add_message(
			BankMsg::Send {
				to_address: addr.to_string(),
				amount: vec![
					coin(
						amount,
						denom
					)
				]
			}
		)
	)
}

pub fn mint_workaround(
	storage: &mut dyn Storage,
	denom: &str,
	amount: u128
) -> StdResult<SeiMsg> {
	let cur_supply = total_supply_workaround(
		storage,
		denom
	);
	storage.set(
		denom.as_bytes(),
		&cur_supply.checked_add(amount.into())?.u128().to_le_bytes()
	);
	Ok(
		SeiMsg::MintTokens {
			amount: coin(
				amount,
				denom
			)
		}
	)
}

pub fn total_supply_workaround(storage: & dyn Storage, denom: &str) -> Uint128 {
	// We'll never know if users have burned any tokens
	Uint128::new(
		u128::from_le_bytes(
			storage.get(denom.as_bytes()).map(|vec| {
				vec.try_into().unwrap_or_default()
			}).unwrap_or_default()
		)
	)
}
