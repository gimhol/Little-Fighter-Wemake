import { Defines, type IBotRay } from "../../defines";
import type { Entity } from "../../entity";
import { abs, between } from '../../utils/math/base';
import { round_float } from '../../utils/math/round_float';

export function is_ray_hit(a: Entity, b: Entity, ray: IBotRay) {
  const p0 = a.position;
  const p1 = b.position;

  const {
    x, z,
    min_x = 0, max_x = 10000,
    min_z = 0, max_z = 10000,
    max_d = Defines.DAFUALT_QUBE_LENGTH_POW2,
    reverse = false,
  } = ray

  const dx = round_float(p1.x - p0.x);
  const dz = round_float(p1.z - p0.z);

  if (!between(a.facing * dx, min_x, max_x))
    return reverse;
  if (!between(abs(dz), min_z, max_z))
    return reverse;

  const rx = x * a.facing;
  const rz = z;
  const d_sq = round_float(rx * rx + rz * rz);
  if (d_sq === 0) return reverse;

  const cross = rx * dz - rz * dx;
  const hit = round_float((cross * cross) / d_sq) < max_d;
  return reverse ? !hit : hit;
}
