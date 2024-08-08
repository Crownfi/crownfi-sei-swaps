import { SeiWallet, KNOWN_SEI_PROVIDER_INFO, KNOWN_SEI_PROVIDERS } from "@crownfi/sei-js-core";
import { WalletModalAutogen, WalletChoiceAutogen } from "./_autogen.js";
import {
	ClientEnv,
	MaybeSelectedProviderString,
	SeiChainId,
	getDefaultNetworkConfig,
	getNetworkConfig,
	setDefaultNetwork,
} from "@crownfi/sei-utils";
import { SwapMarket } from "@crownfi/sei-swaps-sdk";
import { setLoading } from "../loading.js";

export class WalletChoiceElement extends WalletChoiceAutogen {
	constructor(content?: { text: string; icon: string; value: string }) {
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
	private _userWalletChoice: MaybeSelectedProviderString;
	userWalletChoice: Promise<MaybeSelectedProviderString>;
	private userWalletChoiceCallback: (choice: MaybeSelectedProviderString) => void;
	constructor() {
		super();
		this.addEventListener("close", (ev) => {
			this.remove();
		});
		const availableWallets: WalletChoiceElement[] = [];
		const unavailableWallets: WalletChoiceElement[] = [];

		const foundProviers = SeiWallet.discoveredWallets();
		for (const providerId of KNOWN_SEI_PROVIDERS) {
			const providerInfo = KNOWN_SEI_PROVIDER_INFO[providerId];
			const choiceElem = new WalletChoiceElement({
				text: providerInfo.name,
				icon: providerInfo.icon,
				value: providerId,
			});
			if (foundProviers[providerId]) {
				availableWallets.push(choiceElem);
			} else {
				choiceElem.text += "\n(Not found)";
				choiceElem.disabled = true;
				unavailableWallets.push(choiceElem);
			}
		}
		if (new URLSearchParams(document.location.search).get("dev")) {
			availableWallets.push(
				new WalletChoiceElement({
					text: "Enter mnemonic seed\nThis is dangerous! You probably shouldn't do this!",
					icon: "/assets/placeholder.svg",
					value: "seed-wallet",
				})
			);
		}
		for (const choiceElem of availableWallets) {
			choiceElem.addEventListener("click", (ev) => {
				this._userWalletChoice = choiceElem.value as MaybeSelectedProviderString;
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
		this.userWalletChoice = new Promise((resolve) => {
			this.userWalletChoiceCallback = resolve;
		});

		this.refs.selectedNetwork.value = getDefaultNetworkConfig().chainId;
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
	// This is fugly, it might not be a good idea to support these options anyway
	const newProvider =
		userChoice == "read-only-address"
			? { address: prompt("Enter sei address") + "" }
			: userChoice == "seed-wallet"
			  ? {
						seed: prompt("Enter mnemonic seed") + "",
						index: Number(prompt("Enter mnemonic seed index", "0")) || 0,
			    }
			  : userChoice;
	try {
		setLoading(true, "Connecting to wallet...");
		const testNetwork = getNetworkConfig(walletModal.refs.selectedNetwork.value as SeiChainId);
		if (testNetwork == null) {
			throw new Error("No endpoint known for " + walletModal.refs.selectedNetwork.value);
		}
		const testClient = await ClientEnv.get(newProvider, testNetwork.chainId);
		// Test if we know contract addresses for this network
		const _ = await SwapMarket.getFromChainId(testClient.queryClient, testNetwork.chainId);
		setDefaultNetwork(testNetwork.chainId);
		await ClientEnv.setDefaultProvider(newProvider);
	} finally {
		setLoading(false);
	}
}
