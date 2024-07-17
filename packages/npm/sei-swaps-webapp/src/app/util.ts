export const q = document.querySelector.bind(document);
export const qa = document.querySelectorAll.bind(document);

// as shown from https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/elements#value
type HTMLFormControlsElement =
	| HTMLButtonElement
	| HTMLFieldSetElement
	| HTMLInputElement
	| HTMLObjectElement
	| HTMLOutputElement
	| HTMLSelectElement
	| HTMLTextAreaElement;

export function disableFormInputs(form: HTMLFormElement, exemptions: HTMLFormControlsElement[] = []) {
	const exemptSet = new Set(exemptions);
	for (let i = 0; i < form.elements.length; i++) {
		const input = form.elements[i] as HTMLFormControlsElement;
		if (exemptSet.has(input) || !("disabled" in input)) {
			continue;
		}
		input.disabled = true;
	}
}
export function enableFormInputs(form: HTMLFormElement, exemptions: HTMLFormControlsElement[] = []) {
	const exemptSet = new Set(exemptions);
	for (let i = 0; i < form.elements.length; i++) {
		const input = form.elements[i] as HTMLFormControlsElement;
		if (exemptSet.has(input) || !("disabled" in input)) {
			continue;
		}
		input.disabled = false;
	}
}
