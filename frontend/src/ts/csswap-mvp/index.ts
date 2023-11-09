import { alert } from "./popups";
import { setLoading } from "./loading";
import "./wallet_chooser";
import { FarmPoolComponentElement } from "./components/farm";
import { SwapComponentElement } from "./components/swap";
import { errorDialogIfRejected, q, qa } from "./util";
import { MaybeSelectedProvider, getSelectedChain, setPreferredSeiProvider } from "./wallet-env";
import { KNOWN_SEI_PROVIDER_INFO } from "@crownfi/sei-js-core";
function removeHighlightsFromLinks() {
	(qa(".header .header-links a") as NodeListOf<HTMLAnchorElement>).forEach(v => {
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
			mainContent.appendChild(
				swapComponent
			);
		});
		mainSwapButton.classList.add("highlighted");
	};
	mainFarmButton.onclick = (ev) => {
		ev.preventDefault();
		removeHighlightsFromLinks();
		errorDialogIfRejected(async () => {
			mainContent.innerHTML = "";
			mainContent.appendChild(
				new FarmPoolComponentElement()
			);
		});
		mainFarmButton.classList.add("highlighted");
	}
	let storedPreferredProvider = localStorage.getItem("preferred_sei_provider");
	if (
		storedPreferredProvider == "seed-wallet" ||
		(storedPreferredProvider != null && storedPreferredProvider in KNOWN_SEI_PROVIDER_INFO)
	) {
		await setPreferredSeiProvider(getSelectedChain(), storedPreferredProvider as MaybeSelectedProvider);
	}
	
	mainSwapButton.click();
	setLoading(false);
}
