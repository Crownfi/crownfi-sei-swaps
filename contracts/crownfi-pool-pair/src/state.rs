use core::f64;
use std::{cmp::Ordering, num::NonZeroU8, u64};

use bitflags::bitflags;
use bytemuck::{Pod, Zeroable};
use cosmwasm_std::{Addr, Decimal, StdError, Timestamp};
use crownfi_cw_common::{
	data_types::canonical_addr::SeiCanonicalAddr,
	extentions::timestamp::TimestampExtentions,
	impl_serializable_as_ref,
	storage::{
		base::{storage_read_item, storage_write_item},
		item::StoredItem,
		queue::StoredVecDeque,
		OZeroCopy, SerializableItem,
	},
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::msg::{ExchangeRateQueryResponse, VolumeQueryResponse};

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
		if value.inverse {
			flags = flags.union(PoolPairConfigFlags::INVERSE);
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

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Pod, Zeroable)]
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
	/// Sei's outdated cosmwasm prevents us from using this
	pub fn ratio_into_f64(numerator: u128, denominator: u128) -> f64 {
		// A float has a 52 bit mantissa, do as many right-shifts as needed until we get a value which fits into 52
		// bits.
		let amount_to_shr = numerator
			.ilog2()
			.saturating_sub(52)
			.max(denominator.ilog2().saturating_sub(52));
		(numerator >> amount_to_shr) as f64 / (denominator >> amount_to_shr) as f64
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

impl From<ExchangeRatio> for Decimal {
	fn from(value: ExchangeRatio) -> Self {
		if value.is_inverse() {
			let value = value.0 & 0x7fffffff;
			if value == 0 {
				// JSON can't do Infinity, so we're gonna approach it as close we can
				Decimal::MAX
			} else {
				Decimal::from_ratio(2147483648u128, value)
			}
		} else {
			Decimal::from_ratio(value.0, 2147483648u128)
		}
	}
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Zeroable, Pod)]
#[repr(C)]
pub struct TradingVolume {
	pub from_time: u64,
	pub exchange_rate_low: ExchangeRatio,
	pub exchange_rate_high: ExchangeRatio,
	pub amount_left: u128,
	pub amount_right: u128,
	pub amount_output_normalized: u128,
}
impl_serializable_as_ref!(TradingVolume);
impl TradingVolume {
	pub fn new(from_time: u64, amount_left: u128, amount_right: u128, output_is_left: bool) -> TradingVolume {
		let exchange_ratio = ExchangeRatio::from_ratio(amount_right, amount_left);
		TradingVolume {
			from_time,
			exchange_rate_low: exchange_ratio,
			exchange_rate_high: exchange_ratio,
			amount_left,
			amount_right,
			amount_output_normalized: if output_is_left {
				amount_left
			} else {
				amount_right.saturating_mul(2)
			},
		}
	}
	pub fn add_volume(&mut self, amount_left: u128, amount_right: u128, output_is_left: bool) {
		let exchange_ratio = ExchangeRatio::from_ratio(amount_right, amount_left);
		self.amount_left = self.amount_left.saturating_add(amount_left);
		self.amount_right = self.amount_right.saturating_add(amount_right);
		self.exchange_rate_low.set_if_less(exchange_ratio);
		self.exchange_rate_high.set_if_greater(exchange_ratio);
		self.amount_output_normalized = self.amount_right.saturating_add(if output_is_left {
			amount_left
		} else {
			amount_right.saturating_mul(2)
		});
	}
}

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
		output_is_left: bool,
	) -> Result<(), StdError> {
		let timestamp_ms = current_timestamp.millis();
		let timestamp_hour = timestamp_ms / MILLISECONDS_IN_AN_HOUR;
		let timestamp_day = timestamp_ms / MILLISECONDS_IN_A_DAY;
		if let Some(mut latest_record) = self.hourly.get_back()? {
			if latest_record.from_time < timestamp_hour {
				self.hourly.push_back(&TradingVolume::new(
					timestamp_hour,
					amount_left,
					amount_right,
					output_is_left,
				))?;
			} else {
				latest_record.add_volume(amount_left, amount_right, output_is_left);
				self.hourly.set_back(&latest_record)?;
			}
			if self.hourly.len() > MAX_HOURLY_RETENTION {
				self.hourly.pop_front()?;
			}
		} else {
			self.hourly.push_back(&TradingVolume::new(
				timestamp_hour,
				amount_left,
				amount_right,
				output_is_left,
			))?;
		}
		if let Some(mut latest_record) = self.daily.get_back()? {
			if latest_record.from_time < timestamp_day {
				self.daily.push_back(&TradingVolume::new(
					timestamp_day,
					amount_left,
					amount_right,
					output_is_left,
				))?;
			} else {
				latest_record.add_volume(amount_left, amount_right, output_is_left);
				self.daily.set_back(&latest_record)?;
			}
			if self.daily.len() > MAX_DAILY_RETENTION {
				self.daily.pop_front()?;
			}
		} else {
			self.daily.push_back(&TradingVolume::new(
				timestamp_day,
				amount_left,
				amount_right,
				output_is_left,
			))?;
		}
		if let Some(mut all_time) = storage_read_item::<TradingVolume>(VOLUME_STATS_ALL_TIME_NAMESPACE)? {
			all_time.add_volume(amount_left, amount_right, output_is_left);
			storage_write_item(VOLUME_STATS_ALL_TIME_NAMESPACE, all_time.as_ref())?;
		} else {
			storage_write_item(
				VOLUME_STATS_ALL_TIME_NAMESPACE,
				&TradingVolume::new(timestamp_ms, amount_left, amount_right, output_is_left),
			)?;
		}
		Ok(())
	}
	pub fn get_volume_all_time(&self, current_timestamp: Timestamp) -> Result<VolumeQueryResponse, StdError> {
		let timestamp_ms = current_timestamp.millis();
		if let Some(all_time) = storage_read_item::<TradingVolume>(VOLUME_STATS_ALL_TIME_NAMESPACE)? {
			Ok(VolumeQueryResponse {
				volume: [all_time.amount_left.into(), all_time.amount_right.into()],
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
		let latest_record = self.hourly.get_back()?.unwrap_or_default();
		Ok(VolumeQueryResponse {
			volume: if latest_record.from_time < timestamp_hour {
				[0u128.into(), 0u128.into()]
			} else {
				[latest_record.amount_left.into(), latest_record.amount_right.into()]
			},
			from_timestamp_ms: timestamp_hour * MILLISECONDS_IN_AN_HOUR,
			to_timestamp_ms: timestamp_ms,
		})
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
		let to_timestamp_ms = current_timestamp_hour * MILLISECONDS_IN_AN_HOUR;

		if self.hourly.is_empty() {
			return Ok(VolumeQueryResponse {
				volume: [0u128.into(), 0u128.into()],
				from_timestamp_ms: to_timestamp_ms,
				to_timestamp_ms,
			});
		}
		let mut earliest_timestamp_hour = 0;
		let mut left_total = 0u128;
		let mut right_total = 0u128;
		let mut record_iter = self.hourly.iter().rev();

		let first_record = record_iter.next().expect("is empty was checked")?;
		if first_record.from_time < current_timestamp_hour && first_record.from_time >= from_timestamp_hour {
			left_total = first_record.amount_left;
			right_total = first_record.amount_right;
			earliest_timestamp_hour = first_record.from_time;
		}
		// Yes, loops are the root of all evil in contract code, but this isn't intended to be used in transactions.
		for record in record_iter {
			let record = record?;
			if record.from_time < from_timestamp_hour {
				break;
			}
			left_total = left_total.saturating_add(record.amount_left);
			right_total = right_total.saturating_add(record.amount_right);
			earliest_timestamp_hour = record.from_time;
		}
		Ok(VolumeQueryResponse {
			volume: [left_total.into(), right_total.into()],
			from_timestamp_ms: earliest_timestamp_hour * MILLISECONDS_IN_AN_HOUR,
			to_timestamp_ms,
		})
	}
	pub fn get_volume_since_day_start(&self, current_timestamp: Timestamp) -> Result<VolumeQueryResponse, StdError> {
		let timestamp_ms = current_timestamp.millis();
		let timestamp_day = timestamp_ms / MILLISECONDS_IN_A_DAY;
		let latest_record = self.daily.get_back()?.unwrap_or_default();

		Ok(VolumeQueryResponse {
			volume: if latest_record.from_time < timestamp_day {
				[0u128.into(), 0u128.into()]
			} else {
				[latest_record.amount_left.into(), latest_record.amount_right.into()]
			},
			from_timestamp_ms: timestamp_day * MILLISECONDS_IN_A_DAY,
			to_timestamp_ms: timestamp_ms,
		})
	}
	pub fn get_volume_per_days(
		&self,
		current_timestamp: Timestamp,
		days: NonZeroU8,
	) -> Result<VolumeQueryResponse, StdError> {
		let current_timestamp_ms = current_timestamp.millis();
		let current_timestamp_day = current_timestamp_ms / MILLISECONDS_IN_A_DAY;

		// there has been more than 255 days since jan 1 1970. We'll be fine.
		let from_timestamp_day = current_timestamp_day - days.get() as u64;
		let to_timestamp_ms = current_timestamp_day * MILLISECONDS_IN_A_DAY;

		if self.daily.is_empty() {
			return Ok(VolumeQueryResponse {
				volume: [0u128.into(), 0u128.into()],
				from_timestamp_ms: to_timestamp_ms,
				to_timestamp_ms,
			});
		}

		let mut earliest_timestamp_day = 0;
		let mut left_total = 0u128;
		let mut right_total = 0u128;
		let mut record_iter = self.daily.iter().rev();

		let first_record = record_iter.next().expect("is empty was checked")?;
		if first_record.from_time < current_timestamp_day && first_record.from_time >= from_timestamp_day {
			left_total = first_record.amount_left;
			right_total = first_record.amount_right;
			earliest_timestamp_day = first_record.from_time;
		}
		// Yes, loops are the root of all evil in contract code, but this isn't intended to be used in transactions.
		for record in record_iter {
			let record = record?;
			if record.from_time < from_timestamp_day {
				break;
			}
			left_total = left_total.saturating_add(record.amount_left);
			right_total = right_total.saturating_add(record.amount_right);
			earliest_timestamp_day = first_record.from_time;
		}
		Ok(VolumeQueryResponse {
			volume: [left_total.into(), right_total.into()],
			from_timestamp_ms: earliest_timestamp_day * MILLISECONDS_IN_A_DAY,
			to_timestamp_ms,
		})
	}
	pub fn get_exchange_rate_all_time(
		&self,
		current_timestamp: Timestamp,
		fallback_balances: impl Fn() -> Result<[u128; 2], StdError>,
	) -> Result<ExchangeRateQueryResponse, StdError> {
		let timestamp_ms = current_timestamp.millis();
		storage_read_item::<TradingVolume>(VOLUME_STATS_ALL_TIME_NAMESPACE)?
			.as_deref()
			.map(|all_time| {
				Ok(ExchangeRateQueryResponse {
					from_timestamp_ms: all_time.from_time,
					to_timestamp_ms: timestamp_ms,
					exchange_rate_low: all_time.exchange_rate_low.into(),
					exchange_rate_high: all_time.exchange_rate_high.into(),
					exchange_rate_avg: Decimal::checked_from_ratio(all_time.amount_right, all_time.amount_left)
						.unwrap_or(Decimal::MAX),
				})
			})
			.unwrap_or_else(|| {
				let exchange_rate = fallback_balances()?;
				let exchange_rate =
					Decimal::checked_from_ratio(exchange_rate[1], exchange_rate[0]).unwrap_or(Decimal::MAX);
				Ok(ExchangeRateQueryResponse {
					exchange_rate_low: exchange_rate,
					exchange_rate_high: exchange_rate,
					exchange_rate_avg: exchange_rate,
					from_timestamp_ms: 0,
					to_timestamp_ms: timestamp_ms,
				})
			})
	}
	pub fn get_exchange_rate_since_hour_start(
		&self,
		current_timestamp: Timestamp,
		fallback_balances: impl Fn() -> Result<[u128; 2], StdError>,
	) -> Result<ExchangeRateQueryResponse, StdError> {
		let timestamp_ms = current_timestamp.millis();
		let timestamp_hour = timestamp_ms / MILLISECONDS_IN_AN_HOUR;
		self.hourly
			.get_back()?
			.filter(|latest_record| latest_record.from_time >= timestamp_hour)
			.map(|latest_record| {
				Ok(ExchangeRateQueryResponse {
					exchange_rate_low: latest_record.exchange_rate_low.into(),
					exchange_rate_high: latest_record.exchange_rate_high.into(),
					exchange_rate_avg: Decimal::checked_from_ratio(
						latest_record.amount_right,
						latest_record.amount_left,
					)
					.unwrap_or(Decimal::MAX),
					from_timestamp_ms: timestamp_hour * MILLISECONDS_IN_AN_HOUR,
					to_timestamp_ms: timestamp_ms,
				})
			})
			.unwrap_or_else(|| {
				let exchange_rate = fallback_balances()?;
				let exchange_rate =
					Decimal::checked_from_ratio(exchange_rate[1], exchange_rate[0]).unwrap_or(Decimal::MAX);
				Ok(ExchangeRateQueryResponse {
					exchange_rate_low: exchange_rate,
					exchange_rate_high: exchange_rate,
					exchange_rate_avg: exchange_rate,
					from_timestamp_ms: timestamp_hour * MILLISECONDS_IN_AN_HOUR,
					to_timestamp_ms: timestamp_ms,
				})
			})
	}
	pub fn get_exchange_rate_per_hours(
		&self,
		current_timestamp: Timestamp,
		hours: NonZeroU8,
		fallback_balances: impl Fn() -> Result<[u128; 2], StdError>,
	) -> Result<ExchangeRateQueryResponse, StdError> {
		let current_timestamp_ms = current_timestamp.millis();
		let current_timestamp_hour = current_timestamp_ms / MILLISECONDS_IN_AN_HOUR;

		// there has been more than 255 hours since jan 1 1970. We'll be fine.
		let from_timestamp_hour = current_timestamp_hour - hours.get() as u64;
		let to_timestamp_ms = current_timestamp_hour * MILLISECONDS_IN_AN_HOUR;

		let mut record_iter = self.hourly.iter().rev();
		let Some(first_record) = record_iter.next().transpose()? else {
			let exchange_rate = fallback_balances()?;
			let exchange_rate = Decimal::checked_from_ratio(exchange_rate[1], exchange_rate[0]).unwrap_or(Decimal::MAX);
			return Ok(ExchangeRateQueryResponse {
				exchange_rate_low: exchange_rate,
				exchange_rate_high: exchange_rate,
				exchange_rate_avg: exchange_rate,
				from_timestamp_ms: to_timestamp_ms,
				to_timestamp_ms,
			});
		};
		let mut earliest_timestamp_hour = 0;
		let mut exchange_rate_low = ExchangeRatio::MAX;
		let mut exchange_rate_high = ExchangeRatio::MIN;
		let mut left_total = 0u128;
		let mut right_total = 0u128;
		if first_record.from_time < current_timestamp_hour && first_record.from_time >= from_timestamp_hour {
			exchange_rate_low = first_record.exchange_rate_low;
			exchange_rate_high = first_record.exchange_rate_high;
			left_total = first_record.amount_left;
			right_total = first_record.amount_right;
			earliest_timestamp_hour = first_record.from_time;
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
			earliest_timestamp_hour = record.from_time;
		}
		Ok(ExchangeRateQueryResponse {
			exchange_rate_low: exchange_rate_low.into(),
			exchange_rate_high: exchange_rate_high.into(),
			exchange_rate_avg: Decimal::checked_from_ratio(right_total, left_total).unwrap_or(Decimal::MAX),
			from_timestamp_ms: earliest_timestamp_hour * MILLISECONDS_IN_AN_HOUR,
			to_timestamp_ms,
		})
	}
	pub fn get_exchange_rate_since_day_start(
		&self,
		current_timestamp: Timestamp,
		fallback_balances: impl Fn() -> Result<[u128; 2], StdError>,
	) -> Result<ExchangeRateQueryResponse, StdError> {
		let timestamp_ms = current_timestamp.millis();
		let timestamp_day = timestamp_ms / MILLISECONDS_IN_A_DAY;
		self.daily
			.get_back()?
			.filter(|latest_record| latest_record.from_time >= timestamp_day)
			.map(|latest_record| {
				Ok(ExchangeRateQueryResponse {
					exchange_rate_low: latest_record.exchange_rate_low.into(),
					exchange_rate_high: latest_record.exchange_rate_high.into(),
					exchange_rate_avg: Decimal::checked_from_ratio(
						latest_record.amount_right,
						latest_record.amount_left,
					)
					.unwrap_or(Decimal::MAX),
					from_timestamp_ms: timestamp_day * MILLISECONDS_IN_A_DAY,
					to_timestamp_ms: timestamp_ms,
				})
			})
			.unwrap_or_else(|| {
				let exchange_rate = fallback_balances()?;
				let exchange_rate =
					Decimal::checked_from_ratio(exchange_rate[1], exchange_rate[0]).unwrap_or(Decimal::MAX);
				Ok(ExchangeRateQueryResponse {
					exchange_rate_low: exchange_rate,
					exchange_rate_high: exchange_rate,
					exchange_rate_avg: exchange_rate,
					from_timestamp_ms: timestamp_day * MILLISECONDS_IN_A_DAY,
					to_timestamp_ms: timestamp_ms,
				})
			})
	}
	pub fn get_exchange_rate_per_days(
		&self,
		current_timestamp: Timestamp,
		days: NonZeroU8,
		fallback_balances: impl Fn() -> Result<[u128; 2], StdError>,
	) -> Result<ExchangeRateQueryResponse, StdError> {
		let current_timestamp_ms = current_timestamp.millis();
		let current_timestamp_day = current_timestamp_ms / MILLISECONDS_IN_A_DAY;

		// there has been more than 255 days since jan 1 1970. We'll be fine.
		let from_timestamp_day = current_timestamp_day - days.get() as u64;
		let to_timestamp_ms = current_timestamp_day * MILLISECONDS_IN_A_DAY;

		let mut earliest_timestamp_day = 0;
		let mut exchange_rate_low = ExchangeRatio::MAX;
		let mut exchange_rate_high = ExchangeRatio::MIN;
		let mut left_total = 0u128;
		let mut right_total = 0u128;
		let mut record_iter = self.daily.iter().rev();

		let Some(first_record) = record_iter.next().transpose()? else {
			let exchange_rate = fallback_balances()?;
			let exchange_rate = Decimal::checked_from_ratio(exchange_rate[1], exchange_rate[0]).unwrap_or(Decimal::MAX);
			return Ok(ExchangeRateQueryResponse {
				exchange_rate_low: exchange_rate,
				exchange_rate_high: exchange_rate,
				exchange_rate_avg: exchange_rate,
				from_timestamp_ms: to_timestamp_ms,
				to_timestamp_ms,
			});
		};
		if first_record.from_time < current_timestamp_day && first_record.from_time >= from_timestamp_day {
			earliest_timestamp_day = first_record.from_time;
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
			earliest_timestamp_day = first_record.from_time;
		}
		Ok(ExchangeRateQueryResponse {
			exchange_rate_low: exchange_rate_low.into(),
			exchange_rate_high: exchange_rate_high.into(),
			exchange_rate_avg: Decimal::checked_from_ratio(right_total, left_total).unwrap_or(Decimal::MAX),
			from_timestamp_ms: earliest_timestamp_day * MILLISECONDS_IN_A_DAY,
			to_timestamp_ms,
		})
	}
	pub fn estimate_apy(
		&self,
		current_timestamp: Timestamp,
		current_left_token_balance: u128,
		config: &PoolPairConfig,
		days: u8,
	) -> Result<Decimal, StdError> {
		if days == 0 || self.daily.is_empty() {
			return Ok(Decimal::zero());
		}
		let current_timestamp_ms = current_timestamp.millis();
		let current_timestamp_day = current_timestamp_ms / MILLISECONDS_IN_A_DAY;

		// there has been more than 255 days since jan 1 1970. We'll be fine.
		let from_timestamp_day = current_timestamp_day - days as u64;
		let mut actual_from_timestamp_day = 0;

		let mut normalized_output_total = 0u128;
		let mut record_iter = self.daily.iter().rev();

		let first_record = record_iter.next().expect("is empty was checked")?;
		if first_record.from_time < current_timestamp_day && first_record.from_time >= from_timestamp_day {
			normalized_output_total = first_record.amount_output_normalized;
			actual_from_timestamp_day = first_record.from_time;
		}
		// Yes, loops are the root of all evil in contract code, but this isn't intended to be used in transactions.
		for record in record_iter {
			let record = record?;
			if record.from_time < from_timestamp_day {
				break;
			}
			normalized_output_total = normalized_output_total.saturating_add(record.amount_output_normalized);
			actual_from_timestamp_day = record.from_time;
		}
		// Theoretical amount of "new" tokens added to the pool via fees over the year
		normalized_output_total = normalized_output_total
			.saturating_mul(config.total_fee_bps.saturating_sub(config.maker_fee_bps) as u128 * 365u128)
			/ (10000 * (current_timestamp_day - actual_from_timestamp_day) as u128);

		Ok(Decimal::from_ratio(normalized_output_total, current_left_token_balance))
	}
}
