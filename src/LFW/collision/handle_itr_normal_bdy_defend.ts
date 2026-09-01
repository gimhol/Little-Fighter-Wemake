import type { Collision } from "../collision/Collision";
import { Defines, ItrEffect, SparkEnum } from "../defines";
import { ActionType as AT } from "../defines/actions/ActionType";
import { collision_action_handlers } from "../entity/collision_action_handlers";
import { calc_itr_velocity } from "./calc_itr_velocity";
import { handle_injury } from "./handle_injury";
import { handle_itr_normal_bdy_normal } from "./handle_itr_normal_bdy_normal";
import { handle_rest } from "./handle_rest";
import { handle_stiffness } from "./handle_stiffness";

export function handle_itr_normal_bdy_defend(collision: Collision) {
  const { itr, attacker, victim, a_cube, b_cube, bdy } = collision;
  const { bdefend = Defines.DEFAULT_BREAK_DEFEND_VALUE } = itr;
  if (
    // 爆炸类型的伤害不论方向都可防御。
    // 默认仅允许抵御来自前方的伤害
    (ItrEffect.FireExplosion !== itr.effect &&
      ItrEffect.Explosion !== itr.effect &&
      attacker.facing === victim.facing) ||
    (bdefend >= Defines.DEFAULT_FORCE_BREAK_DEFEND_VALUE)) {
    handle_itr_normal_bdy_normal(collision);
    return;
  }

  victim.defend_value -= bdefend;
  handle_injury(collision, victim.defend_ratio);
  handle_rest(collision)
  handle_stiffness(collision)
  const [x, y, z] = victim.spark_point(a_cube, b_cube);
  const [vx] = calc_itr_velocity(collision);
  if (vx) victim.set_velocity(vx / 2);
  if (victim.defend_value <= 0) {
    // 破防
    victim.defend_value = 0;
    victim.world.spark(x, y, z, SparkEnum.BrokenDefend);
    itr.actions?.forEach((action) => {
      if (action.type === AT.A_DEFEND)
        collision_action_handlers[AT.A_NEXT_FRAME](action, collision);
      if (action.type === AT.V_DEFEND)
        collision_action_handlers[AT.V_NEXT_FRAME](action, collision);
    })
    bdy.actions?.forEach((action) => {
      if (action.type === AT.A_BROKEN_DEFEND)
        collision_action_handlers[AT.A_NEXT_FRAME](action, collision);
      if (action.type === AT.V_BROKEN_DEFEND)
        collision_action_handlers[AT.V_NEXT_FRAME](action, collision);
    })
  } else {
    victim.world.spark(x, y, z, SparkEnum.DefendHit);
    itr.actions?.forEach((action) => {
      if (action.type === AT.A_DEFEND)
        collision_action_handlers[AT.A_NEXT_FRAME](action, collision);
      if (action.type === AT.V_DEFEND)
        collision_action_handlers[AT.V_NEXT_FRAME](action, collision);
    })
    bdy.actions?.forEach((action) => {
      if (action.type === AT.A_DEFEND)
        collision_action_handlers[AT.A_NEXT_FRAME](action, collision);
      if (action.type === AT.V_DEFEND)
        collision_action_handlers[AT.V_NEXT_FRAME](action, collision);
    })
  }
}
