import { env } from "../env/index.js";

export function getCurrency() {
  return localStorage.getItem("preferred-currency") || env.NORMALIZE_CURRENCY;
}