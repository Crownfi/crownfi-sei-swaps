use cosmwasm_std::{attr, Addr, Attribute, Coin, Uint128};
// Note: These are used instead of events because you can filter by _contract_addr as well the attributes when querying

#[inline]
pub fn attr_provide_liquidity(
	sender: Addr,
	receiver: Addr,
	assets: [&Coin; 2],
	share: Uint128,
) -> impl IntoIterator<Item = Attribute> {
	vec![
		attr("action", "provide_liquidity"),
		attr("sender", sender),
		attr("receiver", receiver),
		attr("assets", format!("{}, {}", assets[0], assets[1])),
		attr("share", share),
	]
}

#[inline]
pub fn attr_withdraw_liquidity(
	sender: Addr,
	receiver: Addr,
	withdrawn_share: Uint128,
	refund_assets: [&Coin; 2],
) -> impl IntoIterator<Item = Attribute> {
	vec![
		attr("action", "withdraw_liquidity"),
		attr("sender", sender),
		attr("receiver", receiver),
		attr("withdrawn_share", withdrawn_share),
		attr("refund_assets", format!("{}, {}", refund_assets[0], refund_assets[1])),
	]
}

#[inline]
pub fn attr_withdraw_and_split_liquidity(
	sender: Addr,
	receiver: [&Addr; 2],
	withdrawn_share: Uint128,
	refund_assets: [&Coin; 2],
) -> impl IntoIterator<Item = Attribute> {
	vec![
		attr("action", "withdraw_liquidity"),
		attr("sender", sender),
		attr("receiver", format!("{}, {}", receiver[0], receiver[1])),
		attr("withdrawn_share", withdrawn_share),
		attr("refund_assets", format!("{}, {}", refund_assets[0], refund_assets[1])),
	]
}

#[inline]
pub fn attr_swap(
	sender: Addr,
	receiver: Addr,
	in_coin: &Coin,
	out_coin: &Coin,
	spread_amount: Uint128,
	total_fee_amount: Uint128,
	maker_fee_amount: Uint128,
) -> impl IntoIterator<Item = Attribute> {
	vec![
		attr("action", "swap"),
		attr("sender", sender),
		attr("receiver", receiver),
		attr("in_coin", in_coin.to_string()),
		attr("out_coin", out_coin.to_string()),
		attr("spread_amount", spread_amount),
		attr("total_fee_amount", total_fee_amount),
		attr("maker_fee_amount", maker_fee_amount),
	]
}
