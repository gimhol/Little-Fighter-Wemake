import { round } from "./base";

export function round_float(n: number, multiplier: number = 1000) {
  if (!n) return n;
  return round(n * multiplier) / multiplier;
}

