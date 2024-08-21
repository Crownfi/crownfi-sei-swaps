use cosmwasm_std::{from_json, testing::mock_env, Addr};

use crate::{
	contract::query,
	msg::PoolPairQueryMsg,
	state::PoolPairConfigJsonable,
	tests::{deps, init, PAIR_DENOMS, RANDOM_ADDRESS},
};

#[test]
fn basic_queries() {
	let mut deps = deps(&[]);
	init(&mut deps);

	let env = mock_env();

	let pair_denoms: [String; 2] =
		from_json(query(deps.as_ref(), env.clone(), PoolPairQueryMsg::PairDenoms).unwrap()).unwrap();
	let canonical_pair_denoms: [String; 2] =
		from_json(query(deps.as_ref(), env.clone(), PoolPairQueryMsg::CanonicalPairDenoms).unwrap()).unwrap();
	let pair_identifier: String =
		from_json(query(deps.as_ref(), env.clone(), PoolPairQueryMsg::PairIdentifier).unwrap()).unwrap();
	let canonical_pair_identifier: String =
		from_json(query(deps.as_ref(), env.clone(), PoolPairQueryMsg::CanonicalPairIdentifier).unwrap()).unwrap();
	let config: PoolPairConfigJsonable =
		from_json(query(deps.as_ref(), env.clone(), PoolPairQueryMsg::Config).unwrap()).unwrap();

	assert_eq!(pair_denoms, PAIR_DENOMS);
	assert_eq!(canonical_pair_denoms, PAIR_DENOMS);
	assert_eq!(pair_identifier, "abc<>cba");
	assert_eq!(canonical_pair_identifier, "abc<>cba");
	assert_eq!(
		config,
		PoolPairConfigJsonable {
			admin: Addr::unchecked(RANDOM_ADDRESS),
			fee_receiver: Addr::unchecked(RANDOM_ADDRESS),
			total_fee_bps: 100,
			maker_fee_bps: 50,
			inverse: false,
			endorsed: true
		}
	);
}
