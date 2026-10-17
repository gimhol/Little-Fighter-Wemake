import { CheatEnum, ItrKind, WeaponEnum } from "../defines";
import { E_Val } from "../defines/EntityVal";
import type { IValGetter, IValGetterGetter } from "../defines/IExpression";
import { Entity } from "../entity/Entity";
import { is_ball, is_fighter, is_weapon } from "../entity/type_check";
import { find } from "../utils/container_help";
import { clamp, round } from "../utils/math";
import { get_val_from_world } from "./get_val_from_world";

export const entity_val_getters: Record<E_Val, (e: Entity) => any> = {
  [E_Val.TrendX]: e => {
    if (e.velocity.x < 0) return -e.facing;
    if (e.velocity.x > 0) return e.facing;
    return 0;
  },
  [E_Val.PressFB]: e => e.ctrl.LR * e.facing,
  [E_Val.PressUD]: e => e.ctrl.UD,
  [E_Val.PressLR]: e => e.ctrl.LR,
  [E_Val.Holding_W_Type]: e => e.holding?.base_type ?? 0,
  [E_Val.HP_P]: e => clamp(round((100 * e.hp) / e.hp_max), 0, 100),
  [E_Val.LF2_NET_ON]: e => e.lfw.is_cheat(CheatEnum.LF2_NET) ? 1 : 0,
  [E_Val.HERO_FT_ON]: e => e.lfw.is_cheat(CheatEnum.HERO_FT) ? 1 : 0,
  [E_Val.GIM_INK_ON]: e => e.lfw.is_cheat(CheatEnum.GIM_INK) ? 1 : 0,
  [E_Val.HAS_TRANSFORM_DATA]: e => e.transforms?.length ? 1 : 0,
  [E_Val.Catching]: e => e.catching ? 1 : 0,
  [E_Val.CAUGHT]: e => e.catcher ? 1 : 0,
  [E_Val.RequireSuperPunch]: e => e.superpunchs.size,
  [E_Val.HitByCharacter]: e => find(e.collided_list, (c) => is_fighter(c.attacker)) ? 1 : 0,
  [E_Val.HitByWeapon]: e => find(e.collided_list, (c) => is_weapon(c.attacker)) ? 1 : 0,
  [E_Val.HitByBall]: e => find(e.collided_list, (c) => is_ball(c.attacker)) ? 1 : 0,
  [E_Val.HitByState]: e => e.collided_list.map((i) => i.aframe.state),
  [E_Val.HitByItrKind]: e => e.collided_list.map((i) => i.itr.kind),
  [E_Val.HitByItrEffect]: e => e.collided_list.map((i) => i.itr.effect),
  [E_Val.HitOnCharacter]: e => find(e.collision_list, (c) => is_fighter(c.victim)) ? 1 : 0,
  [E_Val.HitOnWeapon]: e => find(e.collision_list, (c) => is_weapon(c.victim)) ? 1 : 0,
  [E_Val.HitOnBall]: e => find(e.collision_list, (c) => is_ball(c.victim)) ? 1 : 0,
  [E_Val.HitOnState]: e => e.collision_list.map((i) => i.bframe.state),
  [E_Val.HitOnSth]: e => e.collision_list.length,
  [E_Val.HP]: e => e.hp,
  [E_Val.MP]: e => e.mp,
  [E_Val.VX]: e => e.velocity.x,
  [E_Val.VY]: e => e.velocity.y,
  [E_Val.VZ]: e => e.velocity.z,
  [E_Val.FrameState]: e => e.state,
  [E_Val.Shaking]: e => e.shaking,
  [E_Val.Holding]: e => e.holding ? 1 : 0,
  [E_Val.HoldingHeavy]: e => e.holding?.base_type == WeaponEnum.Heavy,
  [E_Val.HoldingOID]: e => e.holding?.data.id,
  [E_Val.HpRecoverable]: e => e.hp_r - e.hp,
  [E_Val.HitByMagicFlute]: e => {
    /* 
    FIXME: 
      虽然现在可能修复了随时能受身的情况，但仍有问题。

      该kind会赋予受击者获得的笛子buff，此buff会赋予一个上升的速度，
      受害者飞起后，由于“惯性”，会让itr与bdy离开，若离开时长足够buff消失。
      会导致受害者飞到顶上时可以按跳受身。

      见 handle_itr_kind_magic_flute
      见 Buff_MagicFlute
      见 Buff_MagicFlute2
    */
    for (const buf of e.buffs.values()) {
      if (buf.kind == ItrKind.MagicFlute)
        return 1;
      if (buf.kind == ItrKind.MagicFlute2)
        return 1;
    }
    return 0;
  },
  [E_Val.TransformListSize]: e => e.transforms?.length || 0,
  [E_Val.IsOnGround]: e => e.is_on_ground ? 1 : 0,
  [E_Val.TransformIndex]: e => e.transform_index,
  [E_Val.IsSurvialRankMode]: e => e.world.lfw.survival_rank_mode ? 1 : 0
}
export const entity_world_val_getters = new Map<string, undefined | IValGetter<Entity>>();

export const get_val_getter_from_entity: IValGetterGetter<Entity> = (word: string): IValGetter<Entity> | undefined => {
  const val_getter = entity_val_getters[word as E_Val]
  if (val_getter) return val_getter;

  if (entity_world_val_getters.has(word)) {
    return entity_world_val_getters.get(word)
  }
  const world_val_getter = get_val_from_world(word);
  if (!world_val_getter) {
    entity_world_val_getters.set(word, world_val_getter)
    return void 0
  }
  const fallback: IValGetter<Entity> = (e, ...arg) => world_val_getter(e.world, ...arg)
  entity_world_val_getters.set(word, fallback)
  return fallback;
};


