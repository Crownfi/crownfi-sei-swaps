import { askUserForWallet } from "./wallet_modal";
import { WalletButtonAutogen } from "./_autogen";
import { errorDialogIfRejected } from "../util";
import { SeiWalletChangedEvent, getSelectedChain, setPreferredSeiProvider } from "../wallet-env";
const qa = document.querySelectorAll.bind(document);

export class WalletButtonElement extends WalletButtonAutogen {
	constructor(){
		super();
		this.innerText = "Connect wallet"
		this.addEventListener("click", (ev) => {
			if (this.walletAddress) {
				errorDialogIfRejected(async () => {
					await setPreferredSeiProvider(getSelectedChain(), null);
				})
			}else{
				errorDialogIfRejected(askUserForWallet)
			}
			
		});
	}
	protected onWalletAddressChanged(_: any, value: string | null): void {
		if (value) {
			this.innerText = value.substring(0, 4) + "…" + value.substring(value.length - 4) + " (" + getSelectedChain() + ")";
		}else{
			this.innerText = "Connect wallet" + " (" + getSelectedChain() + ")"
		}
	}
}
WalletButtonElement.registerElement();

window.addEventListener("seiWalletChanged", ((ev: SeiWalletChangedEvent) => {
	console.log("seiWalletChanged event detail:", ev.detail);
	(qa(`button[is="wallet-button"]`) as NodeListOf<WalletButtonElement>).forEach(elem => {
		elem.walletAddress = ev.detail.address;
	});
}) as (ev: Event) => void);
