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
	#totalDepositsFrom?: TokenDisplayElement;
	get totalDepositsFrom() {
		if (this.#totalDepositsFrom === undefined) {
			this.#totalDepositsFrom = this.#element.querySelector("[cewt-ref=\"totalDepositsFrom\"]:not(:scope [is] *)")!;
		}
		return this.#totalDepositsFrom;
	}
	#totalDepositsTo?: TokenDisplayElement;
	get totalDepositsTo() {
		if (this.#totalDepositsTo === undefined) {
			this.#totalDepositsTo = this.#element.querySelector("[cewt-ref=\"totalDepositsTo\"]:not(:scope [is] *)")!;
		}
		return this.#totalDepositsTo;
	}
	#shareValueFrom?: TokenDisplayElement;
	get shareValueFrom() {
		if (this.#shareValueFrom === undefined) {
			this.#shareValueFrom = this.#element.querySelector("[cewt-ref=\"shareValueFrom\"]:not(:scope [is] *)")!;
		}
		return this.#shareValueFrom;
	}
	#shareValueTo?: TokenDisplayElement;
	get shareValueTo() {
		if (this.#shareValueTo === undefined) {
			this.#shareValueTo = this.#element.querySelector("[cewt-ref=\"shareValueTo\"]:not(:scope [is] *)")!;
		}
		return this.#shareValueTo;
	}
	#exchangeRateFrom?: TokenDisplayElement;
	get exchangeRateFrom() {
		if (this.#exchangeRateFrom === undefined) {
			this.#exchangeRateFrom = this.#element.querySelector("[cewt-ref=\"exchangeRateFrom\"]:not(:scope [is] *)")!;
		}
		return this.#exchangeRateFrom;
	}
	#exchangeRateTo?: TokenDisplayElement;
	get exchangeRateTo() {
		if (this.#exchangeRateTo === undefined) {
			this.#exchangeRateTo = this.#element.querySelector("[cewt-ref=\"exchangeRateTo\"]:not(:scope [is] *)")!;
		}
		return this.#exchangeRateTo;
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
		 _templatePoolDialogComponent.innerHTML = "\n  <h1>\n    <div class=\"row align-items-center justify-content-between\">\n      Pool Details\n\n      <button class=\"button close-button\" cewt-ref=\"close-button\">\n        <span class=\"cicon cicon-close primary cicon-size-small cicon-gradient\"></span>\n      </button>\n    </div>\n  </h1>\n\n  <div class=\"container\">\n    <div class=\"grid-container\">\n      <div class=\"row align-items-center\">\n        <span class=\"label\">Pools</span>\n      </div>\n\n      <div class=\"row align-items-center gap-1\">\n        <div class=\"row gap-1 align-items-center badge\">\n          <span cewt-ref=\"fromSymbol\">-</span>\n          <img is=\"token-icon\" height=\"16\" cewt-ref=\"fromIcon\">\n          <span cewt-ref=\"fromName\">-</span>\n        </div>\n\n        <div class=\"row gap-1 align-items-center badge\">\n          <span cewt-ref=\"toSymbol\">-</span>\n          <img is=\"token-icon\" height=\"16\" cewt-ref=\"toIcon\">\n          <span cewt-ref=\"toName\">-</span>\n        </div>\n      </div>\n\n      <div class=\"row align-items-center\">\n        <span class=\"label\">Total Deposits</span>\n      </div>\n\n      <div class=\"row align-items-center gap-1\">\n        <span class=\"badge\" is=\"token-display\" cewt-ref=\"totalDepositsFrom\"></span>\n        <span class=\"badge\" is=\"token-display\" cewt-ref=\"totalDepositsTo\"></span>\n      </div>\n\n      <div class=\"row align-items-center\">\n        <span class=\"label\">Share Values</span>\n      </div>\n\n      <div class=\"row align-items-center gap-1\">\n        <span class=\"badge\" is=\"token-display\" cewt-ref=\"shareValueFrom\"></span>\n        <span class=\"badge\" is=\"token-display\" cewt-ref=\"shareValueTo\"></span>\n      </div>\n\n      <div class=\"row align-items-center\">\n        <span class=\"label\">Exchange Rate</span>\n      </div>\n\n      <div class=\"row align-items-center gap-2 badge\">\n        <span is=\"token-display\" cewt-ref=\"exchangeRateFrom\"></span>\n        <span class=\"equals\">=</span>\n        <span is=\"token-display\" cewt-ref=\"exchangeRateTo\"></span>\n      </div>\n\n      <div class=\"row align-items-center\">\n        <span class=\"label\">Pool Shares</span>\n      </div>\n\n      <div class=\"row align-items-center gap-1\">\n        <span class=\"badge\" cewt-ref=\"poolSharesValue\">0</span>\n      </div>\n    </div>\n  </div>\n\n  <div class=\"container\">\n    <div class=\"row align-items-center justify-content-center gap-2 mb-1\">\n      <label class=\"button fantasy primary\">\n        <span>Deposit</span>\n        <input type=\"radio\" name=\"operation\" value=\"deposit\" cewt-ref=\"operationDeposit\">\n      </label>\n\n      <label class=\"button fantasy primary\">\n        <span>Withdraw</span>\n        <input type=\"radio\" name=\"operation\" value=\"withdraw\" checked=\"\" cewt-ref=\"operationWithdraw\">\n      </label>\n    </div>\n\n    <div cewt-ref=\"form-container\">\n\n    </div>\n  </div>\n";
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
