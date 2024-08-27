// auto-generated by C.E.W.T.
// DO NOT EDIT BY HAND!!
export class FarmComponentRefs {
	#element: HTMLElement | ShadowRoot;
	constructor(element: HTMLElement | ShadowRoot) {
		this.#element = element;
	}
}
let _templateFarmComponent: HTMLTemplateElement | null = null;
function getFarmComponentTemplate(): HTMLTemplateElement {
	if (_templateFarmComponent == null) {
		 _templateFarmComponent = document.createElement("template")
		 _templateFarmComponent.innerHTML = "\n  <table>\n    <thead>\n      <tr>\n        <th>\n          #\n        </th>\n\n        <th>\n          Pools\n        </th>\n\n        <th>\n          Exchange Rate\n        </th>\n\n        <th>\n          Total Deposits\n        </th>\n\n        <th>\n          Fee Rate\n        </th>\n\n        <th>\n          APY\n        </th>\n\n        <th></th>\n      </tr>\n    </thead>\n\n    <tbody>\n      <tr class=\"fantasy-menu-item-block\">\n        <td>\n          #\n        </td>\n\n        <td>\n          <span class=\"badge\" is=\"token-display\" denom=\"uatom\"></span>\n          <span class=\"badge\" is=\"token-display\" denom=\"uusdc\"></span>\n        </td>\n\n        <td>\n          <div class=\"badge\">\n            <span is=\"token-display\" denom=\"uatom\" amount=\"1\"></span>\n            <span class=\"equals\">=</span>\n            <span is=\"token-display\" denom=\"uusdc\" amount=\"14000000\"></span>\n          </div>\n        </td>\n\n        <td>\n          <div class=\"total-deposits\">\n            <span class=\"badge\" is=\"token-display\" denom=\"uatom\" amount=\"1000\"></span>\n            <span class=\"badge\" is=\"token-display\" denom=\"uusdc\" amount=\"1000000000\"></span>\n          </div>\n        </td>\n\n        <td>\n          0.30%\n        </td>\n\n        <td>\n          --\n        </td>\n\n        <td>\n          <i class=\"cicon cicon-size-small cicon-fantasy-chevron-right primary cicon-gradient\"></i>\n        </td>\n      </tr>\n    </tbody>\n  </table>\n";
	}
	return _templateFarmComponent;
}
export class FarmComponentAutogen extends HTMLDivElement {
	readonly refs: FarmComponentRefs;
	constructor() {
		super();
		if (this.childElementCount == 0) {
			this.appendChild(
				getFarmComponentTemplate()
					.content
					.cloneNode(true)
			);
		}
		this.setAttribute("is", "farm-component"); // allow for easy query selecting
		this.refs = new FarmComponentRefs(this);
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
		customElements.define("farm-component", this, { extends: "div"});
	}
}
