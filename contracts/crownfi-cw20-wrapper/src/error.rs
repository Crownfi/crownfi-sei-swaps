use cosmwasm_std::StdError;
use crownfi_swaps_common::impl_from_cosmwasm_std_error_common;

#[derive(thiserror::Error, Debug)]
pub enum Cw20WrapperError {
	#[error("StdError: {0}")]
	Std(#[from] StdError),
	#[error("The tokens received were not created by this contract")]
	TokenDoesntBelongToContract,
	#[error("No tokens were sent to this contract")]
	UnfundedCall,
}
impl_from_cosmwasm_std_error_common!(Cw20WrapperError);
