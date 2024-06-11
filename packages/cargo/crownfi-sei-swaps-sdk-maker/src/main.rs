use std::path::PathBuf;

use bpaf::Bpaf;
use cosmwasm_std::Empty;
use crownfi_astro_common::{
	factory::{AstroFactoryExecuteMsg, AstroFactoryInstantiateMsg, AstroFactoryMigrateMsg, AstroFactoryQueryMsg},
	pair::{
		AstroPairCw20HookMsg, AstroPairExecuteMsg, AstroPairInstantiateMsg, AstroPairMigrateMsg, AstroPairQueryMsg,
	},
	router::{
		AstroRouteCw20HookMsg, AstroRouteExecuteMsg, AstroRouteInstantiateMsg, AstroRouteMigrateMsg, AstroRouteQueryMsg,
	},
};
use crownfi_sei_sdk_autogen::CrownfiSdkMaker;

#[cosmwasm_schema::cw_serde]
#[derive(cosmwasm_schema::QueryResponses)]
enum EmptyQuery {
	#[returns(Empty)]
	Empty {},
}

type Void = ();

#[derive(Clone, Debug, Bpaf)]
#[bpaf(options, version)]
struct MakeSdkOptions {
	#[bpaf(positional("OUT_DIR"))]
	/// The path to save the auto-generated typescript to
	out_dir: PathBuf,
}

fn main() -> color_eyre::Result<()> {
	color_eyre::install()?;
	let args = make_sdk_options().run();
	CrownfiSdkMaker::new()
		.add_contract::<
			AstroFactoryInstantiateMsg,
			AstroFactoryExecuteMsg,
			AstroFactoryQueryMsg,
			AstroFactoryMigrateMsg,
			Void,
			Void
		>("astro_factory")?
		.add_contract::<
			AstroPairInstantiateMsg,
			AstroPairExecuteMsg,
			AstroPairQueryMsg,
			AstroPairMigrateMsg,
			Void,
			AstroPairCw20HookMsg
		>("astro_pair")?
		.add_contract::<
			AstroRouteInstantiateMsg,
			AstroRouteExecuteMsg,
			AstroRouteQueryMsg,
			AstroRouteMigrateMsg,
			Void,
			AstroRouteCw20HookMsg
		>("astro_router")?
		.add_contract::<
			Void,
			crownfi_cw20_wrapper::CW20WrapperExecMsg,
			crownfi_cw20_wrapper::CW20WrapperQueryMsg,
			Void,
			Void,
			Void
		>("cw_20_wrapper")?
		.add_contract::<
			Void,
			crownfi_erc20_wrapper::ERC20WrapperExecMsg,
			EmptyQuery,
			Void,
			Void,
			Void
		>("erc_20_wrapper")?
		.generate_code(args.out_dir)?;

	Ok(())
}
