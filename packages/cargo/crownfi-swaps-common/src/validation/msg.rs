use cosmwasm_std::{Coin, MessageInfo, Uint128};
use cw_utils::PaymentError;

use crate::{data_types::pair_id::CanonicalPoolPairIdentifier, error::CrownfiSwapsCommonError};

#[inline]
pub fn two_coins<'msg>(msg_info: &'msg MessageInfo) -> Result<&'msg [Coin; 2], CrownfiSwapsCommonError> {
	if msg_info.funds.len() != 2 {
		return Err(CrownfiSwapsCommonError::NeedsTwoCoins);
	}
	if msg_info.funds[0].amount.is_zero() || msg_info.funds[1].amount.is_zero() {
		return Err(CrownfiSwapsCommonError::PaymentIsZero);
	}
	Ok(msg_info
		.funds
		.as_slice()
		.try_into()
		.expect("length was already checked"))
}

#[derive(Copy, Clone, Default, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct OneOfPairResult {
	pub amount: Uint128,
	pub inverse: bool,
}
pub fn must_pay_one_of_pair(
	info: &MessageInfo,
	pair: &CanonicalPoolPairIdentifier,
) -> Result<OneOfPairResult, PaymentError> {
	if info.funds.is_empty() {
		return Ok(OneOfPairResult::default());
	}
	if info.funds.len() > 1 {
		return Err(PaymentError::MultipleDenoms {});
	}
	if info.funds[0].denom == pair.left {
		Ok(OneOfPairResult {
			amount: info.funds[0].amount,
			inverse: false,
		})
	} else if info.funds[0].denom == pair.right {
		Ok(OneOfPairResult {
			amount: info.funds[0].amount,
			inverse: true,
		})
	} else {
		Err(PaymentError::ExtraDenom(info.funds[0].denom.clone()))
	}
}

pub fn must_pay_pair<'msg>(
	info: &'msg MessageInfo,
	pair: &'_ CanonicalPoolPairIdentifier,
) -> Result<[&'msg Coin; 2], CrownfiSwapsCommonError> {
	let [funds_left, funds_right] = info.funds.as_slice() else {
		// The above let assignment only works if the vec is of length 2, this ain't JS/TS destructuring.
		return Err(CrownfiSwapsCommonError::MustPayPair);
	};
	if funds_left.denom != pair.left || funds_right.denom != pair.right {
		return Err(PaymentError::ExtraDenom(if pair.is_in_pair(&funds_left.denom) {
			funds_right.denom.clone()
		} else {
			funds_left.denom.clone()
		})
		.into());
	}
	if funds_left.amount.is_zero() || funds_right.amount.is_zero() {
		return Err(CrownfiSwapsCommonError::PaymentIsZero);
	}
	Ok([funds_left, funds_right])
}
