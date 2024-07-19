import { alert, errorDialogIfRejected } from "./dialogs/index.js";
import { setLoading } from "./loading.js";
import "./wallet_select/index.js";
//import { FarmPoolComponentElement } from "./components/farm";
import { SwapComponentElement } from "./components/swap/index.js";
import { q, qa } from "./util.js";
import { KNOWN_SEI_PROVIDER_INFO } from "@crownfi/sei-js-core";
import { ClientEnv, SeiChainId, seiUtilEventEmitter, setDefaultNetwork } from "@crownfi/sei-utils";
import { FarmPoolComponentElement } from "./components/farm/index.js";
function removeHighlightsFromLinks() {
	(qa(".header .header-links a") as NodeListOf<HTMLAnchorElement>).forEach((v) => {
		v.classList.remove("highlighted");
	});
}
export async function main() {
	const mainSwapButton = q("#swap-link") as HTMLAnchorElement;
	const mainFarmButton = q("#farm-link") as HTMLAnchorElement;
	const mainContent = q("#main-content") as HTMLElement;
	mainSwapButton.onclick = (ev) => {
		ev.preventDefault();
		removeHighlightsFromLinks();
		errorDialogIfRejected(async () => {
			mainContent.innerHTML = "";
			const swapComponent = new SwapComponentElement();
			swapComponent.className = "border-img-scroll-25";
			mainContent.appendChild(swapComponent);
		});
		mainSwapButton.classList.add("highlighted");
	};
	mainFarmButton.onclick = (ev) => {
		ev.preventDefault();
		removeHighlightsFromLinks();
		errorDialogIfRejected(async () => {
			mainContent.innerHTML = "";
			mainContent.appendChild(new FarmPoolComponentElement());
		});
		mainFarmButton.classList.add("highlighted");
	};

	let storedNetworkPref = localStorage.getItem("preferred_sei_network");
	if (storedNetworkPref == null) {
		storedNetworkPref =
			document.location.host.startsWith("127.0.0.1") || document.location.host.startsWith("localhost")
				? "sei-chain"
				: "atlantic-2";
	}
	setDefaultNetwork(storedNetworkPref as SeiChainId);
	let storedProviderPref = localStorage.getItem("preferred_sei_provider");
	ClientEnv.setDefaultProvider(storedProviderPref as any, true);

	mainSwapButton.click();
	setLoading(false);
}
seiUtilEventEmitter.on("defaultProviderChanged", ({ provider, chainId }) => {
	if (!provider) {
		localStorage.removeItem("preferred_sei_provider");
	} else {
		localStorage.setItem("preferred_sei_provider", provider);
	}
	localStorage.setItem("preferred_sei_network", chainId);
});
