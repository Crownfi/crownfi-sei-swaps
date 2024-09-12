// auto-generated by C.E.W.T.
// DO NOT EDIT BY HAND!!
export class TreasuryChestsComponentRefs {
	#element: HTMLElement | ShadowRoot;
	constructor(element: HTMLElement | ShadowRoot) {
		this.#element = element;
	}
}
let _templateTreasuryChestsComponent: HTMLTemplateElement | null = null;
function getTreasuryChestsComponentTemplate(): HTMLTemplateElement {
	if (_templateTreasuryChestsComponent == null) {
		 _templateTreasuryChestsComponent = document.createElement("template")
		 _templateTreasuryChestsComponent.innerHTML = "\n  <div class=\"col align-items-center\">\n    <span class=\"label\">CrownFI TVL</span>\n    <span class=\"amount\">\n      <img class=\"loading-spinner\" width=\"32\">\n    </span>\n    <img class=\"chest\" src=\"/images/chest-obsidian.png\" alt=\"Chest Obsidian\">\n  </div>\n\n  <div class=\"col align-items-center\">\n    <span class=\"label\">Total Volume Traded</span>\n    <span class=\"amount\">\n      <img class=\"loading-spinner\" width=\"32\">\n    </span>\n    <img class=\"chest\" src=\"/images/chest-gold.png\" alt=\"Chest Gold\">\n  </div>\n\n  <div class=\"col align-items-center\">\n    <span class=\"label\">CrownFI TVL (24h)</span>\n    <span class=\"amount\">\n      <img class=\"loading-spinner\" width=\"32\">\n    </span>\n    <img class=\"chest\" src=\"/images/chest-silver.png\" alt=\"Chest Silver\">\n  </div>\n";
	}
	return _templateTreasuryChestsComponent;
}
export class TreasuryChestsComponentAutogen extends HTMLDivElement {
	readonly refs: TreasuryChestsComponentRefs;
	constructor() {
		super();
		if (this.childElementCount == 0) {
			this.appendChild(
				getTreasuryChestsComponentTemplate()
					.content
					.cloneNode(true)
			);
		}
		this.setAttribute("is", "treasury-chests-component"); // allow for easy query selecting
		this.refs = new TreasuryChestsComponentRefs(this);
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
		customElements.define("treasury-chests-component", this, { extends: "div"});
	}
}
