
import { AGK, GK, SE } from "../../defines";
import { BSE } from "../../defines/BotStateEnum";
import { BotState_Base } from "./BotState";

/**
 * 关卡结束
 */
export class BotState_StageEnd extends BotState_Base {
  override key = BSE.StageEnd;
  override enter(): void {
    this.ctrl.key_up(...AGK);
  }
  override leave(): void {
    this.ctrl.key_up(...AGK);
  }
  override update(): BSE | undefined {
    if (this.me.hp <= 0) return BSE.Dead;
    if (this.me.state === SE.Lying) return BSE.Lying;
    const { c, me, stage } = this
    this.handle_block();

    /*
    章结束，什么都不用干
    */
    if (stage.is_chapter_finish)
      return;

    const stage_end = stage.is_stage_finish;
    const running = me.state == SE.Running

    /* 
    节未结束，可能已经进入下一节：先停跑，然后回 Idle 重新选目标。
    这里不能只看 Running：结束阶段是"走"着往右的，不跑也得能出去。
    */
    if (!stage_end) {
      if (running) c.key_down(me.facing > 0 ? GK.L : GK.R)
      return BSE.Idle;
    }

    /*
    目前全都是往右跑进入下一节
    */
    if (!running) {
      c.key_down(GK.R).key_up(...AGK);
    }
  }
}
