import type { Collision } from "./Collision";
import { StateEnum, type TFace } from "../defines";
import { ItrEffect as IE } from "../defines/ItrEffect";
import { is_fall } from "./is_fall";

export function calc_itr_velocity(collision: Collision): [number, number, number, TFace] {
  const { itr, attacker, victim } = collision;
  const { dvx = 0, dvy = attacker.dataset('ivy_d'), dvz = 0 } = itr;
  const diff_x = victim.position.x - attacker.position.x;
  const weight_x = victim.weight;
  const weight_y = victim.weight;
  const weight_z = victim.weight;

  const position_based = (
    itr.effect == IE.FireExplosion ||
    itr.effect == IE.Explosion ||
    attacker.state === StateEnum.HeavyWeapon_InTheSky
  );

  let x_direction: TFace = -1;
  if (!position_based) x_direction = attacker.facing;
  else if (diff_x > 0) x_direction = -1;
  else if (diff_x < 0) x_direction = 1;
  return [
    dvx * attacker.dataset('ivx_f') * x_direction / weight_x,
    (is_fall(collision) ? dvy * attacker.dataset('ivy_f') : 0) / weight_y,
    dvz * attacker.dataset('ivz_f') / weight_z,
    x_direction,
  ];
}
