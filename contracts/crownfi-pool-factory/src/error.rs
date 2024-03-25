use cosmwasm_std::StdError;
use crownfi_swaps_common::impl_from_cosmwasm_std_error_common;
use cw_utils::{ParseReplyError, PaymentError};
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum PoolFactoryContractError {
	#[error("StdError: {0}")]
	Std(#[from] StdError),
	#[error("Payment error: {0}")]
	PaymentError(#[from] PaymentError),
	#[error("Failed reply: {0}")]
	FailedReply(#[from] ParseReplyError),
	#[error("Permission denied: {0}")]
	Unauthorized(String),
	#[error("This instruction require a pair of coins to be supplied")]
	NeedsTwoCoins
}

impl_from_cosmwasm_std_error_common!(PoolFactoryContractError);
