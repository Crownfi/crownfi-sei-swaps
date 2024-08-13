use cosmwasm_std::StdError;
use crownfi_swaps_common::impl_from_cosmwasm_std_error_common;
use cw_utils::{ParseReplyError, PaymentError};

#[derive(thiserror::Error, Debug)]
pub enum Erc20WrapperError {
	#[error("StdError: {0}")]
	Std(#[from] StdError),
	#[error("Payment error: {0}")]
	PaymentError(#[from] PaymentError),
	#[error("Failed reply: {0}")]
	FailedReply(#[from] ParseReplyError),
	#[error("The `{0}` EVM address is not valid")]
	InvalidEvmAddress(String),
	#[error("The tokens received were not created by this contract")]
	TokenDoesntBelongToContract,
	#[error("The ERC20 Contract is not valid")]
	InvalidERC20Contract,
	#[error("The recipiant address must be 20 bytes long")]
	InvalidRecipient,
	#[error("The reply id {0} is invalid")]
	InvalidReplyId(u64),
}
impl_from_cosmwasm_std_error_common!(Erc20WrapperError);
