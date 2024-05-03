use anyhow::Result;
use base64::prelude::*;
use cosmwasm_std::{Addr, BankMsg, Coin, CosmosMsg, DepsMut, Empty, Env, MessageInfo, Response, SubMsg};
use crownfi_cw_common::{
	data_types::canonical_addr::SeiCanonicalAddr,
	storage::{map::StoredMap, MaybeMutableStorage},
};
use sei_cosmwasm::{SeiMsg, SeiQueryWrapper};

const CONTRACT_NAME: &str = env!("CARGO_PKG_NAME");
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
#[inline]
pub fn instantiate(
	deps: DepsMut<SeiQueryWrapper>,
	_env: Env,
	_msg_info: MessageInfo,
	_msg: Empty,
) -> Result<Response<SeiMsg>> {
	cw2::set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
	Ok(Response::new())
}

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
#[inline]
pub fn execute(deps: DepsMut<SeiQueryWrapper>, env: Env, info: MessageInfo, msg: ExecMsg) -> Result<Response<SeiMsg>> {
	let make_native_denom = |subdenom: &str| format!("factory/{}/{subdenom}", env.contract.address);

	let storage = std::cell::RefCell::new(deps.storage);
	let storage = MaybeMutableStorage::new_mutable_shared(storage.into());
	let known_tokens = StoredMap::<SeiCanonicalAddr, ()>::new(b"known_tokens", storage);

	let response = match msg {
		ExecMsg::Receive(cw20_meta) => {
			let mut response = Response::new();
			let receiver = SeiCanonicalAddr::try_from(cw20_meta.msg.as_slice())
				.unwrap_or_else(|_| SeiCanonicalAddr::try_from(info.sender).unwrap());

			let token_contract = cw20::Cw20Contract(Addr::unchecked(&cw20_meta.sender));

			let canon_addr = SeiCanonicalAddr::try_from(token_contract.addr())?;
			let subdenom = BASE64_URL_SAFE_NO_PAD.encode(canon_addr.as_slice());
			let denom = make_native_denom(&subdenom);

			if !known_tokens.has(&canon_addr) {
				token_contract.meta(&deps.querier)?;
				known_tokens.set(&canon_addr, &())?;
				response.messages.push(SubMsg::new(SeiMsg::CreateDenom { subdenom }));
			}

			let amt = Coin {
				denom,
				amount: cw20_meta.amount,
			};

			response
				.add_message(SeiMsg::MintTokens { amount: amt.clone() })
				.add_submessage(SubMsg::new(CosmosMsg::Bank(BankMsg::Send {
					amount: vec![amt],
					to_address: receiver.to_string(),
				})))
		}
		ExecMsg::Unwrap { receiver } => {
			let receiver = receiver.unwrap_or(info.sender);
			let mut messages = Vec::<SeiMsg>::with_capacity(info.funds.len());
			let mut submessages = Vec::with_capacity(info.funds.len());

			for fund in info.funds {
				let addr = decode_addr_from_denom(&fund.denom)?;
				if !known_tokens.has(&addr) {
					return Err(Error::TokenDoesntBelongToContract.into());
				}

				messages.push(SeiMsg::BurnTokens { amount: fund.clone() });
				submessages.push(SubMsg::new(CosmosMsg::Bank(BankMsg::Send {
					amount: vec![Coin {
						amount: fund.amount,
						denom: addr.to_string(),
					}],
					to_address: receiver.to_string(),
				})));
			}

			Response::new().add_messages(messages).add_submessages(submessages)
		}
	};

	Ok(response)
}

fn decode_addr_from_denom(denom: &str) -> Result<SeiCanonicalAddr> {
	let subdenom = denom.split('/').last().unwrap();
	let decoded = BASE64_URL_SAFE_NO_PAD.decode(subdenom)?;

	let ret = match decoded.len() {
		20 => {
			let subdenom = unsafe { (decoded.as_ptr() as *const [u8; 20]).read() };
			SeiCanonicalAddr::from(subdenom)
		}
		32 => {
			let subdenom = unsafe { (decoded.as_ptr() as *const [u8; 32]).read() };
			SeiCanonicalAddr::from(subdenom)
		}
		_ => unreachable!(),
	};

	Ok(ret)
}

#[cosmwasm_schema::cw_serde]
pub enum ExecMsg {
	Receive(cw20::Cw20ReceiveMsg),
	Unwrap { receiver: Option<Addr> },
}

#[derive(thiserror::Error, Debug)]
pub enum Error {
	#[error("You can't wrap native tokens")]
	UnexpectedNativeFunds,
	#[error("The tokens received were not created by this contract")]
	TokenDoesntBelongToContract,
}
