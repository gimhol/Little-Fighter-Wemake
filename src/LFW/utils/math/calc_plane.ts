import { abs } from "./base";
export interface Result { a: number, b: number, c: number, d: number }
export const result: Result = { a: 0, b: 0, c: 0, d: 0 }
export function calc_plane(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  x3: number, y3: number, z3: number,
  eps = Number.EPSILON
): Readonly<Result> | null {
  const v1_x = x2 - x1
  const v1_y = y2 - y1
  const v1_z = z2 - z1
  const v2_x = x3 - x1
  const v2_y = y3 - y1
  const v2_z = z3 - z1
  const a = v1_y * v2_z - v1_z * v2_y;
  const b = v1_z * v2_x - v1_x * v2_z;
  const c = v1_x * v2_y - v1_y * v2_x;
  if (abs(a) < eps && abs(b) < eps && abs(c) < eps) {
    return null;
  }
  result.a = a
  result.b = b
  result.c = c
  result.d = -a * x1 - b * y1 - c * z1
  return result;
}