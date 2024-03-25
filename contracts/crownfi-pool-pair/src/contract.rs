use cosmwasm_std::{MessageInfo, Uint128};
use crownfi_swaps_common::data_types::pair_id::CanonicalPoolPairIdentifier;
use cw_utils::PaymentError;

use crate::error::PoolPairContractError;


#[derive(Copy, Clone, Default, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) struct OneOfPairResult {
	pub amount: Uint128,
	pub is_right: bool
}
pub(crate) fn must_pay_one_of_pair(
	info: &MessageInfo,
	pair: &CanonicalPoolPairIdentifier
) -> Result<OneOfPairResult, PaymentError> {
	if info.funds.is_empty() {
        return Ok(OneOfPairResult::default());
    }
	if info.funds.len() > 1 {
		return Err(PaymentError::MultipleDenoms {});
	}
	if info.funds[0].denom == pair.left {
		Ok(
			OneOfPairResult {
				amount: info.funds[0].amount,
				is_right: false
			}
		)
	} else if info.funds[0].denom == pair.right {
		Ok(
			OneOfPairResult {
				amount: info.funds[0].amount,
				is_right: true
			}
		)
	} else {
		Err(PaymentError::ExtraDenom(info.funds[0].denom.clone()))
	}
}

pub (crate) fn must_pay_pair(
	info: &MessageInfo,
	pair: &CanonicalPoolPairIdentifier
) -> Result<(Uint128, Uint128), PoolPairContractError> {
	let [funds_left, funds_right] = info.funds.as_slice() else {
		// The above let assignment only works if the vec is of length 2, this ain't JS/TS destructuring.
		return Err(PoolPairContractError::MustPayPair);
	};
	if funds_left.denom != pair.left || funds_right.denom != pair.right {
		return Err(
			PaymentError::ExtraDenom(
				if pair.is_in_pair(&funds_left.denom) {
					funds_right.denom.clone()
				} else {
					funds_left.denom.clone()
				}
			).into()
		)
	}
	Ok(
		(funds_left.amount, funds_right.amount)
	)
}
