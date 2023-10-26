// auto-generated by acetewm
// DO NOT EDIT BY HAND!!
export class SwapComponentRefs {
	private _element: HTMLElement;
	constructor(element: HTMLElement) {
		this._element = element;
	}
	private _form?: HTMLFormElementKnownControls<SwapComponentFormCollection1, SwapComponentFormValues1>;
	get form() {
		if (this._form === undefined) {
			this._form = this._element.querySelector("[ace-ref=\"form\"]:not(:not(:scope)[is] *)")!;
			this._form.values = normalizeFormValues.bind(this._form, this._form);
		}
		return this._form;
	}
	private _inBalance?: HTMLSpanElement;
	get inBalance() {
		if (this._inBalance === undefined) {
			this._inBalance = this._element.querySelector("[ace-ref=\"in-balance\"]:not(:not(:scope)[is] *)")!;
		}
		return this._inBalance;
	}
	private _inIcon?: HTMLImageElement;
	get inIcon() {
		if (this._inIcon === undefined) {
			this._inIcon = this._element.querySelector("[ace-ref=\"in-icon\"]:not(:not(:scope)[is] *)")!;
		}
		return this._inIcon;
	}
	private _btnInMax?: HTMLButtonElement;
	get btnInMax() {
		if (this._btnInMax === undefined) {
			this._btnInMax = this._element.querySelector("[ace-ref=\"btn-in-max\"]:not(:not(:scope)[is] *)")!;
		}
		return this._btnInMax;
	}
	private _btnInHalf?: HTMLButtonElement;
	get btnInHalf() {
		if (this._btnInHalf === undefined) {
			this._btnInHalf = this._element.querySelector("[ace-ref=\"btn-in-half\"]:not(:not(:scope)[is] *)")!;
		}
		return this._btnInHalf;
	}
	private _outBalance?: HTMLSpanElement;
	get outBalance() {
		if (this._outBalance === undefined) {
			this._outBalance = this._element.querySelector("[ace-ref=\"out-balance\"]:not(:not(:scope)[is] *)")!;
		}
		return this._outBalance;
	}
	private _outIcon?: HTMLImageElement;
	get outIcon() {
		if (this._outIcon === undefined) {
			this._outIcon = this._element.querySelector("[ace-ref=\"out-icon\"]:not(:not(:scope)[is] *)")!;
		}
		return this._outIcon;
	}
}
export class SwapComponentAutogen extends HTMLDivElement {
	readonly refs: SwapComponentRefs;
	constructor() {
		super();
		if (this.childElementCount == 0) {
			this.appendChild(
				(document.getElementById("ace-template-swap-component") as HTMLTemplateElement)
					.content
					.cloneNode(true)
			);
		}
		this.setAttribute("is", "swap-component"); // allow for easy query selecting
		this.refs = new SwapComponentRefs(this);
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