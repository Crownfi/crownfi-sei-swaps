import { appendFarmComponents } from "./components/farm";
import { appendSwapComponents } from "./components/swap";

const q = document.querySelector.bind(document);
const qa = document.querySelectorAll.bind(document);

export async function main() {
	// Wait until the DOM fully exists
	await new Promise<void>(resolve => {
		if (document.readyState == "loading") {
			document.addEventListener("DOMContentLoaded", () => {resolve()});
		} else {
			resolve();
		}
	});
	const mainSwapButton = q("#main-btn-swap") as HTMLButtonElement;
	const mainFarmButton = q("#main-btn-farm") as HTMLButtonElement;
	const mainContent = q("#main-content") as HTMLElement;
	mainSwapButton.onclick = () => {
		mainContent.innerHTML = "";
		appendSwapComponents(mainContent);
	};
	mainFarmButton.onclick = () => {
		mainContent.innerHTML = "";
		appendFarmComponents(mainContent);
	}
}
