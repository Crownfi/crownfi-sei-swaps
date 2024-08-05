use std::path::PathBuf;

use cosmwasm_std::Empty;
use crownfi_sei_sdk_autogen::CrownfiSdkMaker;

// use crownfi_astro_common::{
// 	factory::{AstroFactoryExecuteMsg, AstroFactoryInstantiateMsg, AstroFactoryMigrateMsg, AstroFactoryQueryMsg},
// 	pair::{
// 		AstroPairCw20HookMsg, AstroPairExecuteMsg, AstroPairInstantiateMsg, AstroPairMigrateMsg, AstroPairQueryMsg,
// 	},
// 	router::{
// 		AstroRouteCw20HookMsg, AstroRouteExecuteMsg, AstroRouteInstantiateMsg, AstroRouteMigrateMsg, AstroRouteQueryMsg,
// 	},
// };

use crownfi_cw20_wrapper::msg::*;
use crownfi_erc20_wrapper::msg::*;
use crownfi_pool_factory_contract::msg::*;
use crownfi_pool_pair_contract::msg::*;
use crownfi_swap_router_contract::msg::*;

#[cosmwasm_schema::cw_serde]
#[derive(cosmwasm_schema::QueryResponses)]
enum EmptyQuery {
	#[returns(Empty)]
	Empty {},
}

type Void = ();

fn main() -> color_eyre::Result<()> {
	color_eyre::install()?;

	let curr_dir = std::env::current_dir()?;
	let mut dist_dir = curr_dir
		.into_iter()
		.take_while(|x| *x != "csswap-mvp")
		.collect::<PathBuf>();
	dist_dir.push("csswap-mvp/packages/npm");

	let mut wrapper_dist = dist_dir.clone();
	wrapper_dist.push("token-wrapper-sdk/src/base");

	let mut swaps_dist = dist_dir;
	swaps_dist.push("sei-swaps-sdk/src/base");

	CrownfiSdkMaker::new()
		.add_contract::<PoolFactoryInstantiateMsg, PoolFactoryExecuteMsg, PoolFactoryQueryMsg, Void, Void, Void>(
			"pool_factory",
		)?
		.add_contract::<PoolPairInstantiateMsg, PoolPairExecuteMsg, PoolPairQueryMsg, Void, Void, Void>("pool_pair")?
		.add_contract::<SwapRouterInstantiateMsg, SwapRouterExecuteMsg, SwapRouterQueryMsg, Void, Void, Void>(
			"swap_router",
		)?
		// .add_contract::<
		// 		AstroFactoryInstantiateMsg,
		// 		AstroFactoryExecuteMsg,
		// 		AstroFactoryQueryMsg,
		// 		AstroFactoryMigrateMsg,
		// 		Void,
		// 		Void
		// 	>("astro_factory")?
		// 	.add_contract::<
		// 		AstroPairInstantiateMsg,
		// 		AstroPairExecuteMsg,
		// 		AstroPairQueryMsg,
		// 		AstroPairMigrateMsg,
		// 		Void,
		// 		AstroPairCw20HookMsg
		// 	>("astro_pair")?
		// 	.add_contract::<
		// 		AstroRouteInstantiateMsg,
		// 		AstroRouteExecuteMsg,
		// 		AstroRouteQueryMsg,
		// 		AstroRouteMigrateMsg,
		// 		Void,
		// 		AstroRouteCw20HookMsg
		// 	>("astro_router")?
		.generate_code(swaps_dist)?;

	CrownfiSdkMaker::new()
		.add_contract::<Void, CW20WrapperExecMsg, CW20WrapperQueryMsg, Void, Void, Void>("cw_20_wrapper")?
		.add_contract::<Void, ERC20WrapperExecMsg, EmptyQuery, Void, Void, Void>("erc_20_wrapper")?
		.generate_code(wrapper_dist)?;

	Ok(())
}
