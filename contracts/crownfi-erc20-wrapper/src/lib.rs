use anyhow::Result;
use cosmwasm_std::{Addr, BankMsg, Coin, CosmosMsg, DepsMut, Empty, Env, MessageInfo, Response, SubMsg, Uint128};
use crownfi_cw_common::storage::map::StoredMap;
use sei_cosmwasm::{SeiMsg, SeiQuerier, SeiQueryWrapper};

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
	deps: DepsMut<SeiQueryWrapper>,
	env: Env,
	info: MessageInfo,
	msg: Erc20WrapperExec,
) -> Result<Response<SeiMsg>> {
	let known_tokens = StoredMap::<[u8; 20], bool>::new(b"known_tokens");
	let sei_querier = SeiQuerier::new(&deps.querier);

	let response = match msg {
		Erc20WrapperExec::Wrap {
			recipient,
			token_addr,
			amount,
		} => {
			if info.funds.len() > 0 {
				return Err(Error::UnexpectedFunds.into());
			}

			let recipient = recipient.unwrap_or(info.sender);

			let token_addr = if &token_addr[..2] == "0x" {
				&token_addr[2..]
			} else {
				&token_addr
			}
			.to_string();
			let bare_addr: [u8; 20] = hex::FromHex::from_hex(&token_addr)?;

			let extra_msg = if !known_tokens.has(&bare_addr) {
				known_tokens.set(&bare_addr, &true)?;
				Some(SeiMsg::CreateDenom {
					subdenom: format!("crfi{token_addr}"),
				})
			} else {
				None
			};

			let payload = sei_querier
				.erc20_transfer_from_payload(recipient.to_string(), env.contract.address.to_string(), amount)?
				.encoded_payload;
			let denom = format!("factory/{}/crfi{token_addr}", env.contract.address);
			let amount = Coin { amount, denom };

			Response::new()
				.add_message(SeiMsg::CallEvm {
					to: token_addr,
					data: payload,
					value: 0u128.into(),
				})
				.add_messages(extra_msg)
				.add_message(SeiMsg::MintTokens { amount: amount.clone() })
				.add_submessage(SubMsg::new(CosmosMsg::Bank(BankMsg::Send {
					amount: vec![amount],
					to_address: recipient.to_string(),
				})))
		}
		Erc20WrapperExec::Unwrap(recipient) => {
			let recipient = recipient.unwrap_or(info.sender);
			let mut msgs = Vec::with_capacity(info.funds.len() * 2);

			for fund in info.funds {
				// i wish i knew the size of the contract address at constant time
				let den_len = fund.denom.len();
				if den_len < 44 {
					return Err(Error::TokenDoesntBelongToContract.into());
				}

				// SAFETY: denom is guaranteed to be at least 44 bytes long
				let token_addr = unsafe {
					let shifted_ptr = fund.denom.as_ptr().add(den_len - 40);
					std::ptr::read(shifted_ptr as *const [u8; 40])
				};
				let bare_addr: [u8; 20] = hex::FromHex::from_hex(&token_addr)?;

				if !known_tokens.has(&bare_addr) {
					return Err(Error::TokenDoesntBelongToContract.into());
				}

				let evm_payload = sei_querier
					.erc20_transfer_payload(recipient.to_string(), fund.amount)?
					.encoded_payload;
				msgs.push(SeiMsg::CallEvm {
					to: String::from_utf8(token_addr.to_vec())?,
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

#[derive(thiserror::Error, Debug)]
pub enum Error {
	#[error("Tokens are not expected to be sent to this method")]
	UnexpectedFunds,
	#[error("The tokens received were not created by this contract")]
	TokenDoesntBelongToContract,
	#[error("No tokens were sent to this contract")]
	UnfundedCall,
}

#[cosmwasm_schema::cw_serde]
pub enum Erc20WrapperExec {
	Wrap {
		recipient: Option<Addr>,
		token_addr: String,
		amount: Uint128,
	},
	Unwrap(Option<Addr>),
}
