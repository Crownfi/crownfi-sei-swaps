#[derive(thiserror::Error, Debug)]
pub enum Error {
	#[error("The tokens received were not created by this contract")]
	TokenDoesntBelongToContract,
	#[error("No tokens were sent to this contract")]
	UnfundedCall,
}
