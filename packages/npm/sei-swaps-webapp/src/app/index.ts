import "@crownfi/sei-webui-utils";
import "dropdown-menu-element";

import "./components/exports.js";

import { alert, errorDialogIfRejected } from "./dialogs/index.js";

//import { FarmPoolComponentElement } from "./components/farm";
import { SwapComponentElement } from "./components/swap/index.js";
import { q, qa } from "./util.js";
import { KNOWN_SEI_PROVIDER_INFO } from "@crownfi/sei-js-core";
import { SeiChainId, seiUtilEventEmitter, setDefaultNetwork, setNetworkConfig } from "@crownfi/sei-utils";
import { FarmPoolComponentElement } from "./components/farm/index.js";
import { SwapService } from "../services/swap-service.js";

import { env } from "../env/index.js";
import { AppContainer } from "./components/exports.js";
import { WebClientEnv } from "@crownfi/sei-webui-utils";

function removeHighlightsFromLinks() {
	(qa(".header .header-links a") as NodeListOf<HTMLAnchorElement>).forEach((v) => {
		v.classList.remove("highlighted");
	});
}

export let swapService: SwapService;

export async function main() {
	setDefaultNetwork(env.CHAIN_ID);

	let storedProviderPref = localStorage.getItem("preferred_sei_provider");
	await WebClientEnv.setDefaultProvider(storedProviderPref as any, true);
	const client = await WebClientEnv.get(undefined, env.CHAIN_ID);

	swapService = await SwapService.create(client.queryClient, env.POOL_FACTORY_CONTRACT_ADDRESS, env.ROUTER_CONTRACT_ADDRESS);

	const mainContent = q("#main-content") as HTMLElement;
	mainContent.innerHTML = "";
	mainContent.appendChild(new AppContainer());

	// const mainSwapButton = q("#swap-link") as HTMLAnchorElement;
	// const mainFarmButton = q("#farm-link") as HTMLAnchorElement;
	// const mainContent = q("#main-content") as HTMLElement;
	// mainSwapButton.onclick = (ev) => {
	// 	ev.preventDefault();
	// 	removeHighlightsFromLinks();
	// 	errorDialogIfRejected(async () => {
	// 		mainContent.innerHTML = "";
	// 		const swapComponent = new SwapComponentElement();
	// 		swapComponent.className = "border-img-scroll-25";
	// 		mainContent.appendChild(swapComponent);
	// 	});
	// 	mainSwapButton.classList.add("highlighted");
	// };
	// mainFarmButton.onclick = (ev) => {
	// 	ev.preventDefault();
	// 	removeHighlightsFromLinks();
	// 	errorDialogIfRejected(async () => {
	// 		mainContent.innerHTML = "";
	// 		mainContent.appendChild(new FarmPoolComponentElement());
	// 	});
	// 	mainFarmButton.classList.add("highlighted");
	// };

	// let storedNetworkPref = localStorage.getItem("preferred_sei_network");

	// if (storedNetworkPref == null) {
	// 	storedNetworkPref =
	// 		document.location.host.startsWith("127.0.0.1") || document.location.host.startsWith("localhost")
	// 			? "sei-chain"
	// 			: "atlantic-2";
	// }

	// mainSwapButton.click();
	// setLoading(false);
}

seiUtilEventEmitter.on("defaultProviderChanged", ({ provider, chainId }) => {
	if (!provider) {
		localStorage.removeItem("preferred_sei_provider");
	} else {
		localStorage.setItem("preferred_sei_provider", provider);
	}
	localStorage.setItem("preferred_sei_network", chainId);
});
