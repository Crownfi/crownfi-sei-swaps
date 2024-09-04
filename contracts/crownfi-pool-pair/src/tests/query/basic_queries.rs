use cosmwasm_std::{
	coin, from_json,
	testing::{mock_env, mock_info},
	Addr,
};

use crate::{
	contract::{instantiate, query},
	msg::{PoolPairInstantiateMsg, PoolPairQueryMsg},
	state::PoolPairConfigJsonable,
	tests::{deps, AddressFactory, LEFT_TOKEN_AMT, PAIR_DENOMS, RIGHT_TOKEN_AMT},
};

#[test]
fn basic_queries() {
	let mut deps = deps(&[]);

	let msg = PoolPairInstantiateMsg {
		shares_receiver: Addr::unchecked(AddressFactory::ADMIN),
		config: PoolPairConfigJsonable {
			admin: Addr::unchecked(AddressFactory::ADMIN),
			inverse: true,
			endorsed: true,
			fee_receiver: Addr::unchecked(AddressFactory::FEE_RECEIVER),
			total_fee_bps: 100,
			maker_fee_bps: 50,
		},
	};

	let env = mock_env();
	let info = mock_info(
		AddressFactory::ADMIN,
		&[
			coin(RIGHT_TOKEN_AMT, PAIR_DENOMS[0]),
			coin(LEFT_TOKEN_AMT, PAIR_DENOMS[1]),
		],
	);

	instantiate(deps.as_mut(), env.clone(), info, msg).unwrap();

	deps.querier.update_balance(
		env.contract.address.clone(),
		vec![
			coin(LEFT_TOKEN_AMT, PAIR_DENOMS[0]),
			coin(RIGHT_TOKEN_AMT, PAIR_DENOMS[1]),
		],
	);

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

	assert_eq!(pair_denoms, [PAIR_DENOMS[1], PAIR_DENOMS[0]]);
	assert_eq!(canonical_pair_denoms, PAIR_DENOMS);
	assert_eq!(pair_identifier, "cba<>abc");
	assert_eq!(canonical_pair_identifier, "abc<>cba");
	assert_eq!(
		config,
		PoolPairConfigJsonable {
			admin: Addr::unchecked(AddressFactory::ADMIN),
			fee_receiver: Addr::unchecked(AddressFactory::FEE_RECEIVER),
			total_fee_bps: 100,
			maker_fee_bps: 50,
			inverse: true,
			endorsed: true
		}
	);
}
