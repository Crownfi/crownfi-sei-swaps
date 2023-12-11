// auto-generated by C.E.W.T.
// DO NOT EDIT BY HAND!!
export class PopupModalRefs {
	#element: HTMLElement | ShadowRoot;
	constructor(element: HTMLElement | ShadowRoot) {
		this.#element = element;
	}
	#heading?: HTMLHeadingElement;
	get heading() {
		if (this.#heading === undefined) {
			this.#heading = this.#element.querySelector("[cewt-ref=\"heading\"]:not(:scope [is] *)")!;
		}
		return this.#heading;
	}
	#message?: HTMLParagraphElement;
	get message() {
		if (this.#message === undefined) {
			this.#message = this.#element.querySelector("[cewt-ref=\"message\"]:not(:scope [is] *)")!;
		}
		return this.#message;
	}
	#dismissBtn?: HTMLButtonElement;
	get dismissBtn() {
		if (this.#dismissBtn === undefined) {
			this.#dismissBtn = this.#element.querySelector("[cewt-ref=\"dismiss-btn\"]:not(:scope [is] *)")!;
		}
		return this.#dismissBtn;
	}
}
let _templatePopupModal: HTMLTemplateElement | null = null;
function getPopupModalTemplate(): HTMLTemplateElement {
	if (_templatePopupModal == null) {
		 _templatePopupModal = document.getElementById("cewt-template-popup-modal") as HTMLTemplateElement;
	}
	return _templatePopupModal;
}
export class PopupModalAutogen extends HTMLDialogElement {
	readonly refs: PopupModalRefs;
	static get observedAttributes() {
		return ["message", "heading"];
	}
	#attributeMessageValue: string | null = null;
	get message(): string | null {
		return this.#attributeMessageValue;
	}
	set message(v: string | null) {
		if (v == null) {
			this.removeAttribute("message");
		}else{
			this.setAttribute("message", v);
		}
	}
	protected onMessageChanged(oldValue: string | null, newValue: string | null) {
		// To be overridden by child class
	}
	#attributeHeadingValue: string | null = null;
	get heading(): string | null {
		return this.#attributeHeadingValue;
	}
	set heading(v: string | null) {
		if (v == null) {
			this.removeAttribute("heading");
		}else{
			this.setAttribute("heading", v);
		}
	}
	protected onHeadingChanged(oldValue: string | null, newValue: string | null) {
		// To be overridden by child class
	}
	attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
		switch(name) {
			case "message":
				this.#attributeMessageValue = newValue;
				this.onMessageChanged(oldValue, newValue);
				break;
			case "heading":
				this.#attributeHeadingValue = newValue;
				this.onHeadingChanged(oldValue, newValue);
				break;
			default:
				// Shouldn't happen
		}
	}
	constructor() {
		super();
		if (this.childElementCount == 0) {
			this.appendChild(
				getPopupModalTemplate()
					.content
					.cloneNode(true)
			);
		}
		this.setAttribute("is", "popup-modal"); // allow for easy query selecting
		this.refs = new PopupModalRefs(this);
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
		customElements.define("popup-modal", this, { extends: "dialog"});
	}
}
export class ErrorModalRefs {
	#element: HTMLElement | ShadowRoot;
	constructor(element: HTMLElement | ShadowRoot) {
		this.#element = element;
	}
	#heading?: HTMLHeadingElement;
	get heading() {
		if (this.#heading === undefined) {
			this.#heading = this.#element.querySelector("[cewt-ref=\"heading\"]:not(:scope [is] *)")!;
		}
		return this.#heading;
	}
	#message?: HTMLParagraphElement;
	get message() {
		if (this.#message === undefined) {
			this.#message = this.#element.querySelector("[cewt-ref=\"message\"]:not(:scope [is] *)")!;
		}
		return this.#message;
	}
	#errorDetails?: HTMLTextAreaElement;
	get errorDetails() {
		if (this.#errorDetails === undefined) {
			this.#errorDetails = this.#element.querySelector("[cewt-ref=\"error-details\"]:not(:scope [is] *)")!;
		}
		return this.#errorDetails;
	}
	#dismissBtn?: HTMLButtonElement;
	get dismissBtn() {
		if (this.#dismissBtn === undefined) {
			this.#dismissBtn = this.#element.querySelector("[cewt-ref=\"dismiss-btn\"]:not(:scope [is] *)")!;
		}
		return this.#dismissBtn;
	}
}
let _templateErrorModal: HTMLTemplateElement | null = null;
function getErrorModalTemplate(): HTMLTemplateElement {
	if (_templateErrorModal == null) {
		 _templateErrorModal = document.getElementById("cewt-template-error-modal") as HTMLTemplateElement;
	}
	return _templateErrorModal;
}
export class ErrorModalAutogen extends HTMLDialogElement {
	readonly refs: ErrorModalRefs;
	static get observedAttributes() {
		return ["details", "heading", "message"];
	}
	#attributeDetailsValue: string | null = null;
	get details(): string | null {
		return this.#attributeDetailsValue;
	}
	set details(v: string | null) {
		if (v == null) {
			this.removeAttribute("details");
		}else{
			this.setAttribute("details", v);
		}
	}
	protected onDetailsChanged(oldValue: string | null, newValue: string | null) {
		// To be overridden by child class
	}
	#attributeHeadingValue: string | null = null;
	get heading(): string | null {
		return this.#attributeHeadingValue;
	}
	set heading(v: string | null) {
		if (v == null) {
			this.removeAttribute("heading");
		}else{
			this.setAttribute("heading", v);
		}
	}
	protected onHeadingChanged(oldValue: string | null, newValue: string | null) {
		// To be overridden by child class
	}
	#attributeMessageValue: string | null = null;
	get message(): string | null {
		return this.#attributeMessageValue;
	}
	set message(v: string | null) {
		if (v == null) {
			this.removeAttribute("message");
		}else{
			this.setAttribute("message", v);
		}
	}
	protected onMessageChanged(oldValue: string | null, newValue: string | null) {
		// To be overridden by child class
	}
	attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
		switch(name) {
			case "details":
				this.#attributeDetailsValue = newValue;
				this.onDetailsChanged(oldValue, newValue);
				break;
			case "heading":
				this.#attributeHeadingValue = newValue;
				this.onHeadingChanged(oldValue, newValue);
				break;
			case "message":
				this.#attributeMessageValue = newValue;
				this.onMessageChanged(oldValue, newValue);
				break;
			default:
				// Shouldn't happen
		}
	}
	constructor() {
		super();
		if (this.childElementCount == 0) {
			this.appendChild(
				getErrorModalTemplate()
					.content
					.cloneNode(true)
			);
		}
		this.setAttribute("is", "error-modal"); // allow for easy query selecting
		this.refs = new ErrorModalRefs(this);
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
		customElements.define("error-modal", this, { extends: "dialog"});
	}
}
