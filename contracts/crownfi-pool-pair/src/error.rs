use cosmwasm_std::StdError;
use crownfi_swaps_common::impl_from_cosmwasm_std_error_common;
use cw_utils::PaymentError;
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum PoolPairContractError {
	#[error("StdError: {0}")]
	Std(#[from] StdError),
	#[error("Payment error: {0}")]
	PaymentError(#[from] PaymentError),
	#[error("This message requires both denoms in the trading pair")]
	MustPayPair,
	#[error("Nonzero payment required")]
	PaymentIsZero,
	#[error("Permission denied: {0}")]
	Unauthorized(String),
	#[error("This instruction expects no associated funds")]
	MustBeUnfunded,
	#[error("This instruction require a pair of coins to be supplied")]
	NeedsTwoCoins
}

impl_from_cosmwasm_std_error_common!(PoolPairContractError);
