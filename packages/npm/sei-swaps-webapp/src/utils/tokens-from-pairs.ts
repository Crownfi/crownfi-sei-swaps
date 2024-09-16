import { SwapMarketPair } from "@crownfi/sei-swaps-sdk";

export function getTokensFromPairs(pairs: SwapMarketPair[]) {
  const tokens: Set<string> = new Set();

  for (const pair of pairs) {
    tokens.add(pair.unwrappedAssets[0]);
    tokens.add(pair.unwrappedAssets[1]);
  }

  return Array.from(tokens);
}