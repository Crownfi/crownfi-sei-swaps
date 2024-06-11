use anyhow::Result;
use cosmwasm_std::{
	BankMsg, Binary, Coin, CosmosMsg, DepsMut, Empty, Env, Event, MessageInfo, Response, SubMsg, Uint128,
};
use crownfi_astro_common::wrapper::ERC20WrapperExecMsg;
use crownfi_cw_common::{data_types::canonical_addr::SeiCanonicalAddr, storage::map::StoredMap};
use sei_cosmwasm::{SeiMsg, SeiQueryWrapper};

const CONTRACT_NAME: &str = env!("CARGO_PKG_NAME");
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg_attr(not(feature = "library"), cosmwasm_std::entry_point)]
pub fn reply(_deps: DepsMut<SeiQueryWrapper>, _env: Env, msg: cosmwasm_std::Reply) -> Result<Response> {
	Ok(Response::new().add_event(Event::new("banana").add_attribute("avocado", format!("{msg:?}"))))
}

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
	_deps: DepsMut<SeiQueryWrapper>,
	env: Env,
	info: MessageInfo,
	msg: ERC20WrapperExecMsg,
) -> Result<Response<SeiMsg>> {
	let known_tokens = StoredMap::<[u8; 20], bool>::new(b"known_tokens");

	let response = match msg {
		ERC20WrapperExecMsg::Wrap {
			recipient,
			token_addr,
			amount,
		} => {
			if info.funds.len() > 0 {
				return Err(Error::UnexpectedFunds.into());
			}

			let capped_tkn_addr = if &token_addr[..2] == "0x" {
				&token_addr[2..]
			} else {
				&token_addr
			}
			.to_string();
			let bare_addr: [u8; 20] = hex::FromHex::from_hex(&capped_tkn_addr)?;

			let subdenom = format!("crwn{capped_tkn_addr}");
			let denom = format!("factory/{}/{subdenom}", env.contract.address);

			let extra_msg = if !known_tokens.has(&bare_addr) {
				known_tokens.set(&bare_addr, &true)?;
				Some(SeiMsg::CreateDenom { subdenom })
			} else {
				None
			};

			let payload = encode_transfer_from_payload(recipient, (&env.contract.address).try_into()?, amount)?;
			let amount = Coin { amount, denom };

			Response::new()
				.add_messages(extra_msg)
				.add_message(SeiMsg::MintTokens { amount: amount.clone() })
				.add_submessage(SubMsg::new(SeiMsg::CallEvm {
					to: token_addr,
					data: payload,
					value: Uint128::zero(),
				}))
				.add_submessage(SubMsg::new(CosmosMsg::Bank(BankMsg::Send {
					amount: vec![amount],
					to_address: info.sender.to_string(),
				})))
		}
		ERC20WrapperExecMsg::Unwrap { recipient } => {
			// factory/{contract_address}/{44 bytes subdenom} == 115 bytes long
			const DENOM_LEN: usize = 115;
			let recipient = recipient.unwrap_or(info.sender);

			let mut msgs = Vec::with_capacity(info.funds.len() * 2);
			for fund in info.funds {
				let den_len = fund.denom.len();
				if den_len != DENOM_LEN {
					return Err(Error::TokenDoesntBelongToContract.into());
				}

				// SAFETY: denom is guaranteed to be at least 85 bytes long
				let token_addr = unsafe {
					let shifted_ptr = fund.denom.as_ptr().add(DENOM_LEN - 40);
					std::ptr::read(shifted_ptr as *const [u8; 40])
				};
				let bare_addr: [u8; 20] = hex::FromHex::from_hex(&token_addr)?;

				if !known_tokens.has(&bare_addr) {
					return Err(Error::TokenDoesntBelongToContract.into());
				}

				let evm_payload = encode_transfer_payload(recipient.clone().try_into()?, fund.amount);
				msgs.push(SeiMsg::CallEvm {
					// SAFETY: tokens_addr is already known as contract owned token (40hex digits, valid utf8)
					to: unsafe { String::from_utf8_unchecked(token_addr.to_vec()) },
					data: evm_payload,
					value: 0u128.into(),
				});
				msgs.push(SeiMsg::BurnTokens { amount: fund });
			}

			Response::new().add_messages(msgs)
		}
	};

	Ok(response)
}

const TRANSFER_SIG: &[u8] = b"\x23\xb8\x72\xdd";
const TRANSFER_FROM_SIG: &[u8] = b"\xa9\x05\x9c\xbb";

fn encode_transfer_from_payload(owner: Binary, recipient: SeiCanonicalAddr, amount: Uint128) -> Result<String, Error> {
	let mut buff = [0u8; 100];
	// generates the same output as `std::ptr::write`, no need for unsafe
	buff[..4].copy_from_slice(TRANSFER_FROM_SIG);

	if owner.len() != 20 {
		return Err(Error::InvalidEvmAddress(owner.to_string()));
	}

	// SAFETY: contract will return an error if owner len differs from 20 (the size of a bare EVM address);
	// SeiCanonicalAddr has the same alignment as [u8; 32]
	// casting since everything is stack allocated and [T; N] aligns the same as size_of::<T>() * N, those pointers can safely be casted
	unsafe {
		let owner_addr = owner.as_ptr().cast::<[u8; 20]>().read();
		std::ptr::write(buff[16..36].as_mut_ptr().cast::<[u8; 20]>(), owner_addr);

		let recipient: [u8; 20] = (&recipient as *const SeiCanonicalAddr)
			.add(12)
			.cast::<[u8; 20]>()
			.read();
		std::ptr::write(buff[36 + 12..68].as_mut_ptr().cast::<[u8; 20]>(), recipient);

		let amt_bytes = amount.to_be_bytes();
		std::ptr::write(buff[84..].as_mut_ptr().cast::<[u8; 16]>(), amt_bytes);
	}

	Ok(Binary::from(buff).to_base64())
}

fn encode_transfer_payload(recipient: SeiCanonicalAddr, amount: Uint128) -> String {
	let mut buff = [0u8; 68];
	buff[..4].copy_from_slice(TRANSFER_SIG);

	// SAFETY: SeiCanonicalAddr has the same alignment as [u8; 32]
	// casting since everything is stack allocated and [T; N] aligns the same as size_of::<T>() * N, those pointers can safely be casted
	unsafe {
		let recipient: [u8; 32] = std::mem::transmute(recipient);
		std::ptr::write(buff[4..36].as_mut_ptr().cast::<[u8; 32]>(), recipient);

		let amt_bytes = amount.to_be_bytes();
		std::ptr::write(buff[52..].as_mut_ptr().cast::<[u8; 16]>(), amt_bytes);
	}

	Binary::from(buff).to_base64()
}

#[derive(thiserror::Error, Debug)]
pub enum Error {
	#[error("Tokens are not expected to be sent to this method")]
	UnexpectedFunds,
	#[error("The `{0}` EVM address is not valid")]
	InvalidEvmAddress(String),
	#[error("The tokens received were not created by this contract")]
	TokenDoesntBelongToContract,
	#[error("No tokens were sent to this contract")]
	UnfundedCall,
}

#[cfg(test)]
mod tests {
	use super::*;

	// if it runs fine, there's no corrupted memory (i've also checked everything externally with valgrind)
	#[test]
	fn transfer_encoding() {
		let recipient = SeiCanonicalAddr::try_from("sei1grzhksjfvg2s8mvgetmkncv67pr90kk37cfdhq").unwrap();
		let amount: Uint128 = 69420u128.into();

		let mut tmp = vec![];
		tmp.extend_from_slice(TRANSFER_SIG);
		tmp.extend_from_slice(&unsafe { std::mem::transmute::<_, [u8; 32]>(recipient) });
		tmp.extend_from_slice(&[0; 16]);
		tmp.extend_from_slice(&amount.to_be_bytes());

		let to_test = encode_transfer_payload(recipient, amount);
		assert_eq!(to_test, Binary::from(tmp).to_base64())
	}

	#[test]
	fn transfer_from_encoding() {
		let owner = Binary::from(hex::decode("1c6b4962b120aaa82259c2a010e23a640af3d4be").unwrap());
		let recipient = SeiCanonicalAddr::try_from("sei1grzhksjfvg2s8mvgetmkncv67pr90kk37cfdhq").unwrap();
		let amount: Uint128 = 69420u128.into();

		let mut tmp = vec![];
		tmp.extend_from_slice(TRANSFER_FROM_SIG);
		tmp.extend_from_slice(&[0; 12]);
		tmp.extend_from_slice(owner.as_slice());
		tmp.extend_from_slice(&[0; 12]);
		tmp.extend_from_slice(&unsafe {
			(&recipient as *const SeiCanonicalAddr)
				.add(12)
				.cast::<[u8; 20]>()
				.read()
		});
		tmp.extend_from_slice(&[0; 16]);
		tmp.extend_from_slice(&amount.to_be_bytes());

		let to_test = encode_transfer_from_payload(owner, recipient, amount).unwrap();
		assert_eq!(to_test, Binary::from(tmp).to_base64())
	}
}
