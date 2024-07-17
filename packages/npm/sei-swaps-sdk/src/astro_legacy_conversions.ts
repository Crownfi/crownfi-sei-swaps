import { Addr, UIAmount, Uint128 } from "@crownfi/sei-utils";
import { AssetInfo, Asset } from "./base/types.js";
import { UnifiedDenom } from "./types.js";

export function astroAssetToAmountWithDenom(asset: Asset): [bigint, UnifiedDenom] {
	if ("token" in asset.info) {
		return [BigInt(asset.amount), "cw20/" + asset.info.token.contract_addr];
	} else {
		return [BigInt(asset.amount), asset.info.native_token.denom];
	}
}

export function amountWithDenomToAstroAsset(amount: bigint | string | number, unifiedDenom: UnifiedDenom): Asset {
	return {
		amount: amount.toString(),
		info: uniDenomToAstroAssetInfo(unifiedDenom),
	};
}

export function astroAssetInfoToUniDenom(assetInfo: AssetInfo): UnifiedDenom {
	if ("token" in assetInfo) {
		return "cw20/" + assetInfo.token.contract_addr;
	} else {
		return assetInfo.native_token.denom;
	}
}

export function uniDenomToAstroAssetInfo(unifiedDenom: UnifiedDenom): AssetInfo {
	if (unifiedDenom.startsWith("cw20/")) {
		return {
			token: { contract_addr: unifiedDenom.substring("cw20/".length) },
		};
	} else {
		return {
			native_token: { denom: unifiedDenom },
		};
	}
}

export function UIAstroportAsset(asset: Asset, trimTrailingZeros: boolean = false): string {
	return UIAmount(...astroAssetToAmountWithDenom(asset), trimTrailingZeros);
}
