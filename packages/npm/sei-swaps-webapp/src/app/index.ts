import "@crownfi/sei-webui-utils";
import "dropdown-menu-element";

import "./components/exports.js";

import { seiUtilEventEmitter, setDefaultNetwork } from "@crownfi/sei-utils";
import { SwapService } from "../services/swap-service.js";

import { env } from "../env/index.js";
import { AppContainer } from "./components/exports.js";
import { WebClientEnv } from "@crownfi/sei-webui-utils";
import { q } from "@aritz-cracker/browser-utils";

export let swapService: SwapService;

export async function main() {
	setDefaultNetwork(env.CHAIN_ID);

	const client = await WebClientEnv.get(undefined, env.CHAIN_ID);

	swapService = await SwapService.create(client.queryClient, env.POOL_FACTORY_CONTRACT_ADDRESS, env.ROUTER_CONTRACT_ADDRESS);

	const mainContent = q("#main-content") as HTMLElement;
	mainContent.innerHTML = "";
	mainContent.appendChild(new AppContainer());
}

seiUtilEventEmitter.on("defaultProviderChanged", ({ provider, chainId }) => {
	if (!provider) {
		localStorage.removeItem("preferred_sei_provider");
	} else {
		localStorage.setItem("preferred_sei_provider", provider);
	}
	localStorage.setItem("preferred_sei_network", chainId);
});
