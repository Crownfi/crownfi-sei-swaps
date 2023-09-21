import * as bootstrap from "bootstrap";
Function.prototype(bootstrap); // Quick hack so that webpack doesn't see bootstrap's js as orphans.

const q = document.querySelector.bind(document);
const qa = document.querySelectorAll.bind(document);



async function main() {
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
	mainSwapButton.onclick = () => {
		alert("// TODO");
	};
	mainFarmButton.onclick = () => {
		
	}	
}
main().catch(ex => {
	alert("Main function threw an error:\n" + ex.name + ": " + ex.message + "\nMore details in console");
	console.error(ex);
});
