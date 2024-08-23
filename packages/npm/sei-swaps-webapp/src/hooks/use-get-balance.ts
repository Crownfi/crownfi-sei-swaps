import { bigIntToStringDecimal, getUserTokenInfo, UnifiedDenom } from "@crownfi/sei-utils";

import { useGetClient } from "./use-get-client.js";

type UseGetBalanceOutput = {
  raw: bigint;
  decimal: string;
};

export async function useGetBalance(denom: UnifiedDenom): Promise<UseGetBalanceOutput> {
  const client = await useGetClient();

  if (!client.account)
    return {
      raw: BigInt("0"),
      decimal: "0",
    };

  const [tokenInfo, balance] = await Promise.all([
    getUserTokenInfo(denom),
    client.getBalance(denom, client.account.seiAddress)
  ]);

  return {
    raw: balance,
    decimal: bigIntToStringDecimal(balance, tokenInfo.decimals)
  }
}