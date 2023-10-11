import { alert } from "./popups";
import { setLoading } from "./loading";
import "./wallet_chooser";

const q = document.querySelector.bind(document);
const qa = document.querySelectorAll.bind(document);

export async function main() {
	const mainSwapButton = q("#swap-link") as HTMLAnchorElement;
	const mainFarmButton = q("#farm-link") as HTMLAnchorElement;
	const mainContent = q("#main-content") as HTMLElement;
	mainSwapButton.onclick = () => {
		mainContent.innerHTML = "";
		alert("TODO", "This is currently unimplemented");
		// appendSwapComponents(mainContent);
	};
	mainFarmButton.onclick = () => {
		mainContent.innerHTML = "";
		alert("TODO", "This is currently unimplemented");
		// appendFarmComponents(mainContent);
	}
	setLoading(false);
}
