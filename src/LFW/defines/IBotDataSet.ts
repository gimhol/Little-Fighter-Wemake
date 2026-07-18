import { fields, int } from "../fields";
import { Defines } from "./defines";

export interface IBotDataSet {
  /** 走攻触发范围X(敌人正对) */
  w_atk_x?: number;

  /** 
   * 走攻触发最小范围X 
   * 当目标过近时，应拉开距离
   */
  w_atk_m_x?: number;

  /** 
   * 走攻触发最小范围X 
   * 当目标过近时，应拉开距离
   */
  w_atk_r_x?: number;

  /** 走攻触发范围Z */
  w_atk_min_z?: number;
  w_atk_max_z?: number;

  /** 跑攻欲望值 */
  r_atk_desire?: number;

  /** 跑攻触发范围X(敌人正对) */
  r_atk_x?: number;


  /** 跑攻触发范围Z */
  r_atk_min_z?: number;
  r_atk_max_z?: number;

  /** 冲跳攻触发范围X */
  d_atk_min_x?: number;
  d_atk_max_x?: number;

  /** 冲跳攻触发范围Z */
  d_atk_min_z?: number;
  d_atk_max_z?: number;

  /** 跳攻触发范围X(敌人正对) */
  j_atk_x?: number;

  /** 跳攻触发范围Z */
  j_atk_min_z?: number;
  j_atk_max_z?: number;

  /** 跳攻触发范围Y */
  j_atk_min_y?: number;
  j_atk_max_y?: number;
  j_atk_desire?: number;

  jump_desire?: number;
  dash_desire?: number;


  /** 最小欲望值：跑步 */
  r_desire_min?: number;

  /** 最大欲望值：跑步 */
  r_desire_max?: number;

  /** 最小起跑范围X */
  r_x_min?: number;

  /** 最大起跑范围X */
  r_x_max?: number;

  /** 欲望值：停止跑步 */
  r_stop_desire?: number;

  /**
   * 防御 基础欲值
   * - defend_desire = defend_desire_base + difficulty * defend_desire_step
   * @type {?number}
   */
  defend_desire_base?: number;

  /**
   * 防御 步进欲值
   * - defend_desire = defend_desire_base + difficulty * defend_desire_step
   *
   * @type {?number}
   */
  defend_desire_step?: number;

  avoid_in_x?: number;
  avoid_in_z?: number;
  /**  */
  avoid_out_x?: number;
  avoid_out_z?: number;

  /* 武器拾取前向范围（一般为正数） */
  pick_weapon_f_x?: number;
  /* 武器拾取后向范围（一般为负数） */
  pick_weapon_b_x?: number;

  pick_weapon_z?: number;
}

export class BotDataSet implements Required<IBotDataSet> {
  static Default: BotDataSet = new BotDataSet();
  /** 欲望值：停止跑步 */
  r_stop_desire = 10;
  defend_desire_base = 2000;
  defend_desire_step = 2000;


  /** 走攻触发范围X(敌人正对) */
  w_atk_x = 50;
  /** 走攻触发范围X(敌人背对) */
  w_atk_b_x = 40;
  /** 走攻盲区 */
  w_atk_m_x = -1;
  w_atk_r_x = -1;
  /** 走攻触发范围Z */
  w_atk_min_z = -15;
  w_atk_max_z = 15;
  /** 跑攻欲望值 */
  r_atk_desire = Defines.MAX_AI_DESIRE;
  /** 跳攻欲望值 */
  j_atk_desire = Defines.MAX_AI_DESIRE;
  /** 跑攻触发范围X(敌人正对) */
  r_atk_x = 100;
  /** 跑攻触发范围Z */
  r_atk_min_z = -15;
  r_atk_max_z = 15;
  /** 冲跳攻触发范围X(敌人正对) */
  d_atk_min_x = 0;
  d_atk_max_x = 100;
  /** 冲跳攻触发范围Z */
  d_atk_min_z = -60;
  d_atk_max_z = 60;
  /** 跳攻触发范围X(敌人正对) */
  j_atk_x = 180;
  /** 跳攻触发范围Z */
  j_atk_min_z = -60;
  j_atk_max_z = 60;
  /** 跳攻触发范围Y */
  j_atk_min_y = -260;
  j_atk_max_y = 260;
  /** 跳越欲望 */
  jump_desire = 50;

  /** 冲刺欲望 */
  dash_desire = 100;
  /** 最小欲望值：跑步 */
  r_desire_min = 0;
  /** 最大欲望值：跑步 */
  r_desire_max = 2000;
  /** 
   * 最小起跑范围X 
   * 距离敌人小于于等于此距离时，此时奔跑欲望值最小
   */
  r_x_min = 100;

  /** 
   * 最大起跑范围X 
   * 距离敌人大于等于此距离时，此时奔跑欲望值最大
   */
  r_x_max = 1200;

  avoid_in_x = 180;
  avoid_in_z = 100;
  avoid_out_x = 200;
  avoid_out_z = 200;

  pick_weapon_f_x: number = 25;
  pick_weapon_b_x: number = -25;
  pick_weapon_z: number = 25;
}

export const bot_dataset_fields = fields<IBotDataSet>({
  w_atk_x: int,
  w_atk_m_x: int,
  w_atk_r_x: int,
  w_atk_min_z: int,
  w_atk_max_z: int,
  r_atk_desire: int,
  j_atk_desire: int,
  r_atk_x: int,
  r_atk_min_z: int,
  r_atk_max_z: int,
  d_atk_min_x: int,
  d_atk_max_x: int,
  d_atk_min_z: int,
  d_atk_max_z: int,
  j_atk_x: int,
  j_atk_min_z: int,
  j_atk_max_z: int,
  j_atk_min_y: int,
  j_atk_max_y: int,
  jump_desire: int,
  dash_desire: int,
  r_desire_min: int,
  r_desire_max: int,
  r_x_min: int,
  r_x_max: int,
  r_stop_desire: int,
  defend_desire_base: int,
  defend_desire_step: int,
  avoid_in_x: int,
  avoid_in_z: int,
  avoid_out_x: int,
  avoid_out_z: int,
  pick_weapon_f_x: int,
  pick_weapon_b_x: int,
  pick_weapon_z: int,
})