use core::f64;
use std::{cmp::Ordering, num::NonZeroU8};

use bitflags::bitflags;
use bytemuck::{Pod, Zeroable};
use cosmwasm_std::{Addr, StdError, Timestamp};
use crownfi_cw_common::{
	data_types::canonical_addr::SeiCanonicalAddr,
	extentions::timestamp::TimestampExtentions,
	impl_serializable_as_ref,
	storage::{base::{storage_read_item, storage_write_item}, item::StoredItem, queue::StoredVecDeque, OZeroCopy, SerializableItem},
};
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
	pub endorsed: bool,
}

impl_serializable_as_ref!(PoolPairConfig);
impl StoredItem for PoolPairConfig {
	fn namespace() -> &'static [u8] {
		CONFIG_NAMESPACE.as_bytes()
	}
}
impl PoolPairConfig {
	pub fn load_non_empty() -> Result<OZeroCopy<Self>, StdError>
	where
		Self: Sized,
	{
		match Self::load()? {
			Some(result) => Ok(result),
			None => Err(StdError::NotFound {
				kind: "PoolPairConfig".into(),
			}),
		}
	}

	pub fn valid_fee_bps(&self) -> bool {
		self.total_fee_bps <= MAX_TOTAL_FEE_BPS && self.maker_fee_bps <= self.total_fee_bps
	}
}
impl TryFrom<&PoolPairConfigJsonable> for PoolPairConfig {
	type Error = StdError;
	fn try_from(value: &PoolPairConfigJsonable) -> Result<Self, Self::Error> {
		let mut flags = PoolPairConfigFlags::empty();
		if value.endorsed {
			flags = flags.union(PoolPairConfigFlags::ENDORSED);
		}
		Ok(PoolPairConfig {
			admin: (&value.admin).try_into()?,
			fee_receiver: (&value.fee_receiver).try_into()?,
			total_fee_bps: value.total_fee_bps,
			maker_fee_bps: value.maker_fee_bps,
			flags,
			..Zeroable::zeroed()
		})
	}
}
impl TryFrom<&PoolPairConfig> for PoolPairConfigJsonable {
	type Error = StdError;
	fn try_from(value: &PoolPairConfig) -> Result<Self, Self::Error> {
		Ok(PoolPairConfigJsonable {
			admin: value.admin.try_into()?,
			fee_receiver: value.fee_receiver.try_into()?,
			total_fee_bps: value.total_fee_bps,
			maker_fee_bps: value.maker_fee_bps,
			inverse: value.flags.contains(PoolPairConfigFlags::INVERSE),
			endorsed: value.flags.contains(PoolPairConfigFlags::ENDORSED),
		})
	}
}

const VOLUME_STATS_ALL_TIME_NAMESPACE: &[u8] = "volA".as_bytes();
const VOLUME_STATS_HOURLY_NAMESPACE: &[u8] = "volH".as_bytes();
const VOLUME_STATS_DAILY_NAMESPACE: &[u8] = "volD".as_bytes();

const MAX_HOURLY_RETENTION: u32 = 25;
const MAX_DAILY_RETENTION: u32 = 31;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Pod, Zeroable)]
#[repr(C)]
pub struct ExchangeRatio(u32);
impl ExchangeRatio {
	pub const MIN: ExchangeRatio = ExchangeRatio(0);
	pub const MAX: ExchangeRatio = ExchangeRatio(0x80000000);
	pub fn from_ratio(mut numerator: u128, mut denominator: u128) -> Self {
		if numerator <= denominator {
			// Multiply by 0x80000000 with a means to check how much we overflowed
			numerator = numerator.rotate_left(31);
			let numerator_overflow = (numerator & 0x7fffffff) as u32;
			if numerator_overflow > 0 {
				// We've "overflowed" the multiplication! Determine the max value we can use for the numerator, and
				// reduce the size of the denominator to compensate.
				let shift_right = numerator_overflow.ilog2() + 1;
				numerator = numerator.rotate_right(shift_right);
				denominator >>= shift_right;
			}
			if denominator == 0 {
				Self(0x80000000) // Turns into infinity when converted to f64
			} else {
				Self((numerator / denominator) as u32)
			}
		} else {
			let mut result = Self::from_ratio(denominator, numerator);
			result.0 |= 0x80000000;
			result
		}
	}
	fn is_inverse(&self) -> bool {
		(self.0 & 0x80000000) > 0
	}
	pub fn set_if_less(&mut self, value: ExchangeRatio) {
		if value < *self {
			*self = value;
		}
	}
	pub fn set_if_greater(&mut self, value: ExchangeRatio) {
		if value > *self {
			*self = value;
		}
	}
}
impl Ord for ExchangeRatio {
	fn cmp(&self, other: &Self) -> Ordering {
		if self.is_inverse() {
			if other.is_inverse() {
				// Both are > 1 (inverse ratio) comparison will have to be inversed. Bitwise NOTing works for this
				(!self.0).cmp(&!other.0)
			} else {
				// self is > 1 (inverse ratio), other is <= 1 (non-inverse ratio), self is always greater than other
				Ordering::Greater
			}
		} else {
			// self is <= 1, (non-inverse ratio), compare as normal. Works when the other is inverse as the highest bit
			self.0.cmp(&other.0)
		}
	}
}
impl PartialOrd for ExchangeRatio {
	fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
		Some(self.cmp(other))
	}
}
impl From<ExchangeRatio> for f64 {
	fn from(value: ExchangeRatio) -> Self {
		if value.is_inverse() {
			2147483648.0 / f64::from(value.0)
		} else {
			f64::from(value.0) / 2147483648.0
		}
	}
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Zeroable, Pod)]
#[repr(C)]
pub struct TradingVolume {
	pub from_time: u64,
	pub exchange_rate_low: ExchangeRatio,
	pub exchange_rate_high: ExchangeRatio,
	pub amount_left: u128,
	pub amount_right: u128,
}
impl_serializable_as_ref!(TradingVolume);

const MILLISECONDS_IN_AN_HOUR: u64 = 1000 * 60 * 60;
const MILLISECONDS_IN_A_DAY: u64 = MILLISECONDS_IN_AN_HOUR * 24;

pub struct VolumeStatisticsCounter {
	hourly: StoredVecDeque<TradingVolume>,
	daily: StoredVecDeque<TradingVolume>,
}
impl VolumeStatisticsCounter {
	pub fn new() -> Result<Self, StdError> {
		Ok(Self {
			hourly: StoredVecDeque::new(VOLUME_STATS_HOURLY_NAMESPACE),
			daily: StoredVecDeque::new(VOLUME_STATS_DAILY_NAMESPACE),
		})
	}
	pub fn update_volumes(
		&mut self,
		current_timestamp: Timestamp,
		amount_left: u128,
		amount_right: u128,
	) -> Result<(), StdError> {
		let timestamp_ms = current_timestamp.millis();
		let timestamp_hour = timestamp_ms / MILLISECONDS_IN_AN_HOUR;
		let timestamp_day = timestamp_ms / MILLISECONDS_IN_A_DAY;
		let exchange_ratio = ExchangeRatio::from_ratio(amount_left, amount_right);
		if self.hourly.is_empty() {
			self.hourly.push_back(&TradingVolume {
				from_time: timestamp_hour,
				amount_left,
				amount_right,
				exchange_rate_low: exchange_ratio,
				exchange_rate_high: exchange_ratio
			})?;
		} else {
			let mut latest_record = self.hourly.get_back()?.expect("is empty was checked");
			if latest_record.from_time < timestamp_hour {
				self.hourly.push_back(&TradingVolume {
					from_time: timestamp_hour,
					amount_left,
					amount_right,
					exchange_rate_low: exchange_ratio,
					exchange_rate_high: exchange_ratio
				})?;
			} else {
				latest_record.amount_left = latest_record.amount_left.saturating_add(amount_left);
				latest_record.amount_right = latest_record.amount_right.saturating_add(amount_right);
				latest_record.exchange_rate_low.set_if_less(exchange_ratio);
				latest_record.exchange_rate_low.set_if_greater(exchange_ratio);
				self.hourly.set_back(&latest_record)?;
			}
			if self.hourly.len() > MAX_HOURLY_RETENTION {
				self.hourly.pop_front()?;
			}
		}
		if self.daily.is_empty() {
			self.daily.push_back(&TradingVolume {
				from_time: timestamp_day,
				amount_left,
				amount_right,
				exchange_rate_low: exchange_ratio,
				exchange_rate_high: exchange_ratio
			})?;
		} else {
			let mut latest_record = self.daily.get_back()?.expect("is empty was checked");
			if latest_record.from_time < timestamp_day {
				self.daily.push_back(&TradingVolume {
					from_time: timestamp_day,
					amount_left,
					amount_right,
					exchange_rate_low: exchange_ratio,
					exchange_rate_high: exchange_ratio
				})?;
			} else {
				latest_record.amount_left = latest_record.amount_left.saturating_add(amount_left);
				latest_record.amount_right = latest_record.amount_right.saturating_add(amount_right);
				latest_record.exchange_rate_low.set_if_less(exchange_ratio);
				latest_record.exchange_rate_low.set_if_greater(exchange_ratio);
				self.daily.set_back(&latest_record)?;
			}
			if self.daily.len() > MAX_DAILY_RETENTION {
				self.daily.pop_front()?;
			}
		}
		if let Some(mut all_time) = storage_read_item::<TradingVolume>(VOLUME_STATS_ALL_TIME_NAMESPACE)? {
			all_time.amount_left = all_time.amount_left.saturating_add(amount_left);
			all_time.amount_right = all_time.amount_right.saturating_add(amount_right);
			all_time.exchange_rate_low.set_if_less(exchange_ratio);
			all_time.exchange_rate_low.set_if_greater(exchange_ratio);
			storage_write_item(VOLUME_STATS_ALL_TIME_NAMESPACE, all_time.as_ref())?;
		} else {
			storage_write_item(VOLUME_STATS_ALL_TIME_NAMESPACE, &TradingVolume {
				from_time: timestamp_ms,
				amount_left,
				amount_right,
				exchange_rate_low: exchange_ratio,
				exchange_rate_high: exchange_ratio
			})?;
		}
		Ok(())
	}
	pub fn get_volume_all_time(&self, current_timestamp: Timestamp) -> Result<VolumeQueryResponse, StdError> {
		let timestamp_ms = current_timestamp.millis();
		if let Some(all_time) = storage_read_item::<TradingVolume>(VOLUME_STATS_ALL_TIME_NAMESPACE)? {
			Ok(VolumeQueryResponse {
				volume: [all_time.amount_left.into(), all_time.amount_right.into()],
				exchange_rate_low: all_time.exchange_rate_low.into(),
				exchange_rate_high: all_time.exchange_rate_high.into(),
				from_timestamp_ms: all_time.from_time,
				to_timestamp_ms: timestamp_ms,
			})
		} else {
			Ok(VolumeQueryResponse {
				to_timestamp_ms: timestamp_ms,
				..Default::default()
			})
		}
	}
	pub fn get_volume_since_hour_start(&self, current_timestamp: Timestamp) -> Result<VolumeQueryResponse, StdError> {
		let timestamp_ms = current_timestamp.millis();
		let timestamp_hour = timestamp_ms / MILLISECONDS_IN_AN_HOUR;
		// FIXME: use get().unwrap_or_default() instead of checking is_empty when StoredVecDeque is fixed.
		if self.hourly.is_empty() {
			Ok(VolumeQueryResponse {
				from_timestamp_ms: timestamp_hour * MILLISECONDS_IN_AN_HOUR,
				to_timestamp_ms: timestamp_ms,
				..Default::default()
			})
		} else {
			let latest_record = self.hourly.get_back()?.expect("is empty was checked");
			Ok(VolumeQueryResponse {
				volume: if latest_record.from_time < timestamp_hour {
					[0u128.into(), 0u128.into()]
				} else {
					[latest_record.amount_left.into(), latest_record.amount_right.into()]
				},
				exchange_rate_low: if latest_record.from_time < timestamp_hour {
					f64::INFINITY
				} else {
					latest_record.exchange_rate_low.into()
				},
				exchange_rate_high: if latest_record.from_time < timestamp_hour {
					0.0
				} else {
					latest_record.exchange_rate_high.into()
				},
				from_timestamp_ms: timestamp_hour * MILLISECONDS_IN_AN_HOUR,
				to_timestamp_ms: timestamp_ms,
			})
		}
	}
	pub fn get_volume_per_hours(
		&self,
		current_timestamp: Timestamp,
		hours: NonZeroU8,
	) -> Result<VolumeQueryResponse, StdError> {
		let current_timestamp_ms = current_timestamp.millis();
		let current_timestamp_hour = current_timestamp_ms / MILLISECONDS_IN_AN_HOUR;

		// there has been more than 255 hours since jan 1 1970. We'll be fine.
		let from_timestamp_hour = current_timestamp_hour - hours.get() as u64;

		let from_timestamp_ms = from_timestamp_hour * MILLISECONDS_IN_AN_HOUR;
		let to_timestamp_ms = current_timestamp_hour * MILLISECONDS_IN_AN_HOUR;

		if self.hourly.is_empty() {
			return Ok(VolumeQueryResponse {
				volume: [0u128.into(), 0u128.into()],
				exchange_rate_low: f64::INFINITY,
				exchange_rate_high: 0.0,
				from_timestamp_ms,
				to_timestamp_ms,
			});
		}
		let mut exchange_rate_low = ExchangeRatio::MAX;
		let mut exchange_rate_high = ExchangeRatio::MIN;
		let mut left_total = 0u128;
		let mut right_total = 0u128;
		let mut record_iter = self.hourly.iter().rev();

		let first_record = record_iter.next().expect("is empty was checked")?;
		if first_record.from_time < current_timestamp_hour && first_record.from_time >= from_timestamp_hour {
			exchange_rate_low = first_record.exchange_rate_low;
			exchange_rate_high = first_record.exchange_rate_high;
			left_total = first_record.amount_left;
			right_total = first_record.amount_right;
		}
		// Yes, loops are the root of all evil in contract code, but this isn't intended to be used in transactions.
		for record in record_iter {
			let record = record?;
			if record.from_time < from_timestamp_hour {
				break;
			}
			exchange_rate_low.set_if_less(record.exchange_rate_low);
			exchange_rate_high.set_if_greater(record.exchange_rate_high);
			left_total = left_total.saturating_add(record.amount_left);
			right_total = right_total.saturating_add(record.amount_right);
		}
		Ok(VolumeQueryResponse {
			volume: [left_total.into(), right_total.into()],
			exchange_rate_low: exchange_rate_low.into(),
			exchange_rate_high: exchange_rate_high.into(),
			from_timestamp_ms,
			to_timestamp_ms,
		})
	}

	pub fn get_volume_since_day_start(&self, current_timestamp: Timestamp) -> Result<VolumeQueryResponse, StdError> {
		let timestamp_ms = current_timestamp.millis();
		let timestamp_day = timestamp_ms / MILLISECONDS_IN_AN_HOUR;
		// FIXME: use get().unwrap_or_default() instead of checking is_empty when StoredVecDeque is fixed.
		if self.daily.is_empty() {
			Ok(VolumeQueryResponse {
				volume: [0u128.into(), 0u128.into()],
				exchange_rate_low: f64::INFINITY,
				exchange_rate_high: 0.0,
				from_timestamp_ms: timestamp_day * MILLISECONDS_IN_AN_HOUR,
				to_timestamp_ms: timestamp_ms,
			})
		} else {
			let latest_record = self.daily.get_back()?.expect("is empty was checked");
			Ok(VolumeQueryResponse {
				volume: if latest_record.from_time < timestamp_day {
					[0u128.into(), 0u128.into()]
				} else {
					[latest_record.amount_left.into(), latest_record.amount_right.into()]
				},
				exchange_rate_low: if latest_record.from_time < timestamp_day {
					f64::INFINITY
				} else {
					latest_record.exchange_rate_low.into()
				},
				exchange_rate_high: if latest_record.from_time < timestamp_day {
					0.0
				} else {
					latest_record.exchange_rate_high.into()
				},
				from_timestamp_ms: timestamp_day * MILLISECONDS_IN_AN_HOUR,
				to_timestamp_ms: timestamp_ms,
			})
		}
	}
	pub fn get_volume_per_days(
		&self,
		current_timestamp: Timestamp,
		days: NonZeroU8,
	) -> Result<VolumeQueryResponse, StdError> {
		let current_timestamp_ms = current_timestamp.millis();
		let current_timestamp_day = current_timestamp_ms / MILLISECONDS_IN_AN_HOUR;

		// there has been more than 255 days since jan 1 1970. We'll be fine.
		let from_timestamp_day = current_timestamp_day - days.get() as u64;

		let from_timestamp_ms = from_timestamp_day * MILLISECONDS_IN_AN_HOUR;
		let to_timestamp_ms = current_timestamp_day * MILLISECONDS_IN_AN_HOUR;

		if self.daily.is_empty() {
			return Ok(VolumeQueryResponse {
				volume: [0u128.into(), 0u128.into()],
				exchange_rate_low: f64::INFINITY,
				exchange_rate_high: 0.0,
				from_timestamp_ms,
				to_timestamp_ms,
			});
		}

		let mut exchange_rate_low = ExchangeRatio::MAX;
		let mut exchange_rate_high = ExchangeRatio::MIN;
		let mut left_total = 0u128;
		let mut right_total = 0u128;
		let mut record_iter = self.daily.iter().rev();

		let first_record = record_iter.next().expect("is empty was checked")?;
		if first_record.from_time < current_timestamp_day && first_record.from_time >= from_timestamp_day {
			exchange_rate_low = first_record.exchange_rate_low;
			exchange_rate_high = first_record.exchange_rate_high;
			left_total = first_record.amount_left;
			right_total = first_record.amount_right;
		}
		// Yes, loops are the root of all evil in contract code, but this isn't intended to be used in transactions.
		for record in record_iter {
			let record = record?;
			if record.from_time < from_timestamp_day {
				break;
			}
			exchange_rate_low.set_if_less(record.exchange_rate_low);
			exchange_rate_high.set_if_greater(record.exchange_rate_high);
			left_total = left_total.saturating_add(record.amount_left);
			right_total = right_total.saturating_add(record.amount_right);
		}
		Ok(VolumeQueryResponse {
			volume: [left_total.into(), right_total.into()],
			exchange_rate_low: exchange_rate_low.into(),
			exchange_rate_high: exchange_rate_low.into(),
			from_timestamp_ms,
			to_timestamp_ms,
		})
	}
}
