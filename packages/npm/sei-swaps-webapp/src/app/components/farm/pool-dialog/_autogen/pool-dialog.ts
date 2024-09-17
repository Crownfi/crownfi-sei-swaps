// auto-generated by C.E.W.T.
// DO NOT EDIT BY HAND!!
import { TokenDisplayElement } from "@crownfi/sei-webui-utils";
export class PoolDialogComponentRefs {
	#element: HTMLElement | ShadowRoot;
	constructor(element: HTMLElement | ShadowRoot) {
		this.#element = element;
	}
	#closeButton?: HTMLButtonElement;
	get closeButton() {
		if (this.#closeButton === undefined) {
			this.#closeButton = this.#element.querySelector("[cewt-ref=\"close-button\"]:not(:scope [is] *)")!;
		}
		return this.#closeButton;
	}
	#fromSymbol?: HTMLSpanElement;
	get fromSymbol() {
		if (this.#fromSymbol === undefined) {
			this.#fromSymbol = this.#element.querySelector("[cewt-ref=\"fromSymbol\"]:not(:scope [is] *)")!;
		}
		return this.#fromSymbol;
	}
	#fromIcon?: HTMLImageElement;
	get fromIcon() {
		if (this.#fromIcon === undefined) {
			this.#fromIcon = this.#element.querySelector("[cewt-ref=\"fromIcon\"]:not(:scope [is] *)")!;
		}
		return this.#fromIcon;
	}
	#fromName?: HTMLSpanElement;
	get fromName() {
		if (this.#fromName === undefined) {
			this.#fromName = this.#element.querySelector("[cewt-ref=\"fromName\"]:not(:scope [is] *)")!;
		}
		return this.#fromName;
	}
	#toSymbol?: HTMLSpanElement;
	get toSymbol() {
		if (this.#toSymbol === undefined) {
			this.#toSymbol = this.#element.querySelector("[cewt-ref=\"toSymbol\"]:not(:scope [is] *)")!;
		}
		return this.#toSymbol;
	}
	#toIcon?: HTMLImageElement;
	get toIcon() {
		if (this.#toIcon === undefined) {
			this.#toIcon = this.#element.querySelector("[cewt-ref=\"toIcon\"]:not(:scope [is] *)")!;
		}
		return this.#toIcon;
	}
	#toName?: HTMLSpanElement;
	get toName() {
		if (this.#toName === undefined) {
			this.#toName = this.#element.querySelector("[cewt-ref=\"toName\"]:not(:scope [is] *)")!;
		}
		return this.#toName;
	}
	#totalDepositsFromAmount?: HTMLSpanElement;
	get totalDepositsFromAmount() {
		if (this.#totalDepositsFromAmount === undefined) {
			this.#totalDepositsFromAmount = this.#element.querySelector("[cewt-ref=\"totalDepositsFromAmount\"]:not(:scope [is] *)")!;
		}
		return this.#totalDepositsFromAmount;
	}
	#totalDepositsFromIcon?: HTMLImageElement;
	get totalDepositsFromIcon() {
		if (this.#totalDepositsFromIcon === undefined) {
			this.#totalDepositsFromIcon = this.#element.querySelector("[cewt-ref=\"totalDepositsFromIcon\"]:not(:scope [is] *)")!;
		}
		return this.#totalDepositsFromIcon;
	}
	#totalDepositsToAmount?: HTMLSpanElement;
	get totalDepositsToAmount() {
		if (this.#totalDepositsToAmount === undefined) {
			this.#totalDepositsToAmount = this.#element.querySelector("[cewt-ref=\"totalDepositsToAmount\"]:not(:scope [is] *)")!;
		}
		return this.#totalDepositsToAmount;
	}
	#totalDepositsToIcon?: HTMLImageElement;
	get totalDepositsToIcon() {
		if (this.#totalDepositsToIcon === undefined) {
			this.#totalDepositsToIcon = this.#element.querySelector("[cewt-ref=\"totalDepositsToIcon\"]:not(:scope [is] *)")!;
		}
		return this.#totalDepositsToIcon;
	}
	#totalDepositsNormalized?: TokenDisplayElement;
	get totalDepositsNormalized() {
		if (this.#totalDepositsNormalized === undefined) {
			this.#totalDepositsNormalized = this.#element.querySelector("[cewt-ref=\"totalDepositsNormalized\"]:not(:scope [is] *)")!;
		}
		return this.#totalDepositsNormalized;
	}
	#shareValueFromAmount?: HTMLSpanElement;
	get shareValueFromAmount() {
		if (this.#shareValueFromAmount === undefined) {
			this.#shareValueFromAmount = this.#element.querySelector("[cewt-ref=\"shareValueFromAmount\"]:not(:scope [is] *)")!;
		}
		return this.#shareValueFromAmount;
	}
	#shareValueFromIcon?: HTMLImageElement;
	get shareValueFromIcon() {
		if (this.#shareValueFromIcon === undefined) {
			this.#shareValueFromIcon = this.#element.querySelector("[cewt-ref=\"shareValueFromIcon\"]:not(:scope [is] *)")!;
		}
		return this.#shareValueFromIcon;
	}
	#shareValueToAmount?: HTMLSpanElement;
	get shareValueToAmount() {
		if (this.#shareValueToAmount === undefined) {
			this.#shareValueToAmount = this.#element.querySelector("[cewt-ref=\"shareValueToAmount\"]:not(:scope [is] *)")!;
		}
		return this.#shareValueToAmount;
	}
	#shareValueToIcon?: HTMLImageElement;
	get shareValueToIcon() {
		if (this.#shareValueToIcon === undefined) {
			this.#shareValueToIcon = this.#element.querySelector("[cewt-ref=\"shareValueToIcon\"]:not(:scope [is] *)")!;
		}
		return this.#shareValueToIcon;
	}
	#shareValuesNormalized?: TokenDisplayElement;
	get shareValuesNormalized() {
		if (this.#shareValuesNormalized === undefined) {
			this.#shareValuesNormalized = this.#element.querySelector("[cewt-ref=\"shareValuesNormalized\"]:not(:scope [is] *)")!;
		}
		return this.#shareValuesNormalized;
	}
	#exchangeRateFromAmount?: HTMLSpanElement;
	get exchangeRateFromAmount() {
		if (this.#exchangeRateFromAmount === undefined) {
			this.#exchangeRateFromAmount = this.#element.querySelector("[cewt-ref=\"exchangeRateFromAmount\"]:not(:scope [is] *)")!;
		}
		return this.#exchangeRateFromAmount;
	}
	#exchangeRateFromIcon?: HTMLImageElement;
	get exchangeRateFromIcon() {
		if (this.#exchangeRateFromIcon === undefined) {
			this.#exchangeRateFromIcon = this.#element.querySelector("[cewt-ref=\"exchangeRateFromIcon\"]:not(:scope [is] *)")!;
		}
		return this.#exchangeRateFromIcon;
	}
	#exchangeRateToAmount?: HTMLSpanElement;
	get exchangeRateToAmount() {
		if (this.#exchangeRateToAmount === undefined) {
			this.#exchangeRateToAmount = this.#element.querySelector("[cewt-ref=\"exchangeRateToAmount\"]:not(:scope [is] *)")!;
		}
		return this.#exchangeRateToAmount;
	}
	#exchangeRateToIcon?: HTMLImageElement;
	get exchangeRateToIcon() {
		if (this.#exchangeRateToIcon === undefined) {
			this.#exchangeRateToIcon = this.#element.querySelector("[cewt-ref=\"exchangeRateToIcon\"]:not(:scope [is] *)")!;
		}
		return this.#exchangeRateToIcon;
	}
	#poolSharesValue?: HTMLSpanElement;
	get poolSharesValue() {
		if (this.#poolSharesValue === undefined) {
			this.#poolSharesValue = this.#element.querySelector("[cewt-ref=\"poolSharesValue\"]:not(:scope [is] *)")!;
		}
		return this.#poolSharesValue;
	}
	#operationDeposit?: HTMLInputElement;
	get operationDeposit() {
		if (this.#operationDeposit === undefined) {
			this.#operationDeposit = this.#element.querySelector("[cewt-ref=\"operationDeposit\"]:not(:scope [is] *)")!;
		}
		return this.#operationDeposit;
	}
	#operationWithdraw?: HTMLInputElement;
	get operationWithdraw() {
		if (this.#operationWithdraw === undefined) {
			this.#operationWithdraw = this.#element.querySelector("[cewt-ref=\"operationWithdraw\"]:not(:scope [is] *)")!;
		}
		return this.#operationWithdraw;
	}
	#formContainer?: HTMLDivElement;
	get formContainer() {
		if (this.#formContainer === undefined) {
			this.#formContainer = this.#element.querySelector("[cewt-ref=\"form-container\"]:not(:scope [is] *)")!;
		}
		return this.#formContainer;
	}
}
let _templatePoolDialogComponent: HTMLTemplateElement | null = null;
function getPoolDialogComponentTemplate(): HTMLTemplateElement {
	if (_templatePoolDialogComponent == null) {
		 _templatePoolDialogComponent = document.createElement("template")
		 _templatePoolDialogComponent.innerHTML = "\n  <h1>\n    <div class=\"row align-items-center justify-content-between\">\n      Pool Details\n\n      <button class=\"button close-button\" cewt-ref=\"close-button\">\n        <span class=\"cicon cicon-close primary cicon-size-small cicon-gradient\"></span>\n      </button>\n    </div>\n  </h1>\n\n  <div class=\"container\">\n    <div class=\"grid-container\">\n      <div class=\"row align-items-center\">\n        <span class=\"label\">Pools</span>\n      </div>\n\n      <div class=\"row align-items-center gap-1\">\n        <div class=\"row gap-1 align-items-center badge\">\n          <span cewt-ref=\"fromSymbol\">-</span>\n          <img is=\"token-icon\" height=\"16\" cewt-ref=\"fromIcon\">\n          <span cewt-ref=\"fromName\">-</span>\n        </div>\n\n        <div class=\"row gap-1 align-items-center badge\">\n          <span cewt-ref=\"toSymbol\">-</span>\n          <img is=\"token-icon\" height=\"16\" cewt-ref=\"toIcon\">\n          <span cewt-ref=\"toName\">-</span>\n        </div>\n      </div>\n\n      <div class=\"row align-items-center\">\n        <span class=\"label\">Total Deposits</span>\n      </div>\n\n      <div class=\"row align-items-center gap-1\">\n        <div class=\"badge row align-items-center gap-1\">\n          <span cewt-ref=\"totalDepositsFromAmount\">0</span>\n          <img is=\"token-icon\" height=\"16\" cewt-ref=\"totalDepositsFromIcon\">\n        </div>\n        <span class=\"math-symbol\">+</span>\n        <div class=\"badge row align-items-center gap-1\">\n          <span cewt-ref=\"totalDepositsToAmount\">0</span>\n          <img is=\"token-icon\" height=\"16\" cewt-ref=\"totalDepositsToIcon\">\n        </div>\n        <span class=\"math-symbol\">≅</span>\n        <span class=\"badge\" is=\"token-display\" cewt-ref=\"totalDepositsNormalized\"></span>\n      </div>\n\n      <div class=\"row align-items-center\">\n        <span class=\"label\">Share Values</span>\n      </div>\n\n      <div class=\"row align-items-center gap-1\">\n        <div class=\"badge row align-items-center gap-1\">\n          <span cewt-ref=\"shareValueFromAmount\">0</span>\n          <img is=\"token-icon\" height=\"16\" cewt-ref=\"shareValueFromIcon\">\n        </div>\n        <span class=\"math-symbol\">+</span>\n        <div class=\"badge row align-items-center gap-1\">\n          <span cewt-ref=\"shareValueToAmount\">0</span>\n          <img is=\"token-icon\" height=\"16\" cewt-ref=\"shareValueToIcon\">\n        </div>\n        <span class=\"math-symbol\">≅</span>\n        <span class=\"badge\" is=\"token-display\" cewt-ref=\"shareValuesNormalized\"></span>\n      </div>\n\n      <div class=\"row align-items-center\">\n        <span class=\"label\">Exchange Rate</span>\n      </div>\n\n      <div class=\"row align-items-center gap-2 badge\">\n        <div class=\"row align-items-center gap-1\">\n          <span cewt-ref=\"exchangeRateFromAmount\">0</span>\n          <img is=\"token-icon\" height=\"16\" cewt-ref=\"exchangeRateFromIcon\">\n        </div>\n        <span class=\"math-symbol\">=</span>\n        <div class=\"row align-items-center gap-1\">\n          <span cewt-ref=\"exchangeRateToAmount\">0</span>\n          <img is=\"token-icon\" height=\"16\" cewt-ref=\"exchangeRateToIcon\">\n        </div>\n      </div>\n\n      <div class=\"row align-items-center\">\n        <span class=\"label\">Pool Shares</span>\n      </div>\n\n      <div class=\"row align-items-center gap-1\">\n        <span class=\"badge\" cewt-ref=\"poolSharesValue\">0</span>\n      </div>\n    </div>\n  </div>\n\n  <div class=\"container\">\n    <div class=\"row align-items-center justify-content-center gap-2 mb-1\">\n      <label class=\"button fantasy primary\">\n        <span>Deposit</span>\n        <input type=\"radio\" name=\"operation\" value=\"deposit\" checked=\"\" cewt-ref=\"operationDeposit\">\n      </label>\n\n      <label class=\"button fantasy primary\">\n        <span>Withdraw</span>\n        <input type=\"radio\" name=\"operation\" value=\"withdraw\" cewt-ref=\"operationWithdraw\">\n      </label>\n    </div>\n\n    <div cewt-ref=\"form-container\">\n\n    </div>\n  </div>\n";
	}
	return _templatePoolDialogComponent;
}
export class PoolDialogComponentAutogen extends HTMLDialogElement {
	readonly refs: PoolDialogComponentRefs;
	constructor() {
		super();
		if (this.childElementCount == 0) {
			this.appendChild(
				getPoolDialogComponentTemplate()
					.content
					.cloneNode(true)
			);
		}
		this.setAttribute("is", "pool-dialog-component"); // allow for easy query selecting
		this.refs = new PoolDialogComponentRefs(this);
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
		customElements.define("pool-dialog-component", this, { extends: "dialog"});
	}
}