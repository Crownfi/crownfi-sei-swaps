use bitflags::bitflags;
use bytemuck::{Pod, Zeroable};
use cosmwasm_std::{Addr, Api, StdError, Storage};
use crownfi_cw_common::{data_types::canonical_addr::SeiCanonicalAddr, impl_serializable_as_ref, storage::{item::StoredItem, SerializableItem}};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

const MAX_TOTAL_FEE_BPS: u16 = 10_000;

pub const CONFIG_NAMESPACE: &str = "app_cfg";
bitflags! {
	/// Represents a set of flags. Note that the numeric type may grow in a minor version change
	#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Zeroable, Pod)]
	#[repr(transparent)]
	pub struct PoolPairConfigFlags: u8 {
		/// If true, this has been endorsed by the market maker (probably CrownFi)
		const ENDORSED = 0b00000001u8;
	}
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Zeroable, Pod)]
#[repr(C)]
pub struct PoolPairConfig {
	/// The head honcho, in most cases, this is actually the factory
	pub admin: SeiCanonicalAddr,
	/// Where to put the maker fees, set to "sei1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq703fpu" to disable.
	pub fee_receiver: SeiCanonicalAddr,
	/// The total fees (in bps) charged by a pair of this type
	pub total_fee_bps: u16,
	/// The amount of fees (in bps) collected by the Maker contract from this pair type
	pub maker_fee_bps: u16,
	_unused_1: [u8; 4], // Possible lower-bound fees 
	/// Collection of boolean values
	pub flags: PoolPairConfigFlags, // Possible lower-bound fees
	_unused_3: [u8; 7], // bit flags may be extended upon (plus we need the padding)
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, JsonSchema)]
pub struct PoolPairConfigJsonable {
	/// The head honcho, this is usually the factory contract
	pub admin: Addr,
	/// Where to put the maker fees, set to "sei1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq703fpu" to disable.
	pub fee_receiver: Addr,
	/// The total fees (in bps) charged by a pair of this type
	pub total_fee_bps: u16,
	/// The amount of fees (in bps) collected by the Maker contract from this pair type
	pub maker_fee_bps: u16,
	/// If true, this has been endorsed by the market maker (probably CrownFi)
	pub endorsed: bool
}

impl_serializable_as_ref!(PoolPairConfig);
impl StoredItem for PoolPairConfig {
	fn namespace() -> &'static [u8] {
		CONFIG_NAMESPACE.as_bytes()
	}
}
impl PoolPairConfig {
	pub fn load_non_empty(storage: & dyn Storage) -> Result<Self, StdError> where Self: Sized {
		match Self::load(storage)? {
			Some(result) => {
				Ok(result)
			},
			None => {
				Err(StdError::NotFound { kind: "PoolPairConfig".into() })
			}
		}
	}
	pub fn into_jsonable(&self, api: &dyn Api) -> Result<PoolPairConfigJsonable, StdError> {
		Ok(
			PoolPairConfigJsonable {
				admin: self.admin.into_addr_using_api(api)?,
				fee_receiver: self.fee_receiver.into_addr_using_api(api)?,
				total_fee_bps: self.total_fee_bps,
				maker_fee_bps: self.maker_fee_bps,
				endorsed: self.flags.contains(PoolPairConfigFlags::ENDORSED)
			}
		)
	}
	pub fn valid_fee_bps(&self) -> bool {
		self.total_fee_bps <= MAX_TOTAL_FEE_BPS &&
		self.maker_fee_bps <= self.total_fee_bps
	}
}
impl PoolPairConfigJsonable {
	pub fn into_storable(&self, api: &dyn Api) -> Result<PoolPairConfig, StdError> {
		let mut flags = PoolPairConfigFlags::empty();
		if self.endorsed {
			flags = flags.union(PoolPairConfigFlags::ENDORSED);
		}
		Ok(
			PoolPairConfig {
				admin: SeiCanonicalAddr::from_addr_using_api(&self.admin, api)?,
				fee_receiver: SeiCanonicalAddr::from_addr_using_api(&self.fee_receiver, api)?,
				total_fee_bps: self.total_fee_bps,
				maker_fee_bps: self.maker_fee_bps,
				flags,
				.. Zeroable::zeroed()
			 }
		)
	}
}

// TODO: Rotating queue for:
// Hourly volume with 24 hr retention
// Daily volume with 7 day retention
