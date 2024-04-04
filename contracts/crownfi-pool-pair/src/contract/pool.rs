use cosmwasm_schema::cw_serde;
use cosmwasm_std::{Coin, Decimal, Env, Isqrt, QuerierWrapper, StdError, Uint128, Uint256};
use crownfi_swaps_common::data_types::pair_id::{CanonicalPoolPairIdentifier, PoolPairIdentifier};
use sei_cosmwasm::SeiQueryWrapper;

use crate::error::PoolPairContractError;

/// Minimum initial LP share
pub const MINIMUM_INITIAL_SHARES: Uint128 = Uint128::new(1000);
/// The default swap slippage
pub const DEFAULT_SLIPPAGE: Decimal = Decimal::bps(50);
/// The maximum allowed swap slippage
pub const MAX_ALLOWED_TOLERANCE: Decimal = Decimal::bps(5000);

pub(crate) fn get_pool_balance(
	q: &QuerierWrapper<SeiQueryWrapper>,
	env: &Env,
	pair: &PoolPairIdentifier
) -> Result<[Coin; 2], StdError> {
	return Ok(
		[
			q.query_balance(&env.contract.address, &pair.left)?,
			q.query_balance(&env.contract.address, &pair.right)?
		]
	)
}

#[inline]
pub fn balances_into_share_value(
	shares: Uint128,
	share_supply: Uint128,
	pool_balances: [Coin; 2]
) -> [Coin; 2] {
	pool_balances.map(|mut pool_asset| {
		pool_asset.amount = pool_asset.amount.full_mul(shares)
			.checked_div(share_supply.into())
			.unwrap_or_default()
			.try_into()
			.unwrap_or(Uint128::MAX); // This is fine as is impossible to receive more shares than minted
		pool_asset
	})
}

pub fn calc_shares_to_mint(
	current_share_supply: Uint128,
	old_balances: &[Uint128; 2],
	incoming_funds: &[Uint128; 2],
	imbalance_tolerance: Decimal,
) -> Result<Uint128, PoolPairContractError> {
	if current_share_supply.is_zero() {
		let initial_share = Uint128::try_from(
			incoming_funds[0]
			.full_mul(incoming_funds[1])
			.isqrt()
		).unwrap_or(Uint128::MAX); // Uint256::MAX.isqrt() == Uint128::MAX.into(), so the unwrap always succeeds anyway.
		if initial_share < MINIMUM_INITIAL_SHARES {
			return Err(PoolPairContractError::MinimumSharesAmountError);
		}
		Ok(initial_share)
	}else{
		// Assert slippage tolerance
		// FIXME: Unsure if this check as it is currently implemented is what users ultimately care about.
		// Presumably, they care about if the total value of their shares matches what they put in, but we really
		// shaft users for unbalanced deposits, perhaps more than this check implies.
		check_deposit_slippage_tolerance(old_balances, incoming_funds, imbalance_tolerance)?;
		// min(1, 2)
		// 1. sqrt(deposit_0 * exchange_rate_0_to_1 * deposit_0) * (total_share / sqrt(pool_0 * pool_0))
		// == deposit_0 * total_share / pool_0
		// 2. sqrt(deposit_1 * exchange_rate_1_to_0 * deposit_1) * (total_share / sqrt(pool_1 * pool_1))
		// == deposit_1 * total_share / pool_1
		Ok(
			std::cmp::min(
				incoming_funds[0].multiply_ratio(current_share_supply, old_balances[0]),
				incoming_funds[1].multiply_ratio(current_share_supply, old_balances[1]),
			)
		)
	}
}

#[cw_serde]
pub struct CalcSwapResult {
	/// The amount of coin after the swap, minus the `total_fee_amount`.
	pub result_amount: Uint128,
	/// The discrepancy between `result_amount + total_fee_amount` and `incoming_amount * exchange_rate`
	pub spread_amount: Uint128,
	/// `maker_fee_amount + liquidity_provider_fee_amount`
	pub total_fee_amount: Uint128,
	/// How much CrownFi is skimming off the top
	pub maker_fee_amount: Uint128
}

pub fn calc_swap(
	pool_balances: &[Uint128; 2],
	incoming_amount: Uint128,
	total_fee_bps: u16,
	maker_fee_bps: u16,
	inverse_swap: bool,
	expected_result: Option<Uint128>,
	slippage_tolerance: Decimal
) -> Result<CalcSwapResult, PoolPairContractError> {
	// Always needed for spread amount in result
	let naive_result = incoming_amount
		.full_mul(pool_balances[(!inverse_swap) as usize])
		.checked_div(pool_balances[inverse_swap as usize].into())
		.map_err(|_| {PoolPairContractError::NoLiquidity})? // Payout is 0 if we have nothing to pay out
		.try_into()
		.unwrap_or(Uint128::MAX); // guaranteed to fail slip tolerance
	let expected_result = expected_result.unwrap_or(naive_result);

	// result = pool[1] - ((pool[0] * pool[1]) / (pool[0] + incoming))
	let actual_result = pool_balances[(!inverse_swap) as usize].saturating_sub(
		pool_balances[inverse_swap as usize]
			.full_mul(pool_balances[(!inverse_swap) as usize])
			.checked_div(
				Uint256::from(pool_balances[inverse_swap as usize]) +
				Uint256::from(incoming_amount)
			)?.try_into()?
	);

	// abs_diff is used because the "expected_result" can be whatever the user wants.
	let slippage = Decimal::from_ratio(actual_result , expected_result).abs_diff(Decimal::one());
	if slippage > slippage_tolerance {
		return Err(
			PoolPairContractError::SlippageTooHigh(
				slippage
			)
		);
	}

	// Results!
	let maker_fee_amount = actual_result.checked_mul(maker_fee_bps.into())? / Uint128::new(10000);
	let total_fee_amount = actual_result.checked_mul(total_fee_bps.into())? / Uint128::new(10000);
	let spread_amount = naive_result.saturating_sub(actual_result);
	let result_amount = actual_result.saturating_sub(total_fee_amount);
	Ok(
		CalcSwapResult {
			result_amount,
			spread_amount,
			total_fee_amount,
			maker_fee_amount
		}
	)
}

pub(crate) fn check_deposit_slippage_tolerance(
	old_balances: &[Uint128; 2],
	incoming_funds: &[Uint128; 2],
	tolerance: Decimal,
) -> Result<(), PoolPairContractError> {

	let one_minus_tolerance = Decimal::one() - tolerance;
	// Ensure each price does not change more than what the slippage tolerance allows
	if Decimal::from_ratio(incoming_funds[0], incoming_funds[1]).saturating_mul(one_minus_tolerance)
		> Decimal::from_ratio(old_balances[0], old_balances[1])
		|| Decimal::from_ratio(incoming_funds[1], incoming_funds[0]).saturating_mul(one_minus_tolerance)
			> Decimal::from_ratio(old_balances[1], old_balances[0])
	{
		return Err(PoolPairContractError::DepositTooImbalanced);
	}
	
	Ok(())
}
