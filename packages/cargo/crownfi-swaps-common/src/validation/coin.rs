use cosmwasm_std::StdError;

/// Maximum denom length
pub const DENOM_MAX_LENGTH: usize = 128;

/// Taken from https://github.com/mars-protocol/red-bank/blob/5bb0fe145588352b281803f7b870103bc6832621/packages/utils/src/helpers.rs#L68
/// Follows cosmos SDK validation logic where denom can be 3 - 128 characters long
/// and starts with a letter, followed but either a letter, number, or separator ( ‘/' , ‘:' , ‘.’ , ‘_’ , or '-')
/// reference: https://github.com/cosmos/cosmos-sdk/blob/7728516abfab950dc7a9120caad4870f1f962df5/types/coin.go#L865-L867
pub fn validate_native_denom(denom: &str) -> Result<(), StdError> {
	if denom.len() < 3 || denom.len() > DENOM_MAX_LENGTH {
		return Err(StdError::generic_err(format!(
			"Invalid denom length [3,{DENOM_MAX_LENGTH}]: {denom}"
		)));
	}

	let mut chars = denom.chars();
	let first = chars.next().unwrap();
	if !first.is_ascii_alphabetic() {
		return Err(StdError::generic_err(format!(
			"First character is not ASCII alphabetic: {denom}"
		)));
	}

	let set = ['/', ':', '.', '_', '-'];
	for c in chars {
		if !(c.is_ascii_alphanumeric() || set.contains(&c)) {
			return Err(StdError::generic_err(format!(
				"Not all characters are ASCII alphanumeric or one of:  /  :  .  _  -: {denom}"
			)));
		}
	}
	Ok(())
}
