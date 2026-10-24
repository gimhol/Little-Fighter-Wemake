import { Entity } from "../entity";
import { abs, max, round_float } from "../utils";
/**
 * 获取两实体在XZ平面上的曼哈顿距离
 *
 * @export
 * @param {Entity} a 实体A
 * @param {Entity} b 实体B
 * @return {number} XZ平面上的曼哈顿距离
 */
export function manhattan_xz(a: Entity, b: Entity): number {
  return round_float(
    abs(a.position.x - b.position.x) +
    abs(a.position.z - b.position.z)
  )
}

export function box_gap_xz(a: Entity, b: Entity): number {
  const gap_x = max(0, max(a.aabb_min_x - b.aabb_max_x, b.aabb_min_x - a.aabb_max_x))
  const gap_z = max(0, max(a.aabb_min_z - b.aabb_max_z, b.aabb_min_z - a.aabb_max_z))
  return gap_x + gap_z
}
