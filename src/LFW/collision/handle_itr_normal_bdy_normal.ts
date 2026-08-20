import type { Collision } from "../collision/Collision";
import { Defines, ItrEffect, SparkEnum, StateEnum, type TFace } from "../defines";
import { is_fighter } from "../entity";
import { calc_itr_velocity } from "./calc_itr_velocity";
import { handle_armor } from "./handle_armor";
import { handle_fall } from "./handle_fall";
import { handle_injury } from "./handle_injury";
import { handle_itr_effect_freeze } from "./handle_itr_kind_freeze";
import { handle_rest } from "./handle_rest";
import { handle_stiffness } from "./handle_stiffness";
import { is_fall } from "./is_fall";
export function handle_itr_normal_bdy_normal(collision: Collision) {
  const { itr, attacker, victim, a_cube, b_cube } = collision;
  if (itr.effect == ItrEffect.Ignore) return;
  if (handle_armor(collision)) return;
  switch (itr.effect) {
    case ItrEffect.Fire:
    case ItrEffect.MFire1:
    case ItrEffect.MFire2:
    case ItrEffect.FireExplosion: {
      handle_injury(collision);
      handle_rest(collision)
      handle_stiffness(collision)
      handle_fall(collision);
      break;
    }
    case ItrEffect.Ice2:
      handle_itr_effect_freeze(collision)
      break;
    case ItrEffect.Ice: {
      if (victim.state === StateEnum.Frozen) {
        handle_injury(collision);
        handle_stiffness(collision)
        handle_rest(collision)
        handle_fall(collision);
      } else {
        handle_itr_effect_freeze(collision)
      }
      break;
    }
    case ItrEffect.Explosion:
    case ItrEffect.Normal:
    case ItrEffect.Sharp:
    case void 0: {
      handle_injury(collision);
      handle_rest(collision)
      handle_stiffness(collision)
      victim.fall_value -= attacker.itr_fall(itr);
      victim.defend_value = 0;
      if (is_fall(collision)) {
        handle_fall(collision);
        return;
      }
      const [vx, vy, vz] = calc_itr_velocity(collision)
      victim.set_velocity(vx, vy, vz)
      const [x, y, z] = victim.spark_point(a_cube, b_cube)

      if (itr.effect === ItrEffect.Sharp && is_fighter(victim)) {
        victim.world.spark(x, y, z, SparkEnum.Bleed);
      } else if (is_fighter(victim)) {
        victim.world.spark(x, y, z, SparkEnum.Hit);
      } else {
        victim.world.spark(x, y, z, SparkEnum.SilentHit);
      }

      const ic = StateEnum.Caught === victim.state;
      const { backhurtact, fronthurtact } = victim.frame.cpoint || {};
      const { fall_value_max: fvm, fall_value: fv } = victim;
      const { dizzy, grand_injured, injured } = victim.data.indexes || {}
      const g = victim.position.y <= victim.ground_y
      const i = g ? grand_injured : injured;
      const r = fvm - fv;
      const d = Defines.DEFAULT_FALL_VALUE_DIZZY
      const sm = attacker.facing === victim.facing
      let id: string | string[] | undefined;
      if (ic) id = sm ? backhurtact : fronthurtact;
      else if (fv <= d) id = dizzy;
      else id = i?.[a(r)];
      if (id && id.length > 0) victim.enter_frame_by_id(id as string);
      break;
    }
  }
}


function a(r: number): TFace {
  const a = Math.floor(r / 50) % 2
  return a > 0 ? 1 : -1
}