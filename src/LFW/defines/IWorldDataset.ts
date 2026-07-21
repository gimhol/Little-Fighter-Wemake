import { any, fields, flt, int } from "../fields";
import { make_schema } from "../utils/schema";
import { CheatEnum } from "./CheatType";
import { Difficulty } from "./Difficulty";
import type { ISchemaMeta } from "./ISchema";
import { SyncRenderEnum } from "./SyncRenderEnum";

export interface IWorldDataset {
  itr_fall: number;
  /** 被击中的对象晃动多少帧 */
  itr_shaking: number;

  /** 角色 击中敌人的对象停顿多少帧 */
  itr_motionless: number;
  /** 波 击中敌人的对象停顿多少帧 */
  ball_itr_motionless: number;

  itr_arest: number;

  /** frame.dvx缩放系数 */
  fvx_f: number;

  /** frame.dvy缩放系数 */
  fvy_f: number;

  /** frame.dvz缩放系数 */
  fvz_f: number;

  /** itr.dvx缩放系数 */
  ivy_f: number;

  /** itr.dvy缩放系数 */
  ivz_f: number;

  /** itr.dvz缩放系数 */
  ivx_f: number;

  /** 
   * 默认itr.dvy
   * 默认击飞速度
   * @link https://lf-empire.de/forum/showthread.php?tid=11204
   */
  ivy_d: number;
  ivx_d: number;

  /** 停抓后VY */
  cvy_d: number;

  /** 停抓后VX */
  cvx_d: number;

  /** X轴丢人初速度缩放系数 */
  tvx_f: number;

  /** Y轴丢人初速度缩放系数 */
  tvy_f: number;

  /** Z轴丢人初速度缩放系数 */
  tvz_f: number;

  /** 角色进入场地时的闪烁无敌时间 */
  begin_blink_time: number;

  /** 倒地起身后的闪烁无敌时间 */
  lying_blink_time: number;

  /** “非玩家角色”死亡时后的闪烁时间 */
  gone_blink_time: number;
  vrest_offset: number;
  min_vrest: number;
  arest_offset: number;
  min_arest: number;

  /**
   * “帧等待数”偏移值
   *
   * @note
   * “帧等待数”会在每次更新中减一
   * 每一帧会在“帧等待数”归零时，尝试进入下一帧。
   *
   * 有：“帧等待数” = “帧本身的帧等待数” + “帧等待数”偏移值
   *
   * @see {IFrameInfo.wait} 帧本身的“帧等待数”
   */
  wait_offset: number;

  cha_bc_spd: number;
  /** 
   * 角色倒地反弹判定速度X
   */
  cha_bc_tst_spd_x: number;
  /** 
   * 角色倒地反弹判定速度Y
   */
  cha_bc_tst_spd_y: number;
  hp_recoverability: number;

  /**
   * 暗血恢复周期
   * 每几帧回一次血
   */
  hp_r_ticks: number;

  /**
   * 暗血恢复量
   * 每次回血的回血量
   */
  hp_r_value: number;
  hp_healing_ticks: number;
  hp_healing_value: number;

  mp_r_ticks: number;
  mp_r_ratio: number;

  /**
   * 按键“双击”判定间隔，单位（帧数）
   *
   * 当同个按键在“双击判定间隔”之内按下两次，
   * 且中途未按下其对应冲突按键，视为“双击”。
   *
   */
  double_click_interval: number;

  /**
   * 按键“按下”/“双击”的判定持续帧，单位：帧数
   *
   * 当某按键被“按下”（不松开），接下来的数帧（数值key_hit_duration）内，均判定为“按下”。
   * 此时若存在对应的“按键‘按下’跳转动作”，且满足跳转条件，角色将会进入对应的“按键‘按下’跳转动作”。
   *
   * 当某双击后，接下来的数帧（数值key_hit_duration）内，均判定为“双击”。
   * 此时若存在对应的“按键‘双击’跳转动作”，且满足跳转条件，角色将会进入对应的“按键‘双击’跳转动作”。
   */
  key_hit_duration: number;
  friction_factor: number;
  /** 地面摩擦X 在地面的物体，每帧速度X将±=此值,向0靠近 */
  friction_x: number;
  /** 地面摩擦Z 在地面的物体，每帧速度Z将±=此值,向0靠近 */
  friction_z: number;

  land_friction_factor: number,
  /** 落地帧摩擦X，每帧速度X将±=此值,向0靠近 */
  land_friction_x: number;
  /** 落地帧摩擦Z，每帧速度Z将±=此值,向0靠近 */
  land_friction_z: number;

  screen_w: number;
  screen_h: number;
  /** 重力加速度 */
  gravity: number;
  /** 重力加速度（按着防御时） */
  gravity_d: number;
  weapon_throwing_gravity: number;


  /**
   * 0 = 无限制
   *
   * @type {SyncRenderEnum}
   */
  sync_render: number | SyncRenderEnum;

  /** 难度 */
  difficulty: Difficulty;

  /** 是否无限蓝 */
  infinity_mp: number;


  /** 恢复周期(每几帧回一次) */
  fall_r_ticks: number;

  /** 恢复值(每次回多少) */
  fall_r_value: number;

  /** 恢复周期(每几帧回一次) */
  defend_r_ticks: number;

  /** 恢复值(每次回多少) */
  defend_r_value: number;

  fall_value_max: number;

  /**
   * 角色抓人能抓多久
   *
   * @type {number}
   */
  catch_time_max: number;

  defend_value_max: number;

  /**
   * 防御生效时，仍扣除多少比例的血
   *
   * @type {number}
   */
  defend_ratio: number;

  mp_max: number;
  hp_max: number;
  resting_max: number;
  vrest_after_shaking: number;
  arest_after_motionless: number;
  invisible_blinking: number;
  jump_x_f: number;
  jump_z_f: number;
  jump_h_f: number;
  dash_x_f: number;
  dash_z_f: number;
  dash_h_f: number;
  bfall_x_f: number;
  bfall_h_f: number;

  /**
   * Description placeholder
   *
   * @type {number}
   */
  jump_height: number;

  /**
   * Description placeholder
   *
   * @type {number}
   */
  jump_distance: number;

  /**
   * Description placeholder
   *
   * @type {number}
   */
  jump_distancez: number;

  /**
   * 冲跳高度
   * @type {number}
   */
  dash_height: number;

  /**
   * 冲跳X轴速度
   * @type {number}
   */
  dash_distance: number;

  /**
   * 冲跳Z轴速度
   * @type {number}
   */
  dash_distancez: number;
  /** 默认受身速度Y @type {number} */
  rowing_height: number;
  /** 默认受身速度X @type {number} */
  rowing_distance: number;
  wvx_f: number;
  wvy_f: number;
  wvz_f: number;
  whirlwind_vy_max: number;
  whirlwind_acc_y: number;
  whirlwind_acc_x: number;
  whirlwind_acc_z: number;
  outline_enabled: number;
  entity_indicator: number;
  bg_indicator: number;
  UPS: number;
  playrate: number;
  atom_time: number;
  [CheatEnum.GIM_INK]: number;
  [CheatEnum.HERO_FT]: number;
  [CheatEnum.LF2_NET]: number;
}

export const world_dataset_fields = fields<IWorldDataset>({
  gravity: flt("重力"),
  gravity_d: flt("重力D"),
  jump_x_f: flt("跳跃速度系数X"),
  jump_h_f: flt("跳跃速度系数Y"),
  jump_z_f: flt("跳跃速度系数Z"),
  dash_x_f: flt("跑跳速度系数X"),
  dash_h_f: flt("跑跳速度系数Y"),
  dash_z_f: flt("跑跳速度系数Z"),
  bfall_x_f: flt("受身速度系数X"),
  bfall_h_f: flt("受身速度系数Y"),
  weapon_throwing_gravity: flt("投掷武器重力"),
  begin_blink_time: int("入场闪烁时长"),
  gone_blink_time: int("消失闪烁时长"),
  lying_blink_time: int("起身闪烁时长"),
  double_click_interval: int("双击判定时长"),
  key_hit_duration: int("按键判定时长"),
  itr_shaking: int("受伤摇晃时长"),
  itr_motionless: int("角色命中停顿时长"),
  ball_itr_motionless: int("波命中停顿时长"),
  hp_healing_ticks: int("治疗回血周期", "治疗效果下，每几帧回血一次"),
  hp_healing_value: int("治疗回血量", "治疗效果下，每次回血多少"),
  fvx_f: flt("frame.dvx缩放系数"),
  fvy_f: flt("frame.dvy缩放系数"),
  fvz_f: flt("frame.dvz缩放系数"),
  ivx_f: flt("itr.dvx缩放系数"),
  ivy_f: flt("itr.dvy缩放系数"),
  ivz_f: flt("itr.dvz缩放系数"),
  ivy_d: flt("itr.dvy默认值", "默认的攻击Y轴速度"),
  ivx_d: flt("itr.dvx默认值", "默认的攻击X轴速度"),
  cvx_d: flt("停抓vx", "抓人结束时，被抓者的速度X"),
  cvy_d: flt("停抓vy", "抓人结束时，被抓者的速度Y"),
  tvx_f: flt("丢人速度系数X"),
  tvy_f: flt("丢人速度系数Y"),
  tvz_f: flt("丢人速度系数Z"),
  wvx_f: flt("丢武器速度系数X"),
  wvy_f: flt("丢武器速度系数Y"),
  wvz_f: flt("丢武器速度系数Z"),
  vrest_offset: int,
  min_vrest: int,
  itr_arest: int,
  arest_offset: int,
  min_arest: int,
  wait_offset: int,
  cha_bc_spd: flt,
  cha_bc_tst_spd_x: flt,
  cha_bc_tst_spd_y: flt,
  hp_recoverability: flt("可回血比例", "可回血比例"),
  hp_r_ticks: int("回血周期", "每几帧回血一次"),
  hp_r_value: int("回血量", "每次回血多少"),
  mp_r_ticks: int("回蓝周期", "每几帧回蓝一次"),
  mp_r_ratio: int("回蓝速率系数"),
  friction_factor: flt("地速衰减系数", "在地面的物体，速度将每帧乘以此值"),
  friction_x: flt("地面摩擦X", "在地面的物体，每帧速度X将±=此值,向0靠近"),
  friction_z: flt("地面摩擦Z", "在地面的物体，每帧速度Z将±=此值,向0靠近"),
  land_friction_factor: flt("落地摩擦X", "在物体着地时，当前动作结束前，速度将每帧乘以此值"),
  land_friction_x: flt("落地摩擦X", "在物体着地时，当前动作结束前，每帧速度X将±=此值,向0靠近"),
  land_friction_z: flt("落地摩擦Z", "在物体着地时，当前动作结束前，每帧速度Z将±=此值,向0靠近"),
  screen_w: any,
  screen_h: any,
  sync_render: any,
  difficulty: flt,
  infinity_mp: int("无限MP", "无限MP, 1=无限, 0=有限(默认)", { min: 0, max: 1 }),
  fall_r_ticks: int("摔落值恢复周期", "每几帧恢复一次摔落值"),
  fall_r_value: int("摔落值恢复量", "每次恢复多少摔落值"),
  defend_r_ticks: int("防御值恢复周期", "每几帧恢复一次防御值"),
  defend_r_value: int("防御值恢复量", "每次恢复多少防御值"),
  fall_value_max: int("摔落值", "默认摔落值"),
  catch_time_max: flt,
  defend_value_max: flt,
  defend_ratio: flt,
  mp_max: flt,
  hp_max: flt,
  resting_max: flt,
  vrest_after_shaking: int("vrest是否在shaking后更新", "vrest是否在shaking后更新", { min: 0, max: 1 }),
  arest_after_motionless: int("arest是否在motionless后更新", "arest是否在motionless后更新", { min: 0, max: 1 }),
  invisible_blinking: int("隐身结束后的闪烁时长", "隐身结束后的闪烁时长", { min: 0, max: 9999 }),
  jump_height: flt('跳越速度Y'),
  jump_distance: flt('跳越速度X'),
  jump_distancez: flt('跳越速度Z'),
  dash_height: flt('冲跳速度Y'),
  dash_distance: flt('冲跳速度X'),
  dash_distancez: flt('冲跳速度Z'),
  rowing_height: flt('受身速度Y'),
  rowing_distance: flt('受身速度X'),
  whirlwind_vy_max: flt('旋风最大速度Y'),
  whirlwind_acc_y: flt('旋风加速度Y'),
  whirlwind_acc_x: flt('旋风加速度X'),
  whirlwind_acc_z: flt('旋风加速度Z'),
  itr_fall: int,
  outline_enabled: int({ min: 0, max: 1 }),
  entity_indicator: int,
  bg_indicator: int({ min: 0, max: 1 }),
  UPS: int({ min: 1, max: 120 }),
  playrate: flt({ min: 0.01, max: 1000 }),
  atom_time: flt,
  [CheatEnum.GIM_INK]: int({ min: 0, max: 1 }),
  [CheatEnum.HERO_FT]: int({ min: 0, max: 1 }),
  [CheatEnum.LF2_NET]: int({ min: 0, max: 1 }),
})


const params: ISchemaMeta<IWorldDataset> = {
  key: "IWorldDataset",
  type: "object",
  properties: {
    itr_fall: { type: 'number' },
    itr_shaking: { type: 'number' },
    itr_motionless: { type: 'number' },
    ball_itr_motionless: { type: 'number' },
    itr_arest: { type: 'number' },
    fvx_f: { type: 'number' },
    fvy_f: { type: 'number' },
    fvz_f: { type: 'number' },
    ivy_f: { type: 'number' },
    ivz_f: { type: 'number' },
    ivx_f: { type: 'number' },
    ivy_d: { type: 'number' },
    ivx_d: { type: 'number' },
    cvy_d: { type: 'number' },
    cvx_d: { type: 'number' },
    tvx_f: { type: 'number' },
    tvy_f: { type: 'number' },
    tvz_f: { type: 'number' },
    begin_blink_time: { type: 'number' },
    lying_blink_time: { type: 'number' },
    gone_blink_time: { type: 'number' },
    vrest_offset: { type: 'number' },
    min_vrest: { type: 'number' },
    arest_offset: { type: 'number' },
    min_arest: { type: 'number' },
    wait_offset: { type: 'number' },
    cha_bc_spd: { type: 'number' },
    cha_bc_tst_spd_x: { type: 'number' },
    cha_bc_tst_spd_y: { type: 'number' },
    hp_recoverability: { type: 'number' },
    hp_r_ticks: { type: 'number' },
    hp_r_value: { type: 'number' },
    hp_healing_ticks: { type: 'number' },
    hp_healing_value: { type: 'number' },
    mp_r_ticks: { type: 'number' },
    mp_r_ratio: { type: 'number' },
    double_click_interval: { type: 'number' },
    key_hit_duration: { type: 'number' },
    friction_factor: { type: 'number' },
    friction_x: { type: 'number' },
    friction_z: { type: 'number' },
    land_friction_factor: { type: 'number' },
    land_friction_x: { type: 'number' },
    land_friction_z: { type: 'number' },
    screen_w: { type: 'number' },
    screen_h: { type: 'number' },
    gravity: { type: 'number' },
    gravity_d: { type: 'number' },
    weapon_throwing_gravity: { type: 'number' },
    sync_render: { type: 'number' },
    difficulty: { type: 'number' },
    infinity_mp: { type: 'number' },
    fall_r_ticks: { type: 'number' },
    fall_r_value: { type: 'number' },
    defend_r_ticks: { type: 'number' },
    defend_r_value: { type: 'number' },
    fall_value_max: { type: 'number' },
    catch_time_max: { type: 'number' },
    defend_value_max: { type: 'number' },
    defend_ratio: { type: 'number' },
    mp_max: { type: 'number' },
    hp_max: { type: 'number' },
    resting_max: { type: 'number' },
    vrest_after_shaking: { type: 'number' },
    arest_after_motionless: { type: 'number' },
    invisible_blinking: { type: 'number' },
    jump_x_f: { type: 'number' },
    jump_z_f: { type: 'number' },
    jump_h_f: { type: 'number' },
    dash_x_f: { type: 'number' },
    dash_z_f: { type: 'number' },
    dash_h_f: { type: 'number' },
    bfall_x_f: { type: 'number' },
    bfall_h_f: { type: 'number' },
    jump_height: { type: 'number' },
    jump_distance: { type: 'number' },
    jump_distancez: { type: 'number' },
    dash_height: { type: 'number' },
    dash_distance: { type: 'number' },
    dash_distancez: { type: 'number' },
    rowing_height: { type: 'number' },
    rowing_distance: { type: 'number' },
    wvx_f: { type: 'number' },
    wvy_f: { type: 'number' },
    wvz_f: { type: 'number' },
    whirlwind_vy_max: { type: 'number' },
    whirlwind_acc_y: { type: 'number' },
    whirlwind_acc_x: { type: 'number' },
    whirlwind_acc_z: { type: 'number' },
    outline_enabled: { type: 'number' },
    entity_indicator: { type: 'number' },
    bg_indicator: { type: 'number' },
    UPS: { type: 'number' },
    playrate: { type: 'number' },
    atom_time: { type: 'number' },
    [CheatEnum.GIM_INK]: { type: 'number' },
    [CheatEnum.HERO_FT]: { type: 'number' },
    [CheatEnum.LF2_NET]: { type: 'number' },
  },
}
export const Schema_IWorldDataset = make_schema<IWorldDataset>(params);

for (const k in params.properties) {
  (params.properties as any)[k].nullable = true
}
export const Schema_IWorldDataset_Partial = make_schema<IWorldDataset>(params);