import { askUserForWallet } from "./wallet_dialog.js";
import { WalletButtonAutogen } from "./_autogen.js";
import { errorDialogIfRejected } from "../dialogs/index.js";
import { ClientEnv, getDefaultNetworkConfig, seiUtilEventEmitter } from "@crownfi/sei-utils";
import { qa } from "../util.js";

export class WalletButtonElement extends WalletButtonAutogen {
	constructor() {
		super();
		this.innerText = "Connect wallet";
		this.addEventListener("click", (ev) => {
			if (this.walletAddress) {
				errorDialogIfRejected(async () => {
					ClientEnv.nullifyDefaultProvider();
				});
			} else {
				errorDialogIfRejected(askUserForWallet);
			}
		});
	}
	protected onWalletAddressChanged(_: any, value: string | null): void {
		if (value) {
			this.innerText =
				value.substring(0, 4) +
				"…" +
				value.substring(value.length - 4) +
				" (" +
				getDefaultNetworkConfig().chainId +
				")";
		} else {
			this.innerText = "Connect wallet" + " (" + getDefaultNetworkConfig().chainId + ")";
		}
	}
}
WalletButtonElement.registerElement();

seiUtilEventEmitter.on("defaultProviderChanged", (ev) => {
	(qa(`button[is="wallet-button"]`) as NodeListOf<WalletButtonElement>).forEach((elem) => {
		elem.walletAddress = ev.account?.address ?? null;
	});
});
