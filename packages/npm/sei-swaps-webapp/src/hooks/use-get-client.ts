import { ClientEnv } from "@crownfi/sei-utils";

import { env } from "../env/index.js";

export async function useGetClient(chainId = env.CHAIN_ID) {
  return ClientEnv.get(undefined, chainId);
}