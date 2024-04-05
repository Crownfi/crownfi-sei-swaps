use std::{fmt::Display, ops::Deref};

use borsh::{BorshDeserialize, BorshSerialize};
use cosmwasm_std::{StdError, Storage};
use crownfi_cw_common::{
	impl_serializable_borsh,
	storage::{item::StoredItem, SerializableItem},
};

const NEW_POOL_NAMESPACE: &str = "poolid";
/// Represents a pool ID as it is marketed, not necessarily as it's actually stored.
#[derive(Debug, Clone, PartialEq, Eq, BorshDeserialize, BorshSerialize)]
pub struct PoolPairIdentifier {
	pub left: String,
	pub right: String,
}
impl_serializable_borsh!(PoolPairIdentifier);
impl PoolPairIdentifier {
	#[inline]
	pub fn denom(&self, right: bool) -> &str {
		if right {
			&self.right
		} else {
			&self.left
		}
	}

	/// If the passed denom is equal to `self.left`, a reference to `self.right` is returned and vice versa. If the
	/// denom passed is not in the pair, `None` is returned.
	#[inline]
	pub fn other_denom(&self, denom: &str) -> Option<&str> {
		if denom == self.left {
			Some(&self.right)
		} else if denom == self.right {
			Some(&self.left)
		} else {
			None
		}
	}

	#[inline]
	pub fn is_in_pair(&self, denom: &str) -> bool {
		return denom == self.left || denom == self.right;
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

	/// Ensures that `self.left` and `self.right` are in lexicographical order by swapping the properties if they are
	/// not.
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

	/// calls `self.make_canonical()` and also returns a reference to `self` casted as `CanonicalPoolPairIdentifier`
	/// without the need to clone or move.
	#[inline]
	pub fn as_canonical_forced(&mut self) -> &mut CanonicalPoolPairIdentifier {
		self.make_canonical();
		// SAFTY: CanonicalPoolPairIdentifier is #[repr(transparent)] with Self
		// We also just checked if we're canonical
		unsafe { std::mem::transmute(self) }
	}

	/// Casts `&self` as `&CanonicalPoolPairIdentifier` without the need to clone or move.
	///
	/// # Safty
	///
	/// You must be sure that the `left` and `right` properties of `self` are already in lexicographical order.
	///
	/// If you cannot guarantee this, use the `as_canonical_forced()` or `as_canonical()` methods instead.
	#[inline]
	pub unsafe fn as_canonical_unchecked(&self) -> &CanonicalPoolPairIdentifier {
		std::mem::transmute(self)
	}
}
impl From<(String, String)> for PoolPairIdentifier {
	fn from(value: (String, String)) -> Self {
		Self {
			left: value.0,
			right: value.1,
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
		Self { left, right }
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

/// This is just a wrapper on-top of `PoolPairIdentifier`, except with a guarantee that the "left" and "right" portions
/// are in lexicographical order. Thus representing the "real" Pool ID.
///
/// All the properties and methods of the underlying `PoolPairIdentifier` can be used and accessed, and this type can
/// even be used anywhere a `&PoolPairIdentifier` can, but only in a read-only fasion, as mutable access may break the
/// guarantee provided by this type.
#[repr(transparent)]
#[derive(Debug, Clone, PartialEq, Eq, BorshSerialize)]
pub struct CanonicalPoolPairIdentifier(PoolPairIdentifier);
impl BorshDeserialize for CanonicalPoolPairIdentifier {
	fn deserialize_reader<R: std::io::prelude::Read>(reader: &mut R) -> std::io::Result<Self> {
		Ok(PoolPairIdentifier::deserialize_reader(reader)?.into())
	}
}
impl_serializable_borsh!(CanonicalPoolPairIdentifier);
impl CanonicalPoolPairIdentifier {
	pub fn load_non_empty(storage: &dyn Storage) -> Result<Self, StdError>
	where
		Self: Sized,
	{
		match Self::load(storage)? {
			Some(result) => Ok(result),
			None => Err(StdError::NotFound {
				kind: "PoolPairIdentifier".into(),
			}),
		}
	}
}
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
			Self(PoolPairIdentifier {
				left: value.0,
				right: value.1,
			})
		} else {
			Self(PoolPairIdentifier {
				left: value.1,
				right: value.0,
			})
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
			std::mem::swap(&mut left, &mut right);
		}
		Self(PoolPairIdentifier { left, right })
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
