import { abs } from "./base";
interface Vec3 { x: number, y: number, z: number }
const _result = { x: 0, y: 0, z: 0 }
export function line_plane_intersection(
  a: number, b: number, c: number, d: number,
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  is_direction = false,
  is_segment = false,
  eps = Number.EPSILON
): Readonly<Vec3> | null {
  let vx;
  let vy;
  let vz;
  if (is_direction) {
    vx = x2
    vy = y2
    vz = z2
  } else {
    vx = x2 - x1
    vy = y2 - y1
    vz = z2 - z1
  }

  const denom = a * vx + b * vy + c * vz;
  if (abs(denom) < eps) {
    // 直线在平面
    // if (abs(a * x1 + b * y1 + c * z1 + d) < eps) 
    //   return null;
    return null; // 无交点
  }
  const t = -(a * x1 + b * y1 + c * z1 + d) / denom;

  if (is_segment && (t < -eps || t > 1 + eps)) {
    // 交点不在线段内
    return null;
  }
  _result.x = x1 + t * vx;
  _result.y = y1 + t * vy;
  _result.z = z1 + t * vz;
  return _result
}