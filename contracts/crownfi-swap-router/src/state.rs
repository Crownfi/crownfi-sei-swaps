use bytemuck::{Pod, Zeroable};
use cosmwasm_std::StdError;
use crownfi_cw_common::{
	data_types::canonical_addr::SeiCanonicalAddr,
	impl_serializable_as_ref,
	storage::{item::StoredItem, vec::StoredVec, OZeroCopy, SerializableItem},
};

pub const STATE_NAMESPACE: &str = "state";

// TODO: Current route queue
#[derive(Debug, Clone, Copy, PartialEq, Eq, Zeroable, Pod)]
#[repr(C)]
pub struct SwapRouterState {
	/// If == Zeroable::zeroed(), None
	pub receiver: SeiCanonicalAddr,
	/// If == Zeroable::zeroed(), None
	pub unwrapper: SeiCanonicalAddr,
	/// 0 == None, 1 == ERC20, 2 = CW20, u128 enums are unstable and anything lower does not align with the struct >:(
	pub unwrapper_kind: u128,
	/// If == u128::MAX, ignore. Else, Convert verbatim to Decimal
	pub intermediate_slippage_tolerance: u128,
	/// If == 0, ignore
	pub expected_amount: u128,
	/// If == u128::MAX, ignore. Else, Convert verbatim to Decimal
	pub slippage_tolerance: u128,
}

impl_serializable_as_ref!(SwapRouterState);
impl StoredItem for SwapRouterState {
	fn namespace() -> &'static [u8] {
		STATE_NAMESPACE.as_bytes()
	}
}
impl SwapRouterState {
	pub fn load_non_empty() -> Result<OZeroCopy<Self>, StdError>
	where
		Self: Sized,
	{
		match Self::load()? {
			Some(result) => Ok(result),
			None => Err(StdError::NotFound {
				kind: "SwapRouterState".into(),
			}),
		}
	}
}

const SWAPPER_ADDRESSES_NAMESPACE: &str = "swaps";

pub fn get_swapper_addresses<'a>() -> StoredVec<SeiCanonicalAddr> {
	StoredVec::new(SWAPPER_ADDRESSES_NAMESPACE.as_ref())
}
