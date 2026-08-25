import { AGK, Defines, GK, SE, WeaponEnum as WT } from "../../defines";
import { max, min, round } from '../../utils/math/base';
import { BSE } from "../../defines/BotStateEnum";
import { BotBehavior } from "../BotController";
import { BotState_Base } from "./BotState";

export class BotState_Idle extends BotState_Base {
  readonly key = BSE.Idle;
  min_x: number = Number.MIN_SAFE_INTEGER;
  max_x: number = Number.MAX_SAFE_INTEGER;
  min_z: number = Number.MIN_SAFE_INTEGER;
  max_z: number = Number.MAX_SAFE_INTEGER;
  override enter(): void {
    this.ctrl.key_up(...AGK);
    const { player_l, player_r, near, far } = this.stage;
    const midx = (player_l + player_r) * 0.5
    const midz = (near + far) * 0.5
    this.min_x = round(this.me.lfw.mt.range(player_l, midx))
    this.max_x = round(this.me.lfw.mt.range(midx, player_r))
    this.min_z = round(this.me.lfw.mt.range(far, midz))
    this.max_z = round(this.me.lfw.mt.range(midz, near))

    const { goingto, behavior } = this.ctrl;
    if (behavior === BotBehavior.Stay && goingto) {
      this.min_x = round(goingto.x - Defines.AI_COME_RANGE_IN_X);
      this.max_x = round(goingto.x + Defines.AI_COME_RANGE_IN_X);
      this.min_z = round(goingto.z - Defines.AI_COME_RANGE_IN_Z);
      this.max_z = round(goingto.z + Defines.AI_COME_RANGE_IN_Z);
    }
  }
  override leave(): void {
    const { c, me } = this;
    if (me.state === SE.Drink) c.click(GK.d)
  }
  override update(dt: number) {
    if (this.me.hp <= 0) return BSE.Dead;
    if (this.stage.is_stage_finish)
      return BSE.StageEnd;
    const { c, me } = this;
    if (c.is_leave_goto_range(me))
      return BSE.Following;
    if (this.handle_bot_actions()) return;
    if (this.handle_defends('hd_i')) return;

    const { x: my_x, z: my_z } = me.position;
    // 空闲时远离边界
    if (my_x < this.min_x) {
      c.key_down(GK.R).key_up(GK.L)
    } else if (my_x > this.max_x) {
      c.key_down(GK.L).key_up(GK.R)
    } else {
      c.key_up(GK.L, GK.R)
    }

    if (my_z < this.min_z) {
      c.key_down(GK.D).key_up(GK.U)
    } else if (my_z > this.max_z) {
      c.key_down(GK.U).key_up(GK.D)
    } else {
      c.key_up(GK.U, GK.D)
    }

    const watching = c.watching;
    if (
      watching?.mounted &&
      me.state === SE.Standing &&
      my_x >= this.min_x && my_x <= this.max_x &&
      my_z >= this.min_z && my_z <= this.max_z
    ) {
      const wx = watching.position.x;
      if (wx > my_x && me.facing < 0) c.click(GK.R);
      else if (wx < my_x && me.facing > 0) c.click(GK.L);
    }

    /* 概率停跑 */
    if (me.frame.state === SE.Running && c.desire('idle_stop_run') < 100) {
      c.click(me.facing > 0 ? GK.L : GK.R);
      return;
    }

    const { en, av } = this;
    const wt = me.holding?.base_type
    if (wt === WT.Drink) {
      if (av) return BSE.Avoiding;
      /* 喝 */
      if (
        me.state === SE.Running ||
        me.state === SE.Standing ||
        me.state === SE.Walking
      ) {
        c.click(GK.a);
      } else if (
        me.state !== SE.Drink &&
        me.state !== SE.Defend &&
        me.state !== SE.Rowing
      ) {
        c.click(GK.d);
      }
    }

    const closest = this.closest(en, av)
    if (av && av == closest) return BSE.Avoiding;
    if (en && en == closest) return BSE.Chasing;
  }

}


