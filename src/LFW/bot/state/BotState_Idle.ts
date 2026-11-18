import { AGK, Defines, GK, SE, WeaponEnum as WT } from "../../defines";
import { BSE } from "../../defines/BotStateEnum";
import { round } from '../../utils/math/base';
import { clamp } from '../../utils/math/clamp';
import { BotBehavior } from "../BotController";
import { BotState_Base } from "./BotState";

export class BotState_Idle extends BotState_Base {
  readonly key = BSE.Idle;
  override enter(): void {
    this.ctrl.key_up(...AGK);
    const { player_l, player_r, near, far } = this.stage;
    const midx = (player_l + player_r) * 0.5
    const midz = (near + far) * 0.5
    this.me.lfw.mt.mark = `bot_idle`
    this.ctrl.idle_min_x = round(this.me.lfw.mt.range(player_l, midx))
    this.ctrl.idle_max_x = round(this.me.lfw.mt.range(midx, player_r))
    this.ctrl.idle_min_z = round(this.me.lfw.mt.range(far, midz))
    this.ctrl.idle_max_z = round(this.me.lfw.mt.range(midz, near))

    const { goingto, behavior } = this.ctrl;
    if (behavior === BotBehavior.Stay && goingto) {
      this.ctrl.idle_min_x = round(goingto.x - Defines.AI_COME_RANGE_IN_X);
      this.ctrl.idle_max_x = round(goingto.x + Defines.AI_COME_RANGE_IN_X);
      this.ctrl.idle_min_z = round(goingto.z - Defines.AI_COME_RANGE_IN_Z);
      this.ctrl.idle_max_z = round(goingto.z + Defines.AI_COME_RANGE_IN_Z);
    }
  }
  override leave(): void {
    const { c, me } = this;
    if (me.state === SE.Drink) c.click(GK.d)
  }
  override update() {
    if (this.me.hp <= 0) return BSE.Dead;
    if (this.stage.is_stage_finish)
      return BSE.StageEnd;
    const { c, me } = this;
    if (c.is_leave_goto_range(me))
      return BSE.Following;
    if (this.handle_bot_actions('hba_i')) return;
    if (this.handle_defends('hd_i')) return;

    const { x: my_x, z: my_z } = me.position;
    // 空闲时远离边界
    c.walk_toward(
      clamp(my_x, c.idle_min_x, c.idle_max_x),
      clamp(my_z, c.idle_min_z, c.idle_max_z),
      1
    );

    const watching = c.watching;
    if (
      watching?.mounted &&
      me.state === SE.Standing &&
      my_x >= c.idle_min_x && my_x <= c.idle_max_x &&
      my_z >= c.idle_min_z && my_z <= c.idle_max_z
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


