import { SeiNetId } from "../chain_config";
import { SeiChainChangedEvent, getSelectedChain, setSelectedChain } from "../wallet-env";
import { NetworkSelectorAutogen } from "./_autogen";
const qa = document.querySelectorAll.bind(document);

export class NetworkSelectorElement extends NetworkSelectorAutogen {
	constructor() {
		super();
		this.value = getSelectedChain();
		this.addEventListener("input", (ev) => {
			setSelectedChain(this.value as SeiNetId);
		});
	}
}
NetworkSelectorElement.registerElement();
(window as any).NetworkSelectorElement = NetworkSelectorElement;
console.log({NetworkSelectorElement});

window.addEventListener("seiChainChanged", ((ev: SeiChainChangedEvent) => {
	console.log("seiChainChanged event detail:", ev.detail);
	(qa(`select[is="network-selector"]`) as NodeListOf<NetworkSelectorElement>).forEach(elem => {
		elem.value = ev.detail.chainId;
	});
}) as (ev: Event) => void);
