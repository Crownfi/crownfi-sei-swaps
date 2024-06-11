use anyhow::Result;
use cosmwasm_std::{BankMsg, Binary, Coin, CosmosMsg, DepsMut, Empty, Env, MessageInfo, Response, SubMsg, Uint128};
use crownfi_astro_common::wrapper::ERC20WrapperExecMsg;
use crownfi_cw_common::{data_types::canonical_addr::SeiCanonicalAddr, storage::map::StoredMap};
use sei_cosmwasm::{SeiMsg, SeiQueryWrapper};

const CONTRACT_NAME: &str = env!("CARGO_PKG_NAME");
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

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
				.add_message(SeiMsg::CallEvm {
					to: token_addr,
					data: payload,
					value: Uint128::zero(),
				})
				.add_messages(extra_msg)
				.add_message(SeiMsg::MintTokens { amount: amount.clone() })
				.add_submessage(SubMsg::new(CosmosMsg::Bank(BankMsg::Send {
					amount: vec![amount],
					to_address: info.sender.to_string(),
				})))
		}
		ERC20WrapperExecMsg::Unwrap { recipient } => {
			let mut msgs: Vec<CosmosMsg<SeiMsg>> = Vec::with_capacity(info.funds.len() * 2);

			for fund in info.funds {
				let splited_denom = fund.denom.split('/').collect::<Box<[_]>>();
				splited_denom
					.get(1)
					.and_then(|x| if *x == env.contract.address { Some(x) } else { None })
					.ok_or(Error::TokenDoesntBelongToContract)?;

				let token_addr = splited_denom[2].replace("crwn", "0x");
				let evm_payload = encode_transfer_payload(recipient.as_slice().try_into()?, fund.amount);
				msgs.push(
					SeiMsg::CallEvm {
						to: token_addr,
						data: evm_payload,
						value: 0u128.into(),
					}
					.into(),
				);
				msgs.push(BankMsg::Burn { amount: vec![fund] }.into());
			}

			Response::new().add_messages(msgs)
		}
	};

	Ok(response)
}

const TRANSFER_SIG: &[u8] = b"\xa9\x05\x9c\xbb";
const TRANSFER_FROM_SIG: &[u8] = b"\x23\xb8\x72\xdd";

fn encode_transfer_from_payload(owner: Binary, recipient: SeiCanonicalAddr, amount: Uint128) -> Result<String, Error> {
	let mut buff = [0u8; 88];
	buff[..4].copy_from_slice(TRANSFER_FROM_SIG);

	if owner.len() != 20 {
		return Err(Error::InvalidEvmAddress(owner.to_string()));
	}

	let mut buff = Vec::with_capacity(100);
	buff.extend_from_slice(TRANSFER_FROM_SIG);
	buff.extend_from_slice(&[0; 12]);
	buff.extend_from_slice(owner.as_slice());
	buff.extend_from_slice(&[0; 12]);
	buff.extend_from_slice(&recipient.as_slice()[12..]);
	buff.extend_from_slice(&[0; 16]);
	buff.extend_from_slice(&amount.to_be_bytes());

	Ok(Binary::from(buff).to_base64())
}

fn encode_transfer_payload(recipient: [u8; 20], amount: Uint128) -> String {
	let mut buff = Vec::with_capacity(68);

	buff.extend_from_slice(TRANSFER_SIG);
	buff.extend_from_slice(&[0; 12]);
	buff.extend_from_slice(recipient.as_slice());
	buff.extend_from_slice(&[0; 16]);
	buff.extend_from_slice(&amount.to_be_bytes());

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

// #[cfg(test)]
// mod tests {
// 	use super::*;
//
// 	// if it runs fine, there's no corrupted memory (i've also checked everything externally with valgrind)
// 	#[test]
// 	fn transfer_encoding() {
// 		let recipient = SeiCanonicalAddr::try_from("sei1grzhksjfvg2s8mvgetmkncv67pr90kk37cfdhq").unwrap();
// 		let amount: Uint128 = 69420u128.into();
//
// 		let mut tmp = vec![];
// 		tmp.extend_from_slice(TRANSFER_SIG);
// 		tmp.extend_from_slice(&unsafe { std::mem::transmute::<_, [u8; 32]>(recipient) });
// 		tmp.extend_from_slice(&[0; 16]);
// 		tmp.extend_from_slice(&amount.to_be_bytes());
//
// 		let to_test = encode_transfer_payload(recipient.as_slice().try_into().unwrap(), amount);
// 		assert_eq!(to_test, Binary::from(tmp).to_base64())
// 	}
//
// 	#[test]
// 	fn transfer_from_encoding() {
// 		let owner = Binary::from(hex::decode("1c6b4962b120aaa82259c2a010e23a640af3d4be").unwrap());
// 		let recipient = SeiCanonicalAddr::try_from("sei1grzhksjfvg2s8mvgetmkncv67pr90kk37cfdhq").unwrap();
// 		let amount: Uint128 = 69420u128.into();
//
// 		let mut buff = Vec::with_capacity(88);
// 		buff.extend_from_slice(TRANSFER_FROM_SIG);
// 		buff.extend_from_slice(&[0; 12]);
// 		buff.extend_from_slice(owner.as_slice());
// 		buff.extend_from_slice(&[0; 12]);
// 		buff.extend_from_slice(&recipient.as_slice()[12..]);
// 		buff.extend_from_slice(&[0; 16]);
// 		buff.extend_from_slice(&amount.to_be_bytes());
//
// 		let to_test = encode_transfer_from_payload(owner, recipient, amount).unwrap();
// 		dbg!(buff.len());
// 		assert_eq!(to_test, Binary::from(buff).to_base64())
// 	}
// }
