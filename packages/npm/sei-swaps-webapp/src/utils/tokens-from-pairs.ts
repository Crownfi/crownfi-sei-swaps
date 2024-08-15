import { SwapMarketPair } from "@crownfi/sei-swaps-sdk";

export function getTokensFromPairs(pairs: SwapMarketPair[]) {
  const tokens: Set<string> = new Set();

  for (const pair of pairs) {
    tokens.add(pair.assets[0]);
    tokens.add(pair.assets[1]);
  }

  return Array.from(tokens);
}