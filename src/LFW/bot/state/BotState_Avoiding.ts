
import { AGK, Defines, GK, StateEnum } from "../../defines";
import { BSE } from "../../defines/BotStateEnum";
import { abs, clamp, round_float } from "../../utils/math";
import { BotState_Base } from "./BotState";

export class BotState_Avoiding extends BotState_Base {
  readonly key = BSE.Avoiding;
  override leave(): void {
    this.c.key_up(...AGK);
  }
  override update(dt: number): BSE | undefined {
    if (this.me.hp <= 0) return BSE.Dead;
    const { s } = this;
    if (s.is_chapter_finish)
      return BSE.Idle;
    if (s.is_stage_finish)
      return BSE.StageEnd;
    const { c, me } = this;
    if (c.is_leave_goto_range(me))
      return BSE.Following;
    const { en, av } = this
    if (this.handle_bot_actions()) return;
    if (this.handle_defends('hd_a')) return;

    if (!av) return BSE.Idle;

    const av_x = av.position.x;
    const av_z = av.position.z;
    const me_x = me.position.x;
    const me_z = me.position.z;

    if (c.is_leave_avoid_zone(av))
      return BSE.Idle;

    const { player_l, player_r, enemy_l, enemy_r, team } = s;
    const is_player = me.team !== team;
    const l = is_player ? player_l : enemy_l;
    const r = is_player ? player_r : enemy_r;

    const av_edge_l = l + 80;
    const av_edge_r = r - 80;
    const av_edge_b = c.world.near - 35;
    const av_edge_t = c.world.far + 35;

    const av_danger_l = l + 120;
    const av_danger_r = r - 120;
    const av_danger_b = c.world.near - 60;
    const av_danger_t = c.world.far + 60;

    let z_forwrd_key: GK;
    if (av_z > av_edge_b)  // enmey reach bottom edge
      z_forwrd_key = GK.U
    else if (av_z < av_edge_t)  // enmey reach top edge
      z_forwrd_key = GK.D
    else if (av_z === me_z)    // same? make offset
      z_forwrd_key = (av_z + av.facing) > me_z ? GK.U : GK.D
    else
      z_forwrd_key = av_z > me_z ? GK.U : GK.D

    let x_forwrd_key: GK;
    if (av_x > av_edge_r)       // enmey reach right edge
      x_forwrd_key = GK.L
    else if (av_x < av_edge_l)  // enmey reach left edge
      x_forwrd_key = GK.R
    else if (av_x === me_x) // same? make offset
      x_forwrd_key = (av_x + av.facing) > me_x ? GK.L : GK.R;
    else
      x_forwrd_key = av_x > me_x ? GK.L : GK.R;

    const in_danger_x = (av_x > av_danger_r && me_x > av_edge_r && av_x < me_x) !== (av_x < av_danger_l && me_x < av_edge_l && av_x > me_x)
    const in_danger_z = (av_z > av_danger_b && me_z > av_edge_b && av_z < me_z) !== (av_z < av_danger_t && me_x < av_edge_t && av_z > me_z)
    const me_in_danger = in_danger_x && in_danger_z;
    let is_jumping = me_in_danger ? this.wanted_jumping('wj_a') : this.random_jumping('rj_a')
    let jump_desire = 0;
    if (me.frame.state === StateEnum.Running && in_danger_x && !is_jumping) {
      // 停跑很容易被攻击，这里跳
      jump_desire = Defines.MAX_AI_DESIRE
      is_jumping = true
    }
    if (me.frame.state === StateEnum.Jump || is_jumping) {
      if (in_danger_z && me_z > av_edge_b) z_forwrd_key = GK.U;
      if (in_danger_z && me_z < av_edge_t) z_forwrd_key = GK.D;
    }

    const z_backward_key = z_forwrd_key == GK.D ? GK.U : GK.D
    const x_backward_key = x_forwrd_key == GK.L ? GK.R : GK.L;

    /* 威胁越近，跑的欲望越高 */
    const { avoid_out_x } = c.dataset;
    const { difficulty } = this // 1, 2, 3, 4
    const base_desire = 100 * difficulty; // [100, 200, 300, 400]
    const ext_desire = 700 * clamp(1 - abs(me_x - av_x) / avoid_out_x, 0, 1);
    const run_desire = round_float(base_desire + ext_desire);
    // : [300, 1000]

    if (c.desire('jump_avoiding') < jump_desire) {
      c.click(GK.j);
    }
    if (c.desire('run_avoiding') < run_desire) {
      c.dbl_click(x_forwrd_key)
    } else {
      c.key_down(x_forwrd_key)
    }
    c.key_up(x_backward_key)
    c.key_down(z_forwrd_key)
    c.key_up(z_backward_key)
  }
}