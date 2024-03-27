use std::{fmt::Display, ops::Deref};

use borsh::{BorshDeserialize, BorshSerialize};
use cosmwasm_std::{StdError, Storage};
use crownfi_cw_common::{impl_serializable_borsh, storage::{item::StoredItem, SerializableItem}};

const NEW_POOL_NAMESPACE: &str = "poolid";
/// Represents a pool ID as it is marketed, not necessarily as it's referenced.
#[derive(Debug, Clone, PartialEq, Eq, BorshDeserialize, BorshSerialize)]
pub struct PoolPairIdentifier {
	pub left: String,
	pub right: String
}
impl_serializable_borsh!(PoolPairIdentifier);
impl PoolPairIdentifier {
	pub fn load_non_empty(storage: & dyn Storage) -> Result<Self, StdError> where Self: Sized {
		match Self::load(storage)? {
			Some(result) => {
				Ok(result)
			},
			None => {
				Err(StdError::NotFound { kind: "PoolPairIdentifier".into() })
			}
		}
	}

	#[inline]
	pub fn is_in_pair(&self, denom: &str) -> bool {
		return denom == self.left || denom == self.right
	}

	/// Swaps `self.left` with `self.right`
	#[inline]
	pub fn swap(&mut self) {
		std::mem::swap(&mut self.left, &mut self.right);
	}
	
	/// If true, then this pair identifier is canonical. That is, `self.left` and `self.right` are in lexicographical
	/// order.
	#[inline]
	pub fn is_canonical(&self) -> bool {
		self.right >= self.left
	}

	/// Ensures that `self.left` and `self.right` are in lexicographical order.
	#[inline]
	pub fn make_canonical(&mut self) {
		if !self.is_canonical() {
			self.swap();
		}
	}

	/// Returns `self` casted as `CanonicalPoolPairIdentifier`, but only if `self.left` and `self.right` are in
	/// lexicographical order.
	#[inline]
	pub fn as_canonical(&self) -> Option<&CanonicalPoolPairIdentifier> {
		if self.is_canonical() {
			// SAFTY: CanonicalPoolPairIdentifier is #[repr(transparent)] with Self
			// We also just checked if we're canonical
			Some(unsafe { std::mem::transmute(self) })
		} else {
			None
		}
	}

	/// calls `self.make_canonical()` and also returns a reference to `self`` casted as `CanonicalPoolPairIdentifier`
	/// without the need to clone or move.
	#[inline]
	pub fn as_canonical_forced(&mut self) -> &mut CanonicalPoolPairIdentifier {
		self.make_canonical();
		// SAFTY: CanonicalPoolPairIdentifier is #[repr(transparent)] with Self
		// We also just checked if we're canonical
		unsafe { std::mem::transmute(self) }
	}
}
impl StoredItem for PoolPairIdentifier {
	fn namespace() -> &'static [u8] {
		NEW_POOL_NAMESPACE.as_bytes()
	}
}
impl From<(String, String)> for PoolPairIdentifier {
	fn from(value: (String, String)) -> Self {
		Self {
			left: value.0,
			right: value.1
		}
	}
}
impl From<PoolPairIdentifier> for (String, String) {
	fn from(value: PoolPairIdentifier) -> Self {
		(value.left, value.right)
	}
}
impl From<[String; 2]> for PoolPairIdentifier {
	fn from(value: [String; 2]) -> Self {
		let [left, right] = value;
		Self {
			left,
			right
		}
	}
}
impl From<PoolPairIdentifier> for [String; 2] {
	fn from(value: PoolPairIdentifier) -> Self {
		[value.left, value.right]
	}
}
impl Display for PoolPairIdentifier {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		f.write_str(&self.left)?;
		f.write_str("<>")?;
		f.write_str(&self.right)?;
		Ok(())
	}
}
impl From<CanonicalPoolPairIdentifier> for PoolPairIdentifier {
	fn from(value: CanonicalPoolPairIdentifier) -> Self {
		value.0
	}
}

/// Represents a pool ID as it is marketed, not necessarily as it's referenced.
/// 
/// Note that while the `left` and `right` properties are still accessible, they aren't mutable. As that may break the
/// guarantee that this struct has them in lexicographical order.
#[repr(transparent)]
#[derive(Debug, Clone, PartialEq, Eq, BorshSerialize)]
pub struct CanonicalPoolPairIdentifier(PoolPairIdentifier);
impl BorshDeserialize for CanonicalPoolPairIdentifier {
	fn deserialize_reader<R: std::io::prelude::Read>(reader: &mut R) -> std::io::Result<Self> {
		Ok(PoolPairIdentifier::deserialize_reader(reader)?.into())
	}
}
impl_serializable_borsh!(CanonicalPoolPairIdentifier);
impl StoredItem for CanonicalPoolPairIdentifier {
	fn namespace() -> &'static [u8] {
		NEW_POOL_NAMESPACE.as_bytes()
	}
}
impl From<PoolPairIdentifier> for CanonicalPoolPairIdentifier {
	fn from(mut value: PoolPairIdentifier) -> Self {
		value.make_canonical();
		Self(value)
	}
}
impl From<(String, String)> for CanonicalPoolPairIdentifier {
	fn from(value: (String, String)) -> Self {
		if value.1 >= value.0 {
			Self (
				PoolPairIdentifier {
					left: value.0,
					right: value.1
				}
			)
		} else {
			Self (
				PoolPairIdentifier {
					left: value.1,
					right: value.0
				}
			)
		}
	}
}
impl From<CanonicalPoolPairIdentifier> for (String, String) {
	fn from(value: CanonicalPoolPairIdentifier) -> Self {
		(value.0.left, value.0.right)
	}
}
impl From<[String; 2]> for CanonicalPoolPairIdentifier {
	fn from(value: [String; 2]) -> Self {
		let [mut left, mut right] = value;
		if right < left {
			std::mem::swap(&mut left,&mut right);
		}
		Self (
			PoolPairIdentifier {
				left,
				right
			}
		)
	}
}
impl From<CanonicalPoolPairIdentifier> for [String; 2] {
	fn from(value: CanonicalPoolPairIdentifier) -> Self {
		[value.0.left, value.0.right]
	}
}
impl Deref for CanonicalPoolPairIdentifier {
	type Target = PoolPairIdentifier;
	fn deref(&self) -> &Self::Target {
		&self.0
	}
}
impl Display for CanonicalPoolPairIdentifier {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		f.write_str(&self.0.left)?;
		f.write_str("<>")?;
		f.write_str(&self.0.right)?;
		Ok(())
	}
}
