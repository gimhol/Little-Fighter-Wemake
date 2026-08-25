import { AGK, Defines, E_E, GK, StateEnum, WeaponEnum, WT } from "../../defines";
import { BotStateEnum, BSE } from "../../defines/BotStateEnum";
import { is_fighter, is_weapon } from "../../entity";
import { abs, between, round } from '../../utils/math/base';
import { round_float } from '../../utils/math/round_float';
import { BotBehavior } from "../BotController";
import { BotState_Base } from "./BotState";

export class BotState_Chasing extends BotState_Base {
  readonly key = BSE.Chasing;
  override update(dt: number): BSE | undefined {
    if (this.me.hp <= 0) return BSE.Dead;
    const { s } = this;
    if (s.is_chapter_finish)
      return BSE.Idle;
    if (s.is_stage_finish)
      return BSE.StageEnd;
    const { ctrl: c } = this;
    const me = c.entity;
    const en = c.chasings.get()?.entity

    if (en && this.ctrl.is_leave_chase_range(en))
      return BSE.Following;
    if (this.ctrl.is_leave_goto_range(me))
      return BSE.Following;

    if (this.handle_bot_actions()) return;
    if (this.handle_defends('hd_c')) return;
    this.handle_block()

    if (!en) return BSE.Idle;

    const { facing: me_facing } = me
    const { x: my_x, z: my_z, y: my_y } = me.position;
    const { next_x: en_x, next_z: en_z, next_y: en_y } = c.guess_entity_pos(en);
    const { state } = me.frame;

    /** 
     * 敌人与自己的距离Z
     * 敌在上时为负
     * 敌在下时为正
     */
    const rz = round(en_z - my_z)

    /** 
     * 敌人与自己的距离X
     * 敌人在背后时为负数
     * 敌人在正面时为正数
     */
    const rx = round(me_facing * (en_x - my_x))

    /** 
     * 敌人与自己的距离y
     * 敌人在高时为正数
     * 敌人在低时为负数
     */
    const ry = round(en_y - my_y)

    /** 敌人与自己的距离X */
    const absx = round(abs(my_x - en_x))

    if (
      absx > Defines.AI_STAY_CHASING_RANGE &&
      (
        c.behavior === BotBehavior.Stay ||
        c.behavior === BotBehavior.Follow
      )
    ) {
      c.en_out_of_range = true;
      return BotStateEnum.Following;
    }


    /** 敌人与自己的距离Z */
    const abs_dz = round_float(abs(my_z - en_z))

    const x_ok = between(rx, c.atk_b_x, c.atk_f_x)
    const z_ok = between(rz, c.dataset.w_atk_min_z, c.dataset.w_atk_max_z)

    // 随机跳
    if ((!x_ok || !z_ok) && en.data.type == E_E.Fighter) this.random_jumping('rj_c');

    /** 持有武器的类型 */
    const wt = me.holding?.base_type;

    c.en_out_of_range = me.team !== c.world.stage.team && (
      en_x < c.world.stage.player_l - 80 ||
      en_x > c.world.stage.player_r + 80
    )

    const GK_F = me_facing > 0 ? GK.R : GK.L;
    const GK_B = me_facing > 0 ? GK.L : GK.R;
    switch (state) {
      case StateEnum.Running: return this.update_running();
      case StateEnum.Dash: return this.update_dash();
      case StateEnum.Jump: return this.update_jump();
      case StateEnum.Catching:
        // shit, louisEx air-push frame's state is StateEnum.Catching...
        if (me.catching) c.click(GK.a)
        break;
      case StateEnum.Standing:
      case StateEnum.Walking: {
        if (!c.en_out_of_range) {
          const r_desire = c.should_run('sr_c', en.position);
          if (!r_desire) break;
          if (r_desire > 0) c.db_hit(GK.R).end(GK.R).key_up(GK.L);
          else if (r_desire < 0) c.db_hit(GK.L).end(GK.L).key_up(GK.R);
          return;
        }

        if (wt && between(abs_dz, 0, 30)) {
          if (wt == WeaponEnum.Knife) {
            if (this.ctrl.desire('rtwd') < 400) {
              c.key_down(GK_F).click(GK.a)
              return;
            }
          }
        }
        break;
      }
      default:
        c.key_up(...AGK);
    }

    if (x_ok && z_ok) c.click(GK.a)
    this.hold_UD(rz, c.dataset.w_atk_min_z, c.dataset.w_atk_max_z)
    this.hold_LR(rx, c.w_atk_b_x, c.w_atk_f_x)
    const { team, player_l, player_r } = this.stage
    if (team === me.team) {
      if (my_x < player_l) c.click(GK.R)
      if (my_x > player_r) c.click(GK.L)
    }
  }

  update_dash(): BotStateEnum | undefined {
    const { me, en, c } = this;
    if (!en) return;

    const { x: my_x, z: my_z } = me.position;
    const { x: en_x, z: en_z } = en.position;
    const { facing: me_facing } = me
    const rx = round(me_facing * (en_x - my_x))
    const rz = round(en_z - my_z)
    const x_ok = rx >= c.d_atk_min_x && rx <= c.d_atk_max_x
    const z_ok = rz >= c.dataset.d_atk_min_z && rx <= c.dataset.d_atk_max_z

    if (x_ok && z_ok) {
      c.click(GK.a)
      return
    }
  }

  /**
   * 奔跑时的行为
   * 
   * 此函数的可能不会松开按键：上, 下
   */
  private update_running(): BSE | undefined {
    const { me, en, c } = this;
    if (!en) return;
    const wt = me.holding?.base_type;

    const { facing: me_facing } = me
    const { x: my_x, z: my_z } = me.position;
    const { x: en_x, z: en_z, y: en_y } = en.position;

    const GK_F = me_facing > 0 ? GK.R : GK.L;
    const GK_B = me_facing > 0 ? GK.L : GK.R;

    /* 奔跑中无特殊情况时，不需要按'前'，此处松开'前' */
    c.key_up(GK_F);

    /** 
     * 敌人与自己的距离Z
     * 敌在上时为负
     * 敌在下时为正
     */
    const rz = round(en_z - my_z)

    /** 
     * 敌人与自己的距离X
     * 敌在背时为负
     * 敌在前时为正
     */
    const rx = round(me_facing * (en_x - my_x))

    /** 目标已在攻击范围内 */
    const x_ok = between(rx, c.w_atk_b_x, c.w_atk_f_x);
    const z_ok = between(rz, c.dataset.r_atk_min_z, c.dataset.r_atk_max_z);

    if (x_ok && z_ok) {
      if (is_weapon(en)) {
        if (en.base_type == WT.Heavy) {
          c.click(GK_B);
        } else {
          c.click(GK.d, GK.a)
        }
      } else if (is_fighter(en)) {
        if (c.desire("chasing_1") < c.dataset.r_atk_desire)
          c.click(GK.a);
      } else {
        c.click(GK.a);
      }
      return;
    }

    this.hold_UD(rz, c.dataset.r_atk_min_z, c.dataset.r_atk_max_z);

    /* 
      避免跑过头停下
      概率刹车 
    */
    if (!x_ok) {
      if (
        my_x > en_x && me_facing > 0 ||
        my_x < en_x && me_facing < 0 ||
        c.desire("chasing_stop_running_1") < c.dataset.r_stop_desire
      ) {
        c.click(GK_B);
        return
      }
    }

    /* 概率丢武器 */
    if (wt) {
      const d = this.ctrl.desire('rtwd_1')
      const t_ok = (
        wt == WT.Knife && d < 400 ||
        wt == WT.Stick && d < 100 ||
        wt == WT.Drink && d < 50
      );
      if (t_ok) c.click(GK_F).click(GK.a)
      return
    }
  }

  update_jump(): BotStateEnum | undefined {
    const { me, en, c } = this;
    if (!en) return;
    const wt = me.holding?.base_type;

    const { facing: me_facing } = me
    const { x: my_x, z: my_z, y: my_y } = me.position;
    const { x: en_x, z: en_z, y: en_y } = en.position;


    /** 
     * 敌人与自己的距离Z
     * 敌在上时为负
     * 敌在下时为正
     */
    const rz = round(en_z - my_z)

    /** 
     * 敌人与自己的距离X
     * 敌人在背后时为负数
     * 敌人在正面时为正数
     */
    const rx = round(me_facing * (en_x - my_x))

    /** 
     * 敌人与自己的距离y
     * 敌人在高时为正数
     * 敌人在低时为负数
     */
    const ry = round(en_y - my_y)

    if (me.is_on_ground) { // 地面上，控制跳越方向
      this.hold_UD(rz, -30, 30)
      this.hold_LR(rx, -60, 60)
      return;
    }

    const GK_F = me_facing > 0 ? GK.R : GK.L;
    /* 
      概率丢武器
      这里暂时不考虑X距离
    */
    if (wt) {
      const d = this.ctrl.desire('jtw')
      const t_ok = (
        wt == WT.Knife && d < 400 ||
        wt == WT.Stick && d < 100 ||
        wt == WT.Drink && d < 50
      );
      if (t_ok) c.click(GK_F).click(GK.a)
    }

    const x_ok = between(rx, 0, c.j_atk_x)
    const z_ok = between(rz, c.dataset.j_atk_min_z, c.dataset.j_atk_max_z);
    const y_ok = between(ry, c.dataset.j_atk_min_y, c.dataset.j_atk_max_y);
    if (x_ok && z_ok && y_ok) {
      c.click(GK.a)
      return;
    }


    c.key_up(GK.R, GK.L, GK.U, GK.D)


  }
}

