
#[macro_export]
macro_rules! impl_from_cosmwasm_std_error {
	($from_type:ty, $to_type:ty) => {
		impl From<$from_type> for $to_type  {
			fn from(value: $from_type) -> Self {
				Self::Std(value.into())
			}
		}
	};
}

#[macro_export]
macro_rules! impl_from_cosmwasm_std_error_common {
	($to_type:ty) => {
		$crate::impl_from_cosmwasm_std_error!(cosmwasm_std::ConversionOverflowError, $to_type);
		$crate::impl_from_cosmwasm_std_error!(cosmwasm_std::DivideByZeroError, $to_type);
		$crate::impl_from_cosmwasm_std_error!(cosmwasm_std::OverflowError, $to_type);
		impl From<cosmwasm_std::CheckedFromRatioError> for $to_type {
			fn from(value: cosmwasm_std::CheckedFromRatioError) -> Self {
				Self::Std(
					match value {
						cosmwasm_std::CheckedFromRatioError::DivideByZero => {
							cosmwasm_std::DivideByZeroError::new("?").into()
						},
						cosmwasm_std::CheckedFromRatioError::Overflow => {
							cosmwasm_std::OverflowError::new(cosmwasm_std::OverflowOperation::Mul, "?", "?").into()
						}
					}
				)
			}
		}
		impl From<cosmwasm_std::CheckedMultiplyFractionError> for $to_type {
			fn from(value: cosmwasm_std::CheckedMultiplyFractionError) -> Self {
				Self::Std(
					match value {
						cosmwasm_std::CheckedMultiplyFractionError::DivideByZero(inner) => inner.into(),
						cosmwasm_std::CheckedMultiplyFractionError::ConversionOverflow(inner) => inner.into(),
						cosmwasm_std::CheckedMultiplyFractionError::Overflow(inner) => inner.into(),
					}
				)
			}
		}
		impl From<cosmwasm_std::CheckedMultiplyRatioError> for $to_type {
			fn from(value: cosmwasm_std::CheckedMultiplyRatioError) -> Self {
				Self::Std(
					match value {
						cosmwasm_std::CheckedMultiplyRatioError::DivideByZero => {
							cosmwasm_std::DivideByZeroError::new("?").into()
						},
						cosmwasm_std::CheckedMultiplyRatioError::Overflow => {
							cosmwasm_std::OverflowError::new(cosmwasm_std::OverflowOperation::Mul, "?", "?").into()
						},
					}
				)
			}
		}
		$crate::impl_from_cosmwasm_std_error!(cosmwasm_std::CoinFromStrError, $to_type);
		$crate::impl_from_cosmwasm_std_error!(cosmwasm_std::CoinsError, $to_type);
		impl From<cosmwasm_std::DivisionError> for $to_type {
			fn from(value: cosmwasm_std::DivisionError) -> Self {
				Self::Std(
					match value {
						cosmwasm_std::DivisionError::DivideByZero => {
							cosmwasm_std::DivideByZeroError::new("?").into()
						},
						cosmwasm_std::DivisionError::Overflow => {
							cosmwasm_std::OverflowError::new(cosmwasm_std::OverflowOperation::Mul, "?", "1/?").into()
						},
					}
				)
			}
		}
		$crate::impl_from_cosmwasm_std_error!(cosmwasm_std::RecoverPubkeyError, $to_type);
		$crate::impl_from_cosmwasm_std_error!(cosmwasm_std::VerificationError, $to_type);
	};
}
