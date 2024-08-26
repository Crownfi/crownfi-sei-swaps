import { useGetClient } from "./use-get-client.js";

export async function useGetAccount() {
  const client = await useGetClient();
  const account = client.account;

  return {
    isConnected: !!account,
    seiAddress: account?.seiAddress,
    evmAddress: account?.evmAddress,
  };
}