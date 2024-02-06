

function supportsExtendingBuiltinElements() {
	try {
		const newElemName = "test-button-" + Date.now().toString(36);
		class HTMLTestButton extends HTMLButtonElement {};
		customElements.define(newElemName, HTMLTestButton, { extends: "button" });
		const newBtn = document.createElement("button", { is: newElemName });
		return newBtn instanceof HTMLButtonElement && newBtn instanceof HTMLTestButton;
	}catch(ex: any) {
		return false;
	}
}

async function entrypoint() {
	if (typeof HTMLDialogElement === "undefined") {
		// Not using the polyfill because of its slight behavioural and CSS differences.
		throw new Error("Your browser is too outdated. (It doesn't support <dialog> elements)");
	}
	// This check only exists because Safari. Thank you Safari for being the new ie6.
	if (!supportsExtendingBuiltinElements()) {
		console.warn("Oh no, you're using safari :(");
		// @ts-ignore
		Function.prototype(await import("@ungap/custom-elements"));
		if (supportsExtendingBuiltinElements()) {
			console.error("The polyfill didn't work like I expected. Here be dragons!");
		}
	}
	// Wait until the DOM fully exists, custom elements depend on templates which are only guaranteed at to exist then.
	await new Promise<void>(resolve => {
		if (document.readyState == "loading") {
			document.addEventListener("DOMContentLoaded", () => {resolve()});
		} else {
			resolve();
		}
	});
	
	const {main} = await import("./app/index");
	await main();
}

entrypoint().catch(ex => {
	alert("Main function threw an error:\n" + ex.name + ": " + ex.message + "\nMore details in console");
	console.error(ex);
});
