use std::path::PathBuf;

use bpaf::Bpaf;
use cosmwasm_std::Empty;
use crownfi_sei_sdk_autogen::CrownfiSdkMaker;

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
		.add_contract::<PoolFactoryInstantiateMsg, PoolFactoryExecuteMsg, PoolFactoryQueryMsg, Void, Void, Void>(
			"pool_factory",
		)?
		.add_contract::<PoolPairInstantiateMsg, PoolPairExecuteMsg, PoolPairQueryMsg, Void, Void, Void>("pool_pair")?
		.add_contract::<SwapRouterInstantiateMsg, SwapRouterExecuteMsg, SwapRouterQueryMsg, Void, Void, Void>(
			"swap_router",
		)?
		.add_contract::<Void, CW20WrapperExecMsg, CW20WrapperQueryMsg, Void, Void, Void>("cw_20_wrapper")?
		.add_contract::<Void, ERC20WrapperExecMsg, EmptyQuery, Void, Void, Void>("erc_20_wrapper")?
		.generate_code(args.out_dir)?;

	Ok(())
}
