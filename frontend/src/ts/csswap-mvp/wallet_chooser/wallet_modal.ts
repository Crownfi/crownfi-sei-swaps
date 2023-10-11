import {SeiWallet, KNOWN_SEI_PROVIDER_INFO, KNOWN_SEI_PROVIDERS} from "@crownfi/sei-js-core";
import { WalletModalAutogen, WalletChoiceAutogen } from "./_autogen";
import { MaybeSelectedProvider, setPreferredSeiProvider } from "../wallet-env";

export class WalletChoiceElement extends WalletChoiceAutogen {
	constructor(content?: {text: string, icon: string, value: string}){
		super();
		if (content) {
			this.text = content.text;
			this.icon = content.icon;
			this.value = content.value;
		}
	}
	protected onIconChanged(_: string | null, newValue: string | null) {
		this.refs.img.src = newValue || "/assets/placeholder.svg";
	}
	protected onTextChanged(_: string | null, newValue: string | null) {
		this.refs.text.innerText = newValue + "";
	}
}
WalletChoiceElement.registerElement();

export class WalletModalElement extends WalletModalAutogen {
	private _userWalletChoice: MaybeSelectedProvider;
	userWalletChoice: Promise<MaybeSelectedProvider>;
	private userWalletChoiceCallback: (choice: MaybeSelectedProvider) => void;
	constructor(){
		super();
		this.addEventListener("close", (ev) => {
			this.remove();
		});
		const availableWallets: WalletChoiceElement[] = [];
		const unavailableWallets: WalletChoiceElement[] = [];

		const foundProviers = SeiWallet.discoveredWallets();
		for(const providerId of KNOWN_SEI_PROVIDERS) {
			const providerInfo = KNOWN_SEI_PROVIDER_INFO[providerId];
			const choiceElem = new WalletChoiceElement({
				text: providerInfo.name,
				icon: providerInfo.icon,
				value: providerId
			});
			if (foundProviers[providerId]) {
				availableWallets.push(choiceElem);
			}else{
				choiceElem.text += "\n(Not found)";
				choiceElem.disabled = true;
				unavailableWallets.push(choiceElem);
			}
		}
		if((new URLSearchParams(document.location.search)).get("dev")) {
			availableWallets.push(new WalletChoiceElement({
				text: "NULL Seed wallet\nDo not use on public networks!",
				icon: "/assets/placeholder.svg",
				value: "seed-wallet"
			}));
		}
		for (const choiceElem of availableWallets) {
			choiceElem.addEventListener("click", (ev) => {
				this._userWalletChoice = choiceElem.value as MaybeSelectedProvider;
				this.close();
			});
			this.refs.choices.appendChild(choiceElem);
		}
		for (const choiceElem of unavailableWallets) {
			this.refs.choices.appendChild(choiceElem);
		}
		this.refs.cancelButton.addEventListener("click", (ev) => {
			this.close();
		});
		this._userWalletChoice = null;

		this.userWalletChoiceCallback = () => {}; // Gotta satisfy TS until 2 lines down
		this.userWalletChoice = new Promise(resolve => {
			this.userWalletChoiceCallback = resolve;
		});
	}
	connectedCallback() {
		this.showModal();
	}
	disconnectedCallback() {
		this.userWalletChoiceCallback(this._userWalletChoice);
	}
}
WalletModalElement.registerElement();

export async function askUserForWallet() {
	const walletModal = new WalletModalElement();
	document.body.appendChild(walletModal);
	const userChoice = await walletModal.userWalletChoice;
	console.log("GOT THE CHOICE!!", userChoice);
	await setPreferredSeiProvider(await walletModal.userWalletChoice);
}
