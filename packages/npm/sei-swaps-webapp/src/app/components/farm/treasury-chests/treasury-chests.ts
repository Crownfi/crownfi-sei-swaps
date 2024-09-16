import { bigIntToStringDecimal } from "@crownfi/sei-utils";

import { env } from "../../../../env/index.js";
import { useGetTokenInfo } from "../../../../hooks/use-get-token-info.js";
import { swapService } from "../../../index.js";
import { TreasuryChestsComponentAutogen } from "./_autogen/treasury-chests.js";

export class TreasuryChests extends TreasuryChestsComponentAutogen {
  async connectedCallback() {
    const currencyInfo = await useGetTokenInfo(env.NORMALIZE_CURRENCY);
    const summary = await swapService.getNetworkSummary(env.NORMALIZE_CURRENCY);
    const tvl = bigIntToStringDecimal(summary.totalValueLocked, currencyInfo.decimals, true);
    const tvt = bigIntToStringDecimal(summary.totalVolumeTraded.totalVolume, currencyInfo.decimals, true);
    const tvlLastDay = bigIntToStringDecimal(summary.lastDayTotalValueLocked.totalVolume, currencyInfo.decimals, true);

    this.refs.tvlAmount.innerHTML = tvl;
    this.refs.tvtAmount.innerHTML = tvt;
    this.refs.tvlLastDayAmount.innerHTML = tvlLastDay;
  }
}

TreasuryChests.registerElement();