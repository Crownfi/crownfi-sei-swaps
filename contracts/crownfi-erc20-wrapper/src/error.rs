use cosmwasm_std::{Binary, StdError};
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
	#[error("Failed to verify contract was an ERC20 token: {0}")]
	InvalidERC20Contract(StdError),
	#[error("The recipiant address must be 20 bytes long")]
	InvalidRecipient,
	#[error("The reply id {0} is invalid")]
	InvalidReplyId(u64),
	#[error("Unexpected reply from EVM contract: {0}")]
	UnexpectedEvmReply(Binary),
}
impl_from_cosmwasm_std_error_common!(Erc20WrapperError);
