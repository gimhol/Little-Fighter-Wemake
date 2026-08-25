import { AGK, BSE, GK, StateEnum } from "../../defines";
import { BotBehavior } from "../BotController";
import { BotState_Base } from "./BotState";


export class BotState_Following extends BotState_Base {
  readonly key = BSE.Following;
  override enter(): void {
    this.ctrl.key_up(...AGK);
  }
  override update(dt: number) {
    if (this.me.hp <= 0) return BSE.Dead;
    const { s } = this;
    if (s.is_chapter_finish)
      return BSE.Idle;
    if (s.is_stage_finish)
      return BSE.StageEnd;
    if (this.handle_defends('hd_f')) return;
    if (this.handle_block()) return;
    this.random_jumping('rj_f');

    const { ctrl: c } = this;
    const me = c.entity;

    const pos = c.following?.position ?? c.goingto;
    if (!pos) return BSE.Idle;

    const { x: my_x, z: my_z } = me.position;
    const { x: en_x, z: en_z } = pos;


    const should_run = me.frame.state == StateEnum.Walking && this.ctrl.should_run(pos)
    if (should_run) c.db_hit(should_run > 0 ? GK.R : GK.L)
    else if (my_x < en_x - 10) c.key_down(GK.R).key_up(GK.L);
    else if (my_x > en_x + 10) c.key_down(GK.L).key_up(GK.R);
    else c.key_up(GK.R, GK.L);

    if (my_z < en_z - 10) c.key_down(GK.D).key_up(GK.U);
    else if (my_z > en_z + 10) c.key_down(GK.U).key_up(GK.D);
    else c.key_up(GK.U, GK.D);

    if (!this.ctrl.is_enter_goto_range(me)) return;

    if (me.state == StateEnum.Running) { // 别跑了
      this.ctrl.key_down(me.facing < 0 ? GK.R : GK.L)
    }
    // TODO: 是不是该想个办法让持续位移招式（dennis d>j）停下来？
    return BSE.Idle;
  }
}
