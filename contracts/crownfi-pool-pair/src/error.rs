use cosmwasm_std::{Decimal, StdError};
use crownfi_swaps_common::{error::CrownfiSwapsCommonError, impl_from_cosmwasm_std_error_common};
use cw_utils::PaymentError;
use thiserror::Error;

use crate::contract::pool::{MAX_ALLOWED_TOLERANCE, MINIMUM_INITIAL_SHARES};

#[derive(Error, Debug, PartialEq)]
pub enum PoolPairContractError {
	#[error("StdError: {0}")]
	Std(#[from] StdError),
	#[error("{0}")]
	SwapsCommonError(#[from] CrownfiSwapsCommonError),
	#[error("Payment error: {0}")]
	PaymentError(#[from] PaymentError),
	#[error("Initial shares minted must be at least {}", MINIMUM_INITIAL_SHARES)]
    MinimumSharesAmountError,
	#[error("This pool has no liquidity!")]
	NoLiquidity,
	#[error("Provided tolerance exceeds {}", MAX_ALLOWED_TOLERANCE)]
    ToleranceTooHigh,
	#[error("Deposit amount is excessively imbalanced")]
	DepositTooImbalanced,
	#[error("Swap slippage ({0}) exceeds tolerance")]
	SlippageTooHigh(Decimal),
	#[error("The denoms of the coins provided must match that which was returned by \"canonical_pair_denoms\"")]
	DepositQueryDenomMismatch
}

impl_from_cosmwasm_std_error_common!(PoolPairContractError);
