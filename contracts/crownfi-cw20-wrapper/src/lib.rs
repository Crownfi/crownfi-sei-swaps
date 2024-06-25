use anyhow::Result;
use base32::Alphabet;
use cosmwasm_std::{
	to_json_binary, BankMsg, Binary, Coin, CosmosMsg, Deps, DepsMut, Empty, Env, MessageInfo, Response, SubMsg,
	Uint128, WasmMsg,
};
use crownfi_cw_common::{data_types::canonical_addr::SeiCanonicalAddr, storage::map::StoredMap};
use sei_cosmwasm::{SeiMsg, SeiQueryWrapper};

use error::Error;
use msg::*;

mod error;
pub mod msg;

const CONTRACT_NAME: &str = env!("CARGO_PKG_NAME");
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");
const BASE32_ALGORITHM: Alphabet = Alphabet::Rfc4648Lower { padding: false };

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
pub fn instantiate(
	deps: DepsMut<SeiQueryWrapper>,
	_env: Env,
	_info: MessageInfo,
	_msg: Empty,
) -> Result<Response<SeiMsg>> {
	cw2::set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
	Ok(Response::new())
}

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
pub fn execute(
	deps: DepsMut<SeiQueryWrapper>,
	env: Env,
	info: MessageInfo,
	msg: CW20WrapperExecMsg,
) -> Result<Response<SeiMsg>> {
	let known_tokens = StoredMap::<String, SeiCanonicalAddr>::new(b"known_tokens");

	Ok(match msg {
		CW20WrapperExecMsg::Receive(cw20_meta) => {
			if cw20_meta.amount == Uint128::zero() {
				return Err(Error::UnfundedCall.into());
			}

			let receiver = SeiCanonicalAddr::try_from(cw20_meta.msg.as_slice())
				.unwrap_or_else(|_| SeiCanonicalAddr::try_from(cw20_meta.sender.as_str()).unwrap());

			let token_contract = cw20::Cw20Contract(info.sender);

			let canon_addr = SeiCanonicalAddr::try_from(token_contract.addr())?;
			let mut subdenom = base32::encode(BASE32_ALGORITHM, canon_addr.as_slice());
			subdenom.truncate(44);
			let denom = format!("factory/{}/{subdenom}", env.contract.address);

			let extra_msg = if !known_tokens.has(&subdenom) {
				token_contract.meta(&deps.querier)?;
				known_tokens.set(&subdenom, &canon_addr)?;
				Some(SeiMsg::CreateDenom { subdenom })
			} else {
				None
			};

			let amt = Coin {
				denom,
				amount: cw20_meta.amount,
			};

			Response::new()
				.add_messages(extra_msg)
				.add_message(SeiMsg::MintTokens { amount: amt.clone() })
				.add_submessage(SubMsg::new(CosmosMsg::Bank(BankMsg::Send {
					amount: vec![amt],
					to_address: receiver.to_string(),
				})))
		}
		CW20WrapperExecMsg::Unwrap { receiver } => {
			let funds_len = info.funds.len();
			if funds_len == 0 {
				return Err(Error::UnfundedCall.into());
			}

			let receiver = receiver.unwrap_or(info.sender);
			let mut messages = Vec::<SeiMsg>::with_capacity(funds_len);
			let mut submessages = Vec::with_capacity(funds_len);

			for fund in info.funds {
				let splited_denom = fund.denom.split('/').collect::<Box<[_]>>();
				splited_denom
					.get(1)
					.and_then(|addr| {
						if *addr == env.contract.address {
							Some(addr)
						} else {
							None
						}
					})
					.ok_or(Error::TokenDoesntBelongToContract)?;

				let subdenom = splited_denom[2].to_string();
				let Some(addr) = known_tokens.get(&subdenom)? else {
					return Err(Error::TokenDoesntBelongToContract.into());
				};

				messages.push(SeiMsg::BurnTokens { amount: fund.clone() });
				submessages.push(SubMsg::new(WasmMsg::Execute {
					contract_addr: addr.to_string(),
					msg: to_json_binary(&cw20::Cw20ExecuteMsg::Transfer {
						amount: fund.amount,
						recipient: receiver.to_string(),
					})?,
					funds: vec![],
				}));
			}

			Response::new().add_messages(messages).add_submessages(submessages)
		}
	})
}

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
pub fn query(_deps: Deps, _env: Env, msg: CW20WrapperQueryMsg) -> Result<Binary> {
	let known_tokens = StoredMap::<String, SeiCanonicalAddr>::new(b"known_tokens");
	let CW20WrapperQueryMsg::UnwrappedAddrOf { denom } = msg;
	let subdenom = denom[denom.len() - 44..].to_string();

	let cw20_canon_addr = known_tokens.get(&subdenom)?.ok_or(Error::TokenDoesntBelongToContract)?;
	let cw20_addr: cosmwasm_std::Addr = cw20_canon_addr.into_inner().try_into()?;

	Ok(to_json_binary(&cw20_addr)?)
}

#[cfg(test)]
mod tests {
	use std::marker::PhantomData;

	use cosmwasm_std::{testing::*, Addr, OwnedDeps};

	use super::*;

	const RANDOM_ADDRESS: &str = "sei1zgfgerl8qt9uldlr0y9w7qe97p7zyv5kwg2pge";
	const RANDOM_ADDRESS2: &str = "sei19rl4cm2hmr8afy4kldpxz3fka4jguq0a3vute5";

	type ContractDeps = OwnedDeps<MockStorage, MockApi, MockQuerier, SeiQueryWrapper>;

	#[test]
	fn encode_decode_addr() -> Result<()> {
		crownfi_cw_common::storage::base::set_global_storage(Box::new(MockStorage::new()));
		let known_tokens = crownfi_cw_common::storage::map::StoredMap::new(b"banana");

		let addr = Addr::unchecked(RANDOM_ADDRESS);
		let canon_addr = SeiCanonicalAddr::try_from(&addr)?;
		let subdenom = base32::encode(BASE32_ALGORITHM, canon_addr.as_slice());

		known_tokens.set(&subdenom, &canon_addr)?;

		let canon_addr2 = known_tokens.get(&subdenom)?.unwrap();

		assert_eq!(canon_addr, *canon_addr2);
		// assert_eq!(decoded_addr.to_string(), RANDOM_ADDRESS);

		Ok(())
	}
}
