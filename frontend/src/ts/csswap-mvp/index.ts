import { alert } from "./popups";
import { setLoading } from "./loading";
import "./wallet_chooser";
import { FarmPoolComponentElement } from "./components/farm";
import { SwapComponentElement } from "./components/swap";
import { q } from "./util";
import { MaybeSelectedProvider, getSelectedChain, setPreferredSeiProvider } from "./wallet-env";
import { KNOWN_SEI_PROVIDER_INFO } from "@crownfi/sei-js-core";

export async function main() {
	const mainSwapButton = q("#swap-link") as HTMLAnchorElement;
	const mainFarmButton = q("#farm-link") as HTMLAnchorElement;
	const mainContent = q("#main-content") as HTMLElement;
	mainSwapButton.onclick = (ev) => {
		ev.preventDefault();
		mainContent.innerHTML = "";
		mainContent.appendChild(
			new SwapComponentElement()
		);
	};
	mainFarmButton.onclick = (ev) => {
		ev.preventDefault();
		mainContent.innerHTML = "";
		mainContent.appendChild(
			new FarmPoolComponentElement()
		);
	}
	let storedPreferredProvider = localStorage.getItem("preferred_sei_provider");
	if (
		storedPreferredProvider == "seed-wallet" ||
		(storedPreferredProvider != null && storedPreferredProvider in KNOWN_SEI_PROVIDER_INFO)
	) {
		await setPreferredSeiProvider(getSelectedChain(), storedPreferredProvider as MaybeSelectedProvider);
	}
	setLoading(false);
}
