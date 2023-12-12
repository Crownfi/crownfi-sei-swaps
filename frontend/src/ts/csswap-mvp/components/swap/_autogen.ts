// auto-generated by C.E.W.T.
// DO NOT EDIT BY HAND!!
export class SwapComponentRefs {
	#element: HTMLElement | ShadowRoot;
	constructor(element: HTMLElement | ShadowRoot) {
		this.#element = element;
	}
	#form?: HTMLFormElementKnownControls<SwapComponentFormCollection1, SwapComponentFormValues1>;
	get form() {
		if (this.#form === undefined) {
			this.#form = this.#element.querySelector("[cewt-ref=\"form\"]:not(:scope [is] *)")!;
			this.#form.values = normalizeFormValues.bind(this.#form, this.#form);
		}
		return this.#form;
	}
	#inBalance?: HTMLSpanElement;
	get inBalance() {
		if (this.#inBalance === undefined) {
			this.#inBalance = this.#element.querySelector("[cewt-ref=\"in-balance\"]:not(:scope [is] *)")!;
		}
		return this.#inBalance;
	}
	#inIcon?: HTMLImageElement;
	get inIcon() {
		if (this.#inIcon === undefined) {
			this.#inIcon = this.#element.querySelector("[cewt-ref=\"in-icon\"]:not(:scope [is] *)")!;
		}
		return this.#inIcon;
	}
	#btnInMax?: HTMLButtonElement;
	get btnInMax() {
		if (this.#btnInMax === undefined) {
			this.#btnInMax = this.#element.querySelector("[cewt-ref=\"btn-in-max\"]:not(:scope [is] *)")!;
		}
		return this.#btnInMax;
	}
	#btnInHalf?: HTMLButtonElement;
	get btnInHalf() {
		if (this.#btnInHalf === undefined) {
			this.#btnInHalf = this.#element.querySelector("[cewt-ref=\"btn-in-half\"]:not(:scope [is] *)")!;
		}
		return this.#btnInHalf;
	}
	#inError?: HTMLDivElement;
	get inError() {
		if (this.#inError === undefined) {
			this.#inError = this.#element.querySelector("[cewt-ref=\"in-error\"]:not(:scope [is] *)")!;
		}
		return this.#inError;
	}
	#outBalance?: HTMLSpanElement;
	get outBalance() {
		if (this.#outBalance === undefined) {
			this.#outBalance = this.#element.querySelector("[cewt-ref=\"out-balance\"]:not(:scope [is] *)")!;
		}
		return this.#outBalance;
	}
	#outIcon?: HTMLImageElement;
	get outIcon() {
		if (this.#outIcon === undefined) {
			this.#outIcon = this.#element.querySelector("[cewt-ref=\"out-icon\"]:not(:scope [is] *)")!;
		}
		return this.#outIcon;
	}
	#outError?: HTMLDivElement;
	get outError() {
		if (this.#outError === undefined) {
			this.#outError = this.#element.querySelector("[cewt-ref=\"out-error\"]:not(:scope [is] *)")!;
		}
		return this.#outError;
	}
}
let _templateSwapComponent: HTMLTemplateElement | null = null;
function getSwapComponentTemplate(): HTMLTemplateElement {
	if (_templateSwapComponent == null) {
		 _templateSwapComponent = document.getElementById("cewt-template-swap-component") as HTMLTemplateElement;
	}
	return _templateSwapComponent;
}
export class SwapComponentAutogen extends HTMLDivElement {
	readonly refs: SwapComponentRefs;
	constructor() {
		super();
		if (this.childElementCount == 0) {
			this.appendChild(
				getSwapComponentTemplate()
					.content
					.cloneNode(true)
			);
		}
		this.setAttribute("is", "swap-component"); // allow for easy query selecting
		this.refs = new SwapComponentRefs(this);
	}
	connectedCallback() {
		// To be overridden by child class
	}
	disconnectedCallback() {
		// To be overridden by child class
	}
	adoptedCallback() {
		// To be overridden by child class
	}
	public static registerElement() {
		customElements.define("swap-component", this, { extends: "div"});
	}
}
export type SwapComponentFormCollection1 = HTMLFormControlsCollection & {
	"in-token": HTMLSelectElement;
	namedItem(name: "in-token"): HTMLSelectElement;
	"in-amount": HTMLInputElement;
	namedItem(name: "in-amount"): HTMLInputElement;
	"out-token": HTMLSelectElement;
	namedItem(name: "out-token"): HTMLSelectElement;
	"out-amount": HTMLInputElement;
	namedItem(name: "out-amount"): HTMLInputElement;
};
export type SwapComponentFormValues1 = {
	"in-token": string;
	"in-amount": number;
	"out-token": string;
	"out-amount": number;
};
interface HTMLFormElementKnownControls<C extends HTMLFormControlsCollection, V> extends HTMLFormElement {
	readonly elements: C;
	values: () => V;
};

// TODO: Make this part of a util lib instead of part of the autogen
export function normalizeFormValues(source: HTMLFormElement | SubmitEvent): any {
	const result: any = {};
	const [formElement, submitter] = (() => {
		if (source instanceof HTMLFormElement) {
			return [source, null];
		}
		return [source.target as HTMLFormElement, source.submitter];
	})();
	for (let i = 0; i < formElement.elements.length; i += 1) {
		const formControl = formElement.elements[i];
		if (formControl instanceof HTMLButtonElement) {
			if (formControl == submitter) {
				if (formControl.name) {
					result[formControl.name] = formControl.value;
				}
			}
		}else if (formControl instanceof HTMLInputElement) {
			switch(formControl.type) {
				case "checkbox": {
					result[formControl.name] = formControl.checked;
					break;
				}
				case "datetime-local": {
					result[formControl.name] = formControl.valueAsDate;
					break;
				}
				case "file": {
					result[formControl.name] = formControl.files;
					break;
				}
				case "number":
				case "range": {
					result[formControl.name] = formControl.valueAsNumber;
					break;
				}
				case "radio": {
					if (formControl.checked) {
						result[formControl.name] = formControl.value;
						break;
					}
				}
				default:
					result[formControl.name] = formControl.value;
			}
		}else if (
			formControl instanceof HTMLOutputElement ||
			formControl instanceof HTMLSelectElement ||
			formControl instanceof HTMLTextAreaElement
		) {
			result[formControl.name] = formControl.value;
		}
	}
	return result;
}
