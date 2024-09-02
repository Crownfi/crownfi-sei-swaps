import { swapService } from "../../index.js";
import { FarmComponentAutogen } from "./_autogen/farm.js";
import { PoolItemComponent } from "./pool-item/pool-item.js";

export class FarmComponent extends FarmComponentAutogen {
  async connectedCallback() {
    this.refs.poolsList.innerHTML = "";
    const pairs = await swapService.getPairs();
    const separator = document.createElement("tr");
    separator.innerHTML = `<td style="padding: 4px; background: transparent;" colspan="7"></td>`;
    for (const pair of pairs) {
      this.refs.poolsList.appendChild(separator);
      this.refs.poolsList.appendChild(new PoolItemComponent(pair));
    }
  }
}

FarmComponent.registerElement();