import { alert } from "./popups";
import { setLoading } from "./loading";
import "./wallet_chooser";
import { FarmPoolComponentElement } from "./components/farm";
import { SwapComponentElement } from "./components/swap";

const q = document.querySelector.bind(document);
const qa = document.querySelectorAll.bind(document);

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
	setLoading(false);
}
