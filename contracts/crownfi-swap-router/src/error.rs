use cosmwasm_std::StdError;
use crownfi_swaps_common::{error::CrownfiSwapsCommonError, impl_from_cosmwasm_std_error_common};
use cw_utils::{ParseReplyError, PaymentError};
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum SwapRouterContractError {
	#[error("StdError: {0}")]
	Std(#[from] StdError),
	#[error("{0}")]
	SwapsCommon(#[from] CrownfiSwapsCommonError),
	#[error("Payment error: {0}")]
	PaymentError(#[from] PaymentError),
	#[error("Failed reply: {0}")]
	FailedReply(#[from] ParseReplyError),
	#[error("Cannot execute a swap route while the previous one is incomplete")]
	AlreadyRoutingSwaps,
	#[error("Route cannot be empty")]
	RouteEmpty,
	#[error("Refusing to execute a trade where it's expected to lose everything")]
	ExpectingNothing,
	#[error("Swap route slippage exceeded tolerance")]
	SlippageTooHigh,
	#[error("Swap route was not fully executed")]
	IncompleteRoute,
	#[error("Swap route contains a contract which didn't accept the provided funds")]
	FundsIncompatibleWithSwapRoute,
}

impl_from_cosmwasm_std_error_common!(SwapRouterContractError);
