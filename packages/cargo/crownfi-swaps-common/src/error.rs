use cw_utils::PaymentError;
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum CrownfiSwapsCommonError {
	#[error("Payment error: {0}")]
	PaymentError(#[from] PaymentError),
	#[error("This message requires both denoms in the trading pair")]
	MustPayPair,
	#[error("All denoms provided must have a non-zero amount")]
	PaymentIsZero,
	#[error("Permission denied: {0}")]
	Unauthorized(String),
	#[error("This instruction require a pair of coins to be supplied")]
	NeedsTwoCoins,
	#[error("This action would result in a 0 payout")]
	PayoutIsZero,
}
