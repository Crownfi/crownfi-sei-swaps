import { SwapComponentAutogen } from "./autogen";
import { CHAIN_CONFIG } from "../../chain_config";

class SwapComponentElement extends SwapComponentAutogen {
	constructor(pair: string) {
		super();
		if (arguments.length == 0) {
			// Maybe check a data tag if we ever want to bother with SSR
			throw new Error("You can't just add a <swap-component> to the DOM all raw like that.");
		}
		//CHAIN_CONFIG.pairs
	}
}
SwapComponentElement.registerElement();
