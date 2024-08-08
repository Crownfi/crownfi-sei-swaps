#[derive(thiserror::Error, Debug)]
pub enum Error {
	#[error("Tokens are not expected to be sent to this method")]
	UnexpectedFunds,
	#[error("The `{0}` EVM address is not valid")]
	InvalidEvmAddress(String),
	#[error("The tokens received were not created by this contract")]
	TokenDoesntBelongToContract,
	// #[error("No tokens were sent to this contract")]
	// UnfundedCall,
	#[error("The ERC20 Contract is not valid")]
	InvalidERC20Contract,
	#[error("The reply id {0} is invalid")]
	InvalidReplyId(u64),
}
