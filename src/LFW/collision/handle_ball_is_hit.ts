import type { Collision } from "../collision/Collision";
import { Defines, SparkEnum, StateEnum } from "../defines";
import { handle_rest } from "./handle_rest";
import { handle_stiffness } from "./handle_stiffness";


export function handle_ball_is_hit_a(collision: Collision): void {
  const { victim, attacker, itr, a_cube, b_cube, aframe } = collision;
  handle_rest(collision);
  handle_stiffness(collision);
  if (itr.bdefend && itr.bdefend >= Defines.DEFAULT_FORCE_BREAK_DEFEND_VALUE) {
    victim.hp = victim.hp_r = 0;
  }
  victim.set_velocity(0, 0, 0)
  switch (victim.state) {
    case StateEnum.Ball_Flying:
    case StateEnum.Ball_Rebounding:
      victim.team = attacker.team;
      break;
  }
  victim.world.spark(...victim.spark_point(a_cube, b_cube),
    itr.fall && itr.fall > Defines.DEFAULT_FALL_VALUE_CRITICAL ?
      SparkEnum.SilentCriticalHit :
      SparkEnum.SilentHit
  );
  victim.play_sound(victim.data.base.hit_sounds)
}

export function handle_ball_is_hit_b(collision: Collision): void {
  const { victim, itr, a_cube, b_cube } = collision;
  handle_rest(collision);
  handle_stiffness(collision);
  if (itr.bdefend && itr.bdefend >= Defines.DEFAULT_FORCE_BREAK_DEFEND_VALUE) {
    victim.hp = victim.hp_r = 0;
  }
  victim.set_velocity(0, 0, 0)
  victim.world.spark(...victim.spark_point(a_cube, b_cube),
    itr.fall && itr.fall > Defines.DEFAULT_FALL_VALUE_CRITICAL ?
      SparkEnum.SilentCriticalHit :
      SparkEnum.SilentHit
  );
  victim.play_sound(victim.data.base.hit_sounds)
}