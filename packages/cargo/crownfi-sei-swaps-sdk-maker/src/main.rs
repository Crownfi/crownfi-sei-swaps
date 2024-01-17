use std::path::PathBuf;

use bpaf::Bpaf;
use crownfi_astro_common::factory::{AstroFactoryInstantiateMsg, AstroFactoryExecuteMsg, AstroFactoryQueryMsg, AstroFactoryMigrateMsg};
use crownfi_sei_sdk_autogen::CrownfiSdkMaker;
type Void = ();

#[derive(Clone, Debug, Bpaf)]
#[bpaf(options, version)]
struct MakeSdkOptions {
	#[bpaf(positional("OUT_DIR"))]
	/// The path to save the auto-generated typescript to
	out_dir: PathBuf
}

fn main() -> color_eyre::Result<()> {
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
		.generate_code(args.out_dir)?;
	
	Ok(())
}
