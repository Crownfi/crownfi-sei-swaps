import { SeiChainId } from "@crownfi/sei-utils";

const CHAIN_ID = process.env.CHAIN_ID as SeiChainId;
const POOL_FACTORY_CONTRACT_ADDRESS = process.env.POOL_FACTORY_CONTRACT_ADDRESS;
const ROUTER_CONTRACT_ADDRESS = process.env.ROUTER_CONTRACT_ADDRESS;

if (!CHAIN_ID ||
    !POOL_FACTORY_CONTRACT_ADDRESS ||
    !ROUTER_CONTRACT_ADDRESS)
  throw new Error("Missing environment variables");

export const env = {
  CHAIN_ID,
  POOL_FACTORY_CONTRACT_ADDRESS,
  ROUTER_CONTRACT_ADDRESS,
};