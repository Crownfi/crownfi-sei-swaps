import "@crownfi/sei-webui-utils";
import "dropdown-menu-element";
import { q } from "@aritz-cracker/browser-utils";

import "./components/exports.js";

import { SwapService } from "../services/swap-service.js";

import { env } from "../env/index.js";
import { AppContainer } from "./components/exports.js";
import { useGetClient } from "../hooks/use-get-client.js";

export let swapService: SwapService;

const DOM_CONTENT_LOADED: Promise<void> = document.readyState == "loading" ? new Promise(resolve => {
	document.addEventListener("DOMContentLoaded", (_) => {
		resolve();
	})
}) : Promise.resolve();
const SEI_NETWORK_CONNECTED: Promise<void> = new Promise(resolve => {
	document.addEventListener("initialSeiConnection", (_) => {
		resolve();
	}, {once: true});
});

export async function main() {
	// setDefaultNetwork(env.CHAIN_ID);

	await DOM_CONTENT_LOADED;
	await SEI_NETWORK_CONNECTED;

	const client = await useGetClient();

	swapService = await SwapService.create(client.queryClient, env.POOL_FACTORY_CONTRACT_ADDRESS, env.ROUTER_CONTRACT_ADDRESS);

	const mainContent = q("#main-content") as HTMLElement;
	mainContent.innerHTML = "";
	mainContent.appendChild(new AppContainer());
}