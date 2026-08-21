import { GK, StateEnum, WeaponEnum, type IFrameInfo } from "../defines";
import { TeamEnum } from "../defines/TeamEnum";
import type { Entity } from "../entity/Entity";
import { round_float } from "../utils/math/round_float";
import { CharacterState_Base } from "./CharacterState_Base";

export class CharacterState_Lying extends CharacterState_Base {
  constructor(state: StateEnum = StateEnum.Lying) {
    super(state)
  }
  override enter(e: Entity, prev_frame: IFrameInfo): void {
    e.lying_a_count = 0;
    e.lying_d_count = 0;
    e.lying_c_count = 0;
    e.ctrl.reset_key_list();
    const holding = e.holding
    if (holding) e.drop_holding();
    if (holding?.base_type === WeaponEnum.Heavy)
      holding.team = e.team;
    e.toughness = e.toughness_max;
    e.toughness_resting = 0;
    if (e.hp <= 0) this.on_dead(e)
  }

  override update(e: Entity): void {
    super.update(e);
    do {
      const count_c = e.lying_c_count;
      const count_a = e.lying_a_count;
      const pressing_a = !e.ctrl.is_end(GK.a)
      e.lying_a_count = count_a + 1;
      if (count_a && count_a % 2 && pressing_a && e.wait > 0) {
        e.lying_c_count = count_c + 1;
        e.wait = round_float(e.wait - e.world.dataset.atom_time);
        break;
      }
      const count_d = e.lying_d_count;
      const pressing_d = !e.ctrl.is_end(GK.d)
      e.lying_d_count = count_d + 1;
      if (count_d && count_d % 2 && pressing_d) {
        e.lying_c_count = count_c + 1;
        e.wait = round_float(e.wait + e.world.dataset.atom_time);
      }
    } while (0)
  }

  override leave(e: Entity, next_frame: IFrameInfo): void {
    if (e.dead_join && e.hp <= 0) {
      e.motionless = 30
      e.invulnerable = 30
      e.hp = e.hp_r = e.hp_max = (e.dead_join.hp ?? e.hp_max);
      e.team = (e.dead_join.team ?? TeamEnum.Team_1);
      e.lfw.world.etc(e.position.x, e.position.y, e.position.z, '6')
      e.outline_color = ''
      e.dead_join = null;
      e.wakeup_invuln = true;// 是否全部加入的都要这个？
    }
    if (e.wakeup_invuln) { // 关键角色起身的闪烁无敌时间
      // 提前或延迟起身都会降低无敌闪烁时间?
      // const count_c = e.lying_c_count;
      const count_c = 0;
      e.blinking = (e.world.dataset.lying_blink_time - count_c);
    }
  }
  override on_dead(e: Entity): void {
    const player_teams = new Set<string>()
    for (const [, f] of e.world.puppets) {
      player_teams.add(f.team)
    }
    if (e.reserve) --e.reserve;
    if (e.reserve && player_teams.has(e.team)) {
      // 玩家队伍的复活到玩家附近。
      e.blink_and_respawn(e.world.dataset.gone_blink_time);
    } else if (e.dead_join) {
      // 死亡后加入
    } else if (e.dead_gone) {
      // 非玩家槽的角色在被击败时，闪烁着离开了这个世界
      e.blink_and_gone(e.world.dataset.gone_blink_time);
    }
  }
  override find_frame_by_id(e: Entity, id: string | undefined): IFrameInfo | undefined {
    if (
      e.hp <= 0 &&
      e.position.y <= e.ground_y &&
      e.state === StateEnum.Lying &&
      !e.dead_join
    ) {
      return e.frame;
    }
  }
}
