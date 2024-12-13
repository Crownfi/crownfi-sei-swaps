import { WebClientEnv } from "@crownfi/sei-webui-utils";

import { env } from "../env/index.js";

export async function useGetClient(chainId = env.CHAIN_ID) {
  return WebClientEnv.get(undefined, chainId);
}