import { UnifiedDenom } from "@crownfi/sei-swaps-sdk";
import { SeiChainId, addUserTokenInfo, getUserTokenInfo, hasUserTokenInfo } from "@crownfi/sei-utils";

import { env } from "../env/index.js";
import { useGetClient } from "./use-get-client.js";

export async function useGetTokenInfo(denom: UnifiedDenom, network: SeiChainId = env.CHAIN_ID) {
  const client = await useGetClient();

  if (!hasUserTokenInfo(denom, network))
    await addUserTokenInfo(client.queryClient, network, denom);

  return getUserTokenInfo(denom, network);
}