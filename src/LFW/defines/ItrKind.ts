export enum ItrKind {
  /**
   * 拳击
   * 可配合effect
   *
   * 用于：
   * * [X] LF2
   * * [X] WEMAKE
   */
  Normal = 0,

  /**
   * 抓起眩晕的角色
   *
   * 当角色1的itr与角色2的bdy碰撞，且角色2的frame.state为16(Tired)时
   * 角色1捉起角色2
   * 然后角色1进入抓人动作
   * 然后角色2进入被抓动作
   *
   * 用于：
   * * [X] LF2
   * * [X] WEMAKE
   *
   * @see {Defines.State.Tired}
   * @see {IItrInfo.catchingact} 角色1进入抓人动作
   * @see {IItrInfo.caughtact} 角色2进入被抓动作
   */
  Catch = 1,

  /**
   * 捡起武器，且进入捡武器的动作
   *
   * 当角色的itr与武器的bdy碰撞，
   * 且武器的frame.state为1004(Weapon_OnGround)或2004(HeavyWeapon_OnGround)时
   *
   * 捡起武器的动作实在preprocess中通过action实现，见preprocess_itr
   * 
   * 用于：
   * * [X] LF2
   * * [X] WEMAKE
   *
   * WEMAKE中，该碰撞判定通过IItrInfo.test设置。
   *
   * @see {IItrInfo.test}
   * @see {Defines.State.Weapon_OnGround}
   * @see {Defines.State.HeavyWeapon_OnGround}
   */
  Pick = 2,

  /**
   * 当角色1的itr与角色2的bdy碰撞
   * 角色1捉起角色2
   * 角色1进入抓人动作
   * 角色2进入被抓动作
   *
   * 强制抓人
   *
   * 用于：
   * * [X] LF2
   * * [X] WEMAKE
   *
   * @see {IItrInfo.catchingact} 角色1进入抓人动作
   * @see {IItrInfo.caughtact} 角色2进入被抓动作
   */
  ForceCatch = 3,

  /**
   * 被丢出时，此itr才生效
   *
   * 用于：
   * * [X] LF2
   * * [X] WEMAKE
   */
  CharacterThrew = 4,

  /**
   * 武器挥动
   *
   * 用于：
   * * [X] LF2
   * * [X] WEMAKE
   */
  WeaponSwing = 5,

  /**
   * 敌人按A使用重击
   *
   * 用于：
   * * [X] LF2
   * * [X] WEMAKE
   */
  SuperPunchMe = 6,

  /**
   * 立刻捡起武器
   *
   * 当角色的itr与武器的bdy碰撞，且武器的frame.state为1004(Weapon_OnGround)时
   *
   * 用于：
   * * [X] LF2
   * * [X] WEMAKE
   *
   * WEMAKE中，该碰撞判定通过IItrInfo.test设置。
   *
   * @see {IItrInfo.test}
   * @see {Defines.State.Weapon_OnGround}
   */
  PickSecretly = 7,

  /**
   * 
   * 用于：
   * * [X] LF2
   * * [X] WEMAKE
   * 
   * 治疗
   * 
   * - 原版：
   *    - injury数值变成治疗多少hp，动作跳至dvx ?
   *    - 可治疗队友
   * 
   * - WEMAKE：
   *    - injury数值变成治疗多少hp
   *    - 可治疗队友：通过hit_flag实现
   *    - 动作跳转：通过hit_act实现
   */
  Heal = 8,

  /**
   * 用于：
   * * [X] LF2
   * * [X] WEMAKE
   *
   * - 原版：
   *    - 打中敌人自己hp归0(如John的防护罩)
   *    - 反弹state3000与3002的ball
   */
  JohnShield = 9,

  /**
   *  henry d^j
   *
   *  用于：
   *  * [X] LF2
   *  * [X] WEMAKE
   */
  MagicFlute = 10,
  MagicFlute2 = 11,

  Block = 14, // 阻挡

  /**
   *  freeze d^j 飞起来的效果
   *
   *  用于：
   *  * [X] LF2
   *  * [X] WEMAKE
   *
   */
  Whirlwind = 15,

  Freeze = 16,
}
export const I_K = ItrKind
export type I_K = ItrKind
export const ItrKindDescriptions: Record<ItrKind, string> = {
  [ItrKind.Normal]: "普通（可配合effect）",
  [ItrKind.Catch]: "抓起眩晕的角色",
  [ItrKind.Pick]: "",
  [ItrKind.ForceCatch]: "",
  [ItrKind.CharacterThrew]: "",
  [ItrKind.WeaponSwing]: "",
  [ItrKind.SuperPunchMe]: "",
  [ItrKind.PickSecretly]: "",
  [ItrKind.Heal]: "",
  [ItrKind.JohnShield]: "",
  [ItrKind.MagicFlute]: "",
  [ItrKind.MagicFlute2]: "",
  [ItrKind.Block]: "",
  [ItrKind.Whirlwind]: "",
  [ItrKind.Freeze]: ""
}
export const itr_kind_name = (v: any) => ItrKind[v] ?? `unknown_${v}`;
export const itr_kind_full_name = (v: any) => `ItrKind.${itr_kind_name(v)}`

const descs: any = ItrKindDescriptions;
for (const key in descs) {
  descs[key] = descs[key] || itr_kind_full_name(key)
}

export const ATTCKING_ITR_KINDS: readonly ItrKind[] = [
  ItrKind.Normal,
  ItrKind.JohnShield,
  ItrKind.WeaponSwing
]