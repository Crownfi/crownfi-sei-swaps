use std::path::PathBuf;

use bpaf::Bpaf;
use crownfi_astro_common::{
	factory::{AstroFactoryExecuteMsg, AstroFactoryInstantiateMsg, AstroFactoryMigrateMsg, AstroFactoryQueryMsg},
	pair::{
		AstroPairCw20HookMsg, AstroPairExecuteMsg, AstroPairInstantiateMsg, AstroPairMigrateMsg, AstroPairQueryMsg,
	},
	router::{
		AstroRouteCw20HookMsg, AstroRouteExecuteMsg, AstroRouteInstantiateMsg, AstroRouteMigrateMsg, AstroRouteQueryMsg,
	},
	wrapper::{TokenWrapperExecMsg, TokenWrapperQueryMsg},
};
use crownfi_sei_sdk_autogen::CrownfiSdkMaker;
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
			TokenWrapperExecMsg,
			TokenWrapperQueryMsg,
			Void,
			Void,
			Void
		>("token_wrapper")?
		.generate_code(args.out_dir)?;

	Ok(())
}
