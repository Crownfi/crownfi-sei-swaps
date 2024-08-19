import { UnifiedDenom } from "@crownfi/sei-utils";

import { useGetClient } from "./use-get-client.js";

export async function useGetBalance(denom: UnifiedDenom) {
  const client = await useGetClient();
  if (!client.account)
    return BigInt("0");
  return client.getBalance(denom, client.account.seiAddress);
}