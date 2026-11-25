import { AGK, GK, StateEnum } from "../../defines";
import { BSE } from "../../defines/BotStateEnum";
import { is_weapon } from "../../entity";
import { abs, between, round } from "../../utils/math/base";
import { BotState_Base } from "./BotState";

/**
 * X方向距离超过这个值时才会(按欲望值)跑过去
 *
 * 跑起来刹车会往前滑一段，近了再跑很容易冲过武器，所以最后这段只走
 */
const RUN_RANGE = 320;

/**
 * 捡地上的武器
 *
 * 目标一定是在地上的武器：`should_chase` 只把 `Weapon_OnGround` / `HeavyWeapon_OnGround`
 * 的武器放进追击列表，飞天、滚动中的武器根本不会成为目标。
 *
 * - 太远时按 `should_run` 的欲望值有概率跑过去；跑的时候对齐Z，前方有墙/悬崖就刹车
 * - 最后一段(RUN_RANGE内)只走过去，不跑：跑起来一帧8px，容易冲过武器再刹车，看着就是来回跑
 * - 走进拾取范围就按A，捡到后回 Idle，交给 Idle 重新选目标
 */
export class BotState_Picking extends BotState_Base {
  readonly key = BSE.Picking;

  override enter(): void {
    this.c.key_up(...AGK);
  }

  override update(): BSE | undefined {
    const { c, me } = this;
    if (me.hp <= 0) return BSE.Dead;
    if (me.state === StateEnum.Lying) return BSE.Lying;
    const { s } = this;
    if (s.is_chapter_finish) return BSE.Idle;
    if (s.is_stage_finish) return BSE.StageEnd;
    if (c.is_leave_goto_range(me)) return BSE.Following;

    const target = this.en;
    if (!target || !is_weapon(target)) return BSE.Idle;
    if (me.holding || target.bearer) return BSE.Idle;

    if (this.handle_bot_actions('hba_p')) return;
    if (this.handle_defends('hd_p')) return;

    const { x: mx, z: mz } = me.position;
    const { x: tx, z: tz } = target.position;
    const rx = round(me.facing * (tx - mx));
    const rz = round(tz - mz);
    const dir: -1 | 1 = tx >= mx ? 1 : -1;
    const far = abs(rx) > RUN_RANGE;

    switch (me.state) {
      case StateEnum.Running: {
        /* 跑不动了(比如前面有东西挡着) */
        const stuck = abs(me.position.x - me.prev_position.x) < 1;
        /* 跑反了、够近了、前面是墙/悬崖、跑不动：刹车，剩下的交给走的逻辑 */
        if (rx <= 0 || !far || stuck || !c.step_safe(dir, 0) || c.danger_ahead(dir, 0)) {
          c.key_up(...AGK).click(me.facing > 0 ? GK.L : GK.R);
          return;
        }
        /* 还远：继续跑，同时对齐Z */
        c.key_up(GK.L, GK.R);
        this.hold_UD(rz, c.dataset.w_atk_min_z, c.dataset.w_atk_max_z);
        return;
      }
      case StateEnum.Standing:
      case StateEnum.Walking:
        break;
      default:
        /* 跳/冲刺/出招/捡东西的动作：别打断，等它做完 */
        c.key_up(...AGK);
        return;
    }

    /* 还远：按欲望值决定要不要跑过去 */
    if (far) {
      const run_desire = c.should_run('sr_p', target.position);
      if (run_desire > 0) {
        c.db_hit(GK.R).end(GK.R).key_up(GK.L);
        return;
      }
      if (run_desire < 0) {
        c.db_hit(GK.L).end(GK.L).key_up(GK.R);
        return;
      }
    }

    const { pick_weapon_b_x: b_x, pick_weapon_f_x: f_x } = c.dataset;

    /* 已经在拾取范围内：站定按A */
    if (
      between(rx, b_x, f_x) &&
      between(rz, c.dataset.w_atk_min_z, c.dataset.w_atk_max_z)
    ) {
      c.key_up(...AGK).click(GK.a);
      return;
    }

    /* 只走不跑 */
    c.walk_toward(tx, tz);
  }
}
