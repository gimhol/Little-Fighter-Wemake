import { abs } from "./base";
import { round_float } from "./round_float";

export function float_equal(x: number, y: number): boolean {
  return round_float(abs(x - y)) == 0;
}
export function equal(x: number, y: number): boolean {
  return round_float(x - y) == 0;
}
export function eqgt(x: number, y: number): boolean {
  return round_float(x - y) >= 0;
}
export function eqlt(x: number, y: number): boolean {
  return round_float(x - y) <= 0;
}