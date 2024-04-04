use cosmwasm_std::StdError;
use crownfi_swaps_common::{error::CrownfiSwapsCommonError, impl_from_cosmwasm_std_error_common};
use cw_utils::{ParseReplyError, PaymentError};
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum PoolFactoryContractError {
	#[error("StdError: {0}")]
	Std(#[from] StdError),
	#[error("{0}")]
	SwapsCommon(#[from] CrownfiSwapsCommonError),
	#[error("Payment error: {0}")]
	PaymentError(#[from] PaymentError),
	#[error("Failed reply: {0}")]
	FailedReply(#[from] ParseReplyError),
	#[error("Pair already exists")]
	PairAlreadyExists
}

impl_from_cosmwasm_std_error_common!(PoolFactoryContractError);
