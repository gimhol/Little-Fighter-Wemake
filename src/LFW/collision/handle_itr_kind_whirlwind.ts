import { StateEnum, WT } from "../defines";
import { is_ball, is_weapon } from "../entity";
import { round } from "../utils/math/base";
import { normalize } from "../utils/math/normalize";
import type { Collision } from "./Collision";

export function handle_itr_kind_whirlwind(c: Collision) {
  const { attacker, victim, world } = c;
  if (is_ball(victim)) return;

  let { x: vx, y: vy, z: vz } = victim.velocity;
  const dz = round(attacker.position.z - victim.position.z);
  const dx = round(attacker.position.x - victim.position.x);
  const x_direction = normalize(dx);
  const z_direction = normalize(dz);
  const max_vy = attacker.dataset('whirlwind_vy_max');
  const atom_time = attacker.dataset('atom_time');
  const acc_y = attacker.dataset('whirlwind_acc_y') * atom_time;
  const acc_x = attacker.dataset('whirlwind_acc_x') * atom_time;
  const acc_z = attacker.dataset('whirlwind_acc_z') * atom_time;

  if (vy < max_vy) vy += acc_y;
  vx += x_direction * acc_x;
  vz += z_direction * acc_z;
  victim.set_velocity(vx, vy, vz);

  if (!is_weapon(victim)) return;
  if (!victim.bearer && victim.base_type !== WT.Heavy) {
    victim.team = attacker.team;
  }

  switch (victim.state) {
    case StateEnum.Weapon_OnHand:
    case StateEnum.HeavyWeapon_OnHand:
    case StateEnum.HeavyWeapon_InTheSky:
    case StateEnum.Weapon_InTheSky:
      break;
    default:
      victim.enter_frame_by_id(victim.data.indexes?.in_the_skys?.[0]);
      break;
  }

}
