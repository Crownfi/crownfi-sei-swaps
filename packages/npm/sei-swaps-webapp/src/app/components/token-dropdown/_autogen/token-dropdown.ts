// auto-generated by C.E.W.T.
// DO NOT EDIT BY HAND!!
import { TokenDisplayElement } from "@crownfi/sei-webui-utils";
export class TokenDropdownComponentRefs {
	#element: HTMLElement | ShadowRoot;
	constructor(element: HTMLElement | ShadowRoot) {
		this.#element = element;
	}
	#selectedToken?: TokenDisplayElement;
	get selectedToken() {
		if (this.#selectedToken === undefined) {
			this.#selectedToken = this.#element.querySelector("[cewt-ref=\"selected-token\"]:not(:scope [is] *)")!;
		}
		return this.#selectedToken;
	}
	#arrowIcon?: HTMLElement;
	get arrowIcon() {
		if (this.#arrowIcon === undefined) {
			this.#arrowIcon = this.#element.querySelector("[cewt-ref=\"arrow-icon\"]:not(:scope [is] *)")!;
		}
		return this.#arrowIcon;
	}
	#tokensDropdown?: HTMLElement;
	get tokensDropdown() {
		if (this.#tokensDropdown === undefined) {
			this.#tokensDropdown = this.#element.querySelector("[cewt-ref=\"tokens-dropdown\"]:not(:scope [is] *)")!;
		}
		return this.#tokensDropdown;
	}
}
let _templateTokenDropdownComponent: HTMLTemplateElement | null = null;
function getTokenDropdownComponentTemplate(): HTMLTemplateElement {
	if (_templateTokenDropdownComponent == null) {
		 _templateTokenDropdownComponent = document.createElement("template")
		 _templateTokenDropdownComponent.innerHTML = "\n  <span cewt-ref=\"selected-token\" is=\"token-display\"></span>\n  <i class=\"cicon cicon-size-xsmall cicon-gradient cicon-fantasy-chevron-down\" cewt-ref=\"arrow-icon\"></i>\n  <dropdown-menu click-trigger=\"primary\" cewt-ref=\"tokens-dropdown\" linked-elements=\"button:has(#this)\">\n  </dropdown-menu>\n";
	}
	return _templateTokenDropdownComponent;
}
export class TokenDropdownComponentAutogen extends HTMLButtonElement {
	readonly refs: TokenDropdownComponentRefs;
	static get observedAttributes() {
		return ["options", "selected"];
	}
	#attributeOptionsValue: string | null = null;
	get options(): string | null {
		return this.#attributeOptionsValue;
	}
	set options(v: string | null) {
		if (v == null) {
			this.removeAttribute("options");
		}else{
			this.setAttribute("options", v);
		}
	}
	protected onOptionsChanged(oldValue: string | null, newValue: string | null) {
		// To be overridden by child class
	}
	#attributeSelectedValue: string | null = null;
	get selected(): string | null {
		return this.#attributeSelectedValue;
	}
	set selected(v: string | null) {
		if (v == null) {
			this.removeAttribute("selected");
		}else{
			this.setAttribute("selected", v);
		}
	}
	protected onSelectedChanged(oldValue: string | null, newValue: string | null) {
		// To be overridden by child class
	}
	attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
		switch(name) {
			case "options":
				this.#attributeOptionsValue = newValue;
				this.onOptionsChanged(oldValue, newValue);
				break;
			case "selected":
				this.#attributeSelectedValue = newValue;
				this.onSelectedChanged(oldValue, newValue);
				break;
			default:
				// Shouldn't happen
		}
	}
	constructor() {
		super();
		if (this.childElementCount == 0) {
			this.appendChild(
				getTokenDropdownComponentTemplate()
					.content
					.cloneNode(true)
			);
		}
		this.setAttribute("is", "token-dropdown-component"); // allow for easy query selecting
		this.refs = new TokenDropdownComponentRefs(this);
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
		customElements.define("token-dropdown-component", this, { extends: "button"});
	}
}
