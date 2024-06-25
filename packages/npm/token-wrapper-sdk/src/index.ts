// import ethers from "ethers"
//
// import { CW20TokenWrapper } from "./cw20"
// import { ERC20TokenWrapper } from "./erc20"
// import { SigningClient } from "./common"
//
// export class TokenWrapperSdk {
// 	private cw20wrapper?: CW20TokenWrapper
// 	private erc20wrapper?: ERC20TokenWrapper
//
// 	constructor(client: SigningClient, evm_wallet: ethers.BaseWallet, cw20_address: string, erc20_address: string) {
// 		this.cw20wrapper = new CW20TokenWrapper(client, cw20_address)
// 		this.erc20wrapper = new ERC20TokenWrapper(client, erc20_address, evm_wallet)
// 	}
//
// 	wrap_cw20 = this.cw20wrapper!.wrap
// 	wrap_erc20 = this.erc20wrapper!.wrap
//
// 	unwrap_cw20 = this.cw20wrapper!.unwrap
// 	unwrap_erc20 = this.erc20wrapper!.unwrap
//
// 	make_native_denom_cw20 = this.cw20wrapper!.make_native_denom
// 	make_native_denom_erc20 = this.erc20wrapper!.make_native_denom
// }

export * from "./base"
export * from "./cw20"
export * from "./erc20"
