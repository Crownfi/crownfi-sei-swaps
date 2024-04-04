use std::{cell::RefCell, num::NonZeroU8, rc::Rc};

use bitflags::bitflags;
use bytemuck::{Pod, Zeroable};
use cosmwasm_std::{Addr, StdError, Storage, Timestamp};
use crownfi_cw_common::{data_types::canonical_addr::SeiCanonicalAddr, extentions::timestamp::TimestampExtentions, impl_serializable_as_ref, storage::{item::StoredItem, queue::StoredVecDeque, MaybeMutableStorage, SerializableItem}};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::msg::VolumeQueryResponse;

const MAX_TOTAL_FEE_BPS: u16 = 10_000;

pub const CONFIG_NAMESPACE: &str = "app_cfg";
bitflags! {
	/// Represents a set of flags. Note that the numeric type may grow in a minor version change
	#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Zeroable, Pod)]
	#[repr(transparent)]
	pub struct PoolPairConfigFlags: u8 {
		/// If true, this is marketed as the inverse pair
		const INVERSE = 0b00000001u8;
		/// If true, this has been endorsed by the market maker (probably CrownFi)
		const ENDORSED = 0b00000010u8;
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
	/// If true, this is marketed as the inverse pair
	pub inverse: bool,
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

	pub fn valid_fee_bps(&self) -> bool {
		self.total_fee_bps <= MAX_TOTAL_FEE_BPS &&
		self.maker_fee_bps <= self.total_fee_bps
	}
}
impl TryFrom<&PoolPairConfigJsonable> for PoolPairConfig {
	type Error = StdError;
	fn try_from(value: &PoolPairConfigJsonable) -> Result<Self, Self::Error> {
		let mut flags = PoolPairConfigFlags::empty();
		if value.endorsed {
			flags = flags.union(PoolPairConfigFlags::ENDORSED);
		}
		Ok(
			PoolPairConfig {
				admin: (&value.admin).try_into()?,
				fee_receiver: (&value.fee_receiver).try_into()?,
				total_fee_bps: value.total_fee_bps,
				maker_fee_bps: value.maker_fee_bps,
				flags,
				.. Zeroable::zeroed()
			 }
		)
	}
}
impl TryFrom<&PoolPairConfig> for PoolPairConfigJsonable {
	type Error = StdError;
	fn try_from(value: &PoolPairConfig) -> Result<Self, Self::Error> {
		Ok(
			PoolPairConfigJsonable {
				admin: value.admin.try_into()?,
				fee_receiver: value.fee_receiver.try_into()?,
				total_fee_bps: value.total_fee_bps,
				maker_fee_bps: value.maker_fee_bps,
				inverse: value.flags.contains(PoolPairConfigFlags::INVERSE),
				endorsed: value.flags.contains(PoolPairConfigFlags::ENDORSED)
			}
		)
	}
}

const VOLUME_STATS_ALL_TIME_NAMESPACE: &[u8] = "volA".as_bytes();
const VOLUME_STATS_HOURLY_NAMESPACE: &[u8] = "volH".as_bytes();
const VOLUME_STATS_DAILY_NAMESPACE: &[u8] = "volD".as_bytes();

const MAX_HOURLY_RETENTION: u32 = 25;
const MAX_DAILY_RETENTION: u32 = 31;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Zeroable, Pod)]
#[repr(C)]
pub struct TradingVolume {
	pub from_time: u64,
	_unused: u64, // u128's require alignment to 16 bytes now.
	pub amount_left: u128,
	pub amount_right: u128
}
impl_serializable_as_ref!(TradingVolume);


const MILLISECONDS_IN_AN_HOUR: u64 = 1000 * 60 * 60;
const MILLISECONDS_IN_A_DAY: u64 = MILLISECONDS_IN_AN_HOUR * 24;

pub struct VolumeStatisticsCounter<'exec> {
	storage: MaybeMutableStorage<'exec>,
	hourly: StoredVecDeque<'exec, TradingVolume>,
	daily: StoredVecDeque<'exec, TradingVolume>
}
impl<'exec> VolumeStatisticsCounter<'exec> {
	pub fn new(storage: &'exec dyn Storage) -> Result<Self, StdError> {
		let storage = MaybeMutableStorage::Immutable(storage);
		Ok(
			Self {
				hourly: StoredVecDeque::new(VOLUME_STATS_HOURLY_NAMESPACE, storage.clone()),
				daily: StoredVecDeque::new(VOLUME_STATS_DAILY_NAMESPACE, storage.clone()),
				storage
			}
		)
	}
	pub fn new_mut(storage: Rc<RefCell<&'exec mut dyn Storage>>) -> Result<Self, StdError> {
		let storage = MaybeMutableStorage::MutableShared(storage);
		Ok(
			Self {
				hourly: StoredVecDeque::new(VOLUME_STATS_HOURLY_NAMESPACE, storage.clone()),
				daily: StoredVecDeque::new(VOLUME_STATS_DAILY_NAMESPACE, storage.clone()),
				storage
			}
		)
	}
	pub fn update_volumes(
		&mut self,
		current_timestamp: Timestamp,
		amount_left: u128,
		amount_right: u128
	) -> Result<(), StdError> {
		let timestamp_ms = current_timestamp.millis();
		let timestamp_hour = timestamp_ms / MILLISECONDS_IN_AN_HOUR;
		let timestamp_day = timestamp_ms / MILLISECONDS_IN_A_DAY;
		if self.hourly.is_empty() {
			self.hourly.push_back(
				&TradingVolume {
					from_time: timestamp_hour,
					amount_left,
					amount_right,
					..Zeroable::zeroed()
				}
			)?;
		} else {
			let mut latest_record = self.hourly.get_back()?.expect("is empty was checked");
			if latest_record.from_time < timestamp_hour {
				self.hourly.push_back(
					&TradingVolume {
						from_time: timestamp_hour,
						amount_left,
						amount_right,
						..Zeroable::zeroed()
					}
				)?;
			} else {
				latest_record.amount_left = latest_record.amount_left.saturating_add(amount_left);
				latest_record.amount_right = latest_record.amount_right.saturating_add(amount_right);
				self.hourly.set_back(&latest_record)?;
			}
			if self.hourly.len() > MAX_HOURLY_RETENTION {
				self.hourly.pop_front()?;
			}
		}
		if self.daily.is_empty() {
			self.daily.push_back(
				&TradingVolume {
					from_time: timestamp_day,
					amount_left,
					amount_right,
					..Zeroable::zeroed()
				}
			)?;
		} else {
			let mut latest_record = self.daily.get_back()?.expect("is empty was checked");
			if latest_record.from_time < timestamp_day {
				self.daily.push_back(
					&TradingVolume {
						from_time: timestamp_day,
						amount_left,
						amount_right,
						..Zeroable::zeroed()
					}
				)?;
			} else {
				latest_record.amount_left = latest_record.amount_left.saturating_add(amount_left);
				latest_record.amount_right = latest_record.amount_right.saturating_add(amount_right);
				self.daily.set_back(&latest_record)?;
			}
			if self.daily.len() > MAX_DAILY_RETENTION {
				self.daily.pop_front()?;
			}
		}
		if let Some(all_time_bytes) = self.storage.get(VOLUME_STATS_ALL_TIME_NAMESPACE) {
			let mut all_time = TradingVolume::deserialize(&all_time_bytes)?;
			all_time.amount_left = all_time.amount_left.saturating_add(amount_left);
			all_time.amount_right = all_time.amount_right.saturating_add(amount_right);
			self.storage.set(
				VOLUME_STATS_ALL_TIME_NAMESPACE,
				all_time.serialize_as_ref().unwrap()
			);
		} else {
			self.storage.set(
				VOLUME_STATS_ALL_TIME_NAMESPACE,
				TradingVolume {
					from_time: timestamp_ms,
					amount_left,
					amount_right,
					..Zeroable::zeroed()
				}.serialize_as_ref().unwrap()
			);
		}
		Ok(())
	}
	pub fn get_volume_all_time(
		&self,
		current_timestamp: Timestamp
	) -> Result<VolumeQueryResponse, StdError> {
		let timestamp_ms = current_timestamp.millis();
		if let Some(all_time) = self.storage.get(VOLUME_STATS_ALL_TIME_NAMESPACE).map(|all_time_bytes| {
			TradingVolume::deserialize(&all_time_bytes)
		}).transpose()? {
			Ok(
				VolumeQueryResponse {
					volume: [all_time.amount_left.into(), all_time.amount_right.into()],
					from_timestamp_ms: all_time.from_time,
					to_timestamp_ms: timestamp_ms
				}
			)
		} else {
			Ok(
				VolumeQueryResponse {
					to_timestamp_ms: timestamp_ms,
					.. Default::default()
				}
			)
		}
	}
	pub fn get_volume_since_hour_start(
		&self,
		current_timestamp: Timestamp
	) -> Result<VolumeQueryResponse, StdError> {
		let timestamp_ms = current_timestamp.millis();
		let timestamp_hour = timestamp_ms / MILLISECONDS_IN_AN_HOUR;
		// FIXME: use get().unwrap_or_default() instead of checking is_empty when StoredVecDeque is fixed.
		if self.hourly.is_empty() {
			Ok(
				VolumeQueryResponse {
					volume: [0u128.into(), 0u128.into()],
					from_timestamp_ms: timestamp_hour * MILLISECONDS_IN_AN_HOUR,
					to_timestamp_ms: timestamp_ms
				}
			)
		} else {
			let latest_record = self.hourly.get_back()?.expect("is empty was checked");
			Ok(
				VolumeQueryResponse {
					volume: if latest_record.from_time < timestamp_hour {
						[0u128.into(), 0u128.into()]
					} else {
						[latest_record.amount_left.into(), latest_record.amount_right.into()]
					},
					from_timestamp_ms: timestamp_hour * MILLISECONDS_IN_AN_HOUR,
					to_timestamp_ms: timestamp_ms
				}
			)
		}
	}
	pub fn get_volume_per_hours(
		&self,
		current_timestamp: Timestamp,
		hours: NonZeroU8
	) -> Result<VolumeQueryResponse, StdError> {
		let current_timestamp_ms = current_timestamp.millis();
		let current_timestamp_hour = current_timestamp_ms / MILLISECONDS_IN_AN_HOUR;
		
		// there has been more than 255 hours since jan 1 1970. We'll be fine.
		let from_timestamp_hour = current_timestamp_hour - hours.get() as u64;

		let from_timestamp_ms = from_timestamp_hour * MILLISECONDS_IN_AN_HOUR;
		let to_timestamp_ms = current_timestamp_hour * MILLISECONDS_IN_AN_HOUR;

		if self.hourly.is_empty() {
			return Ok(
				VolumeQueryResponse {
					volume: [0u128.into(), 0u128.into()],
					from_timestamp_ms,
					to_timestamp_ms
				}
			);
		}
		let mut left_total = 0u128;
		let mut right_total = 0u128;
		let mut record_iter = self.hourly.iter().rev();
		
		let first_record = record_iter.next().expect("is empty was checked")?;
		if first_record.from_time < current_timestamp_hour && first_record.from_time >= from_timestamp_hour {
			left_total = first_record.amount_left;
			right_total = first_record.amount_right;
		}
		// Yes, loops are the root of all evil in contract code, but this isn't intended to be used in transactions.
		for record in record_iter {
			let record = record?;
			if record.from_time < from_timestamp_hour {
				break;
			}
			left_total = left_total.saturating_add(record.amount_left);
			right_total = right_total.saturating_add(record.amount_right);
		}
		Ok(
			VolumeQueryResponse {
				volume: [left_total.into(), right_total.into()],
				from_timestamp_ms,
				to_timestamp_ms
			}
		)
	}

	pub fn get_volume_since_day_start(
		&self,
		current_timestamp: Timestamp
	) -> Result<VolumeQueryResponse, StdError> {
		let timestamp_ms = current_timestamp.millis();
		let timestamp_day = timestamp_ms / MILLISECONDS_IN_AN_HOUR;
		// FIXME: use get().unwrap_or_default() instead of checking is_empty when StoredVecDeque is fixed.
		if self.daily.is_empty() {
			Ok(
				VolumeQueryResponse {
					volume: [0u128.into(), 0u128.into()],
					from_timestamp_ms: timestamp_day * MILLISECONDS_IN_AN_HOUR,
					to_timestamp_ms: timestamp_ms
				}
			)
		} else {
			let latest_record = self.daily.get_back()?.expect("is empty was checked");
			Ok(
				VolumeQueryResponse {
					volume: if latest_record.from_time < timestamp_day {
						[0u128.into(), 0u128.into()]
					} else {
						[latest_record.amount_left.into(), latest_record.amount_right.into()]
					},
					from_timestamp_ms: timestamp_day * MILLISECONDS_IN_AN_HOUR,
					to_timestamp_ms: timestamp_ms
				}
			)
		}
	}
	pub fn get_volume_per_days(
		&self,
		current_timestamp: Timestamp,
		days: NonZeroU8
	) -> Result<VolumeQueryResponse, StdError> {
		let current_timestamp_ms = current_timestamp.millis();
		let current_timestamp_day = current_timestamp_ms / MILLISECONDS_IN_AN_HOUR;
		
		// there has been more than 255 days since jan 1 1970. We'll be fine.
		let from_timestamp_day = current_timestamp_day - days.get() as u64;

		let from_timestamp_ms = from_timestamp_day * MILLISECONDS_IN_AN_HOUR;
		let to_timestamp_ms = current_timestamp_day * MILLISECONDS_IN_AN_HOUR;

		if self.daily.is_empty() {
			return Ok(
				VolumeQueryResponse {
					volume: [0u128.into(), 0u128.into()],
					from_timestamp_ms,
					to_timestamp_ms
				}
			);
		}
		let mut left_total = 0u128;
		let mut right_total = 0u128;
		let mut record_iter = self.daily.iter().rev();
		
		let first_record = record_iter.next().expect("is empty was checked")?;
		if first_record.from_time < current_timestamp_day && first_record.from_time >= from_timestamp_day {
			left_total = first_record.amount_left;
			right_total = first_record.amount_right;
		}
		// Yes, loops are the root of all evil in contract code, but this isn't intended to be used in transactions.
		for record in record_iter {
			let record = record?;
			if record.from_time < from_timestamp_day {
				break;
			}
			left_total = left_total.saturating_add(record.amount_left);
			right_total = right_total.saturating_add(record.amount_right);
		}
		Ok(
			VolumeQueryResponse {
				volume: [left_total.into(), right_total.into()],
				from_timestamp_ms,
				to_timestamp_ms
			}
		)
	}
}
