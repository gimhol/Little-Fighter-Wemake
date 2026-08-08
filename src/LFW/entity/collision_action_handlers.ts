import { Ditto } from "..";
import type { IActionHandler } from "../base/IActionHandler";
import type { Collision } from "../collision/Collision";
import { ActionType as AT } from "../defines/actions/ActionType";
import type { IAction_ABuff } from "../defines/actions/IAction_ABuff";
import type { IAction_VBuff } from "../defines/actions/IAction_VBuff";
import { HitFlag } from "../defines/HitFlag";
import { ensure, max, min, round } from "../utils";
import type { Entity } from "./Entity";
import { turn_face } from "./face_helper";
import { is_bot_ctrl } from "./type_check";

export const collision_action_handlers: IActionHandler = {
  [AT.A_SOUND]: (a, c) => c.attacker.play_sound(a.data.path, a.data.pos),
  [AT.A_NEXT_FRAME]: (a, c) => c.attacker.enter_frame(a.data),
  [AT.A_SET_PROP]: (a, c) => {
    const name = a.data?.name;
    if (!name) return;
    (c.attacker as any)[name] = a.data?.value;
  },

  [AT.V_SOUND]: (a, c) => c.victim.play_sound(a.data.path, a.data.pos),
  [AT.V_NEXT_FRAME]: (a, c) => c.victim.enter_frame(a.data),
  [AT.V_SET_PROP]: (a, c) => {
    const name = a.data?.name;
    if (!name) return;
    (c.victim as any)[name] = a.data?.value;
  },

  /*
  NOTE: 
    以下四项其实相当于 A_NEXT_FRAME V_NEXT_FRAME

    但由于需要仅在击中防御中的对象时才能触发，此处留空
    并在 handle_itr_normal_bdy_defend 特殊处理
      -Gim
  */
  [AT.A_BROKEN_DEFEND]: () => 0, // 特殊对待，此处留空
  [AT.A_DEFEND]: () => 0, // 特殊对待，此处留空
  [AT.V_BROKEN_DEFEND]: () => 0, // 特殊对待，此处留空
  [AT.V_DEFEND]: () => 0, // 特殊对待，此处留空

  [AT.A_REBOUND_VX]: (a, { attacker }) => {
    attacker.set_velocity_x(-attacker.velocity.x);
  },
  [AT.V_REBOUND_VX]: (a, { victim }) => {
    victim.set_velocity_x(-victim.velocity.x);
  },
  [AT.V_TURN_FACE]: (a, { victim }) => {
    victim.facing = turn_face(victim.facing);
  },
  [AT.V_TURN_TEAM]: (a, { victim, attacker }) => {
    victim.team = a.data?.team || attacker.team;
  },
  [AT.FUSION]: (a, c) => {
    const { data: { oid, act, time } } = a;
    const { attacker, victim } = c;
    const { lfw } = c.attacker;
    const data = lfw.datas.find(oid);
    if (!data) return;

    const a_v = is_bot_ctrl(attacker.ctrl) ? 0 : 1;
    const v_v = is_bot_ctrl(victim.ctrl) ? 0 : 1;
    let fighter_1: Entity;
    let fighter_2: Entity;
    if (a_v > v_v) {
      fighter_1 = attacker;
      fighter_2 = victim;
    } else if (a_v < v_v) {
      fighter_1 = victim;
      fighter_2 = attacker;
    } else if (lfw.mt.int() % 2) {
      fighter_1 = attacker;
      fighter_2 = victim;
    } else {
      fighter_1 = victim;
      fighter_2 = attacker;
    }
    const hp = fighter_1.hp + fighter_2.hp;
    const hp_r = max(hp, fighter_1.hp_r, fighter_2.hp_r);
    fighter_1.dismiss_data = fighter_1.data;
    fighter_1.transform(data);
    fighter_1.hp = min(hp, fighter_1.hp_max);
    fighter_1.hp_r = min(hp_r, fighter_1.hp_max);
    fighter_1.fuse_bys = ensure(fighter_1.fuse_bys, fighter_2);
    fighter_1.dismiss_time = time ?? null;
    fighter_1.mp = fighter_1.mp_max;
    fighter_2.invisible =
      fighter_2.motionless =
      fighter_2.invulnerable = 1000000;
    if (act) fighter_1.enter_frame(act);
  },
  [AT.BROADCAST]: (a, { lfw }) => {
    lfw.broadcast(a.data.msg);
  },
  [AT.VALUE_STEAL]: (a, c) => {
    const { data: d } = a;
    if (!d) return;
    const { real_injury, injury } = c;
    const { over_injury } = d;
    const itr_value = over_injury ? injury : real_injury;
    if (!itr_value) return;

    let t: Entity | undefined | null;
    const { attacker } = c;
    switch (a.data.target) {
      case 1: t = attacker.src_emitter; break;
      case 2: t = attacker.pre_emitter; break;
      case 3: t = attacker.bearer; break;
      case 0: default: t = attacker; break;
    }
    if (!t) return;

    if (!d.revive && t.hp <= 0) return;

    if (d.mp) t.mp = min(t.mp + d.mp, t.mp_max);
    if (d.itr_mp_ratio) t.mp = min(t.mp + round(itr_value * d.itr_mp_ratio), t.mp_max);

    if (d.hp_r) t.hp_r = min(t.hp_r + d.hp_r, t.hp_max);
    if (d.itr_hp_r_ratio) t.hp_r = min(t.hp_r + round(itr_value * d.itr_hp_r_ratio), t.hp_max);

    if (d.over_hp_r) {
      if (d.hp) t.hp = min(t.hp + d.hp, t.hp_r);
      if (d.itr_hp_r_ratio) t.hp = min(t.hp + round(itr_value * d.itr_hp_r_ratio), t.hp_r);
    } else {
      if (d.hp) t.hp = min(t.hp + d.hp, t.hp_max);
      if (d.itr_hp_ratio) t.hp = min(t.hp + round(itr_value * d.itr_hp_ratio), t.hp_max);
    }
    t.hp_r = max(t.hp_r, t.hp);
  },
  [AT.V_BUFF]: (a, c) => {
    apply_buff(a, c.attacker, c.victim, c);
  },
  [AT.A_BUFF]: (a, c) => {
    apply_buff(a, c.victim, c.attacker, c);
  },
  [AT.ERROR]: function (a, c) {
    Ditto.alert(a.data.msg)
  },
  [AT.NONE]: () => void 0
};

function apply_buff(
  action: IAction_VBuff | IAction_ABuff,
  attacker: Entity,
  victim: Entity,
  collision: Collision
) {
  const { data } = action;
  if (!data) return;
  const { hitflag = HitFlag.AllEnemy, duration = 0, buff = '' } = data;
  const { lfw, world } = collision;
  const ally_flag = attacker.is_ally(victim) ? HitFlag.Ally : HitFlag.Enemy;
  if (
    !(hitflag & victim.data.type) ||
    !(hitflag & ally_flag)
  ) return;
  const id = data.buff + '_' + victim.id;
  let buf = world.buffs.get(id);
  if (!buf) {
    buf = lfw.factory.create_buff(buff, lfw, id);
    if (!buf) return;
    world.buffs.set(id, buf);
    buf.set_attacker(attacker);
    buf.set_victims(victim);
    victim.buffs.set(buf.id, buf);
  }
  buf.lifetime = 0;
  buf.duration = duration;
  buf.level += 1;
}