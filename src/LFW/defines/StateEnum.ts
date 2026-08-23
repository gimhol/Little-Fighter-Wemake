export enum StateEnum {
  _Entity_Base = -1,
  _Character_Base = -2,
  _Weapon_Base = -3,
  _Ball_Base = -4,

  Standing = 0,
  Walking = 1,
  Running = 2,
  Attacking = 3,
  Jump = 4,
  Dash = 5,
  Rowing = 6,

  /**
   * [LF2 & WEMAKE]
   * 防御状态
   *
   * 此状态下：
   *    - 防御值不会恢复
   * 
   * WEMAKE中，要实现防御与破防，需要结合
   * bdy.kind = BdyKind.Defend
   * bdy.actions = [{ type: 'broken_defend', data: { id: "112" } }]
   * 
   *
   * @see {Entity.self_update}
   */
  Defend = 7,

  /**
   * [LF2 & WEMAKE]
   * 破防
   *
   * 此状态下：
   *    - 防御值不会恢复
   *
   * @see {Entity.self_update}
   */
  BrokenDefend = 8,

  Catching = 9,
  Caught = 10,
  Injured = 11,
  Falling = 12,
  /**
   * [LF2 & WEMAKE]
   * 冻结
   * 
   * 拥有特殊行为，见: State_Frozen
   */
  Frozen = 13,
  Lying = 14,

  Normal = 15,
  Tired = 16,

  /**
   * 消耗手中物品
   */
  Drink = 17,

  /**
   *
   */
  Burning = 18,

  /**
   * 原版中：此state，支持根据上下键与dvz控制角色Z轴移动，比如Firen的D>J。
   *
   * WEMAKE中，实现方式有所变动：
   *    改成上下键与speedz配合，控制角色Z轴移动速度。
   *    speedz可用于任意帧中。
   */
  BurnRun = 19,

  /**
   * 原版中:   此状态下，落地(position.y == 0)时进入94帧
   * 
   * WEMAKE中: 通过on_landing实现
   *           on_landing可用于任意帧中
   * @link https://www.lf-empire.de/lf2-empire/data-changing/reference-pages/182-states?start=21
   */
  LandGoto94 = 100,

  /**
   * 原版中：此state，用于支持根据上下键与dvz控制角色Z轴移动，比如Deep的D>J。
   *
   * WEMAKE中，实现方式有所变动：
   *    改成上下键与speedz配合，控制角色Z轴移动速度。
   *    speedz可用于任意帧中。
   */
  Z_Moveable = 301,

  TeleportToNearestEnemy = 400,
  TeleportToFarthestAlly = 401,

  Weapon_InTheSky = 1000,
  Weapon_OnHand = 1001,
  Weapon_Throwing = 1002,
  Weapon_Rebounding = 1003,
  Weapon_OnGround = 1004,

  HealSelf = 1700,

  HeavyWeapon_InTheSky = 2000,
  HeavyWeapon_OnHand = 2001,
  HeavyWeapon_JustOnGround = 2002,//= 重型武器在地上
  HeavyWeapon_OnGround = 2004,//= 与itr kind2作用

  /**
   * 能被反弹
   * 击中人会爆裂
   */
  Ball_Flying = 3000,
  /**
   * 能被反弹
   */
  Ball_Hitting = 3001,
  /**
   * 能被反弹
   * - LF2:
   *   - 发射时，按着上下键不可为其增加Z速度
   */
  Ball_Hit = 3002,
  /**
   * 能被反弹
   * - LF2:
   *   - 发射时，按着上下键不可为其增加Z速度
   */
  Ball_Rebounding = 3003,
  /**
   * 能被反弹
   * - LF2:
   *   - 发射时，按着上下键不可为其增加Z速度
   */
  Ball_Disappear = 3004,
  Ball_3005 = 3005,
  Ball_3006 = 3006,
  TransformTo_Min = 8001,
  TransformTo_Max = 8999,
  /**
   * 变成LouisEX
   */
  TurnIntoLouisEX = 9995,
  /**
   * 原LF2的Louis爆甲
   * 但现在Wemake中，爆甲是通过opoint实现的。
   */
  OLD_LouisCastOff = 9996,

  Message = 9997,

  Gone = 9998,

  Weapon_Brokens = 9999,

  /**
   * 被存在变过的人时，此才允许进入state为500的frame。
   * rudolf抓人变身后，才能dja，你懂的。
   *
   * 但现在Wemake中，改为has_transform_data判断。
   */
  TransformToCatching_Begin = 500,

  /**
   * 变成最后一次曾经变过的人（rudolf的变身效果）
   */
  TransformToCatching_End = 501,
}
export const StateEnumNames: Record<StateEnum, string> = {
  [StateEnum._Entity_Base]: "_Entity_Base",
  [StateEnum._Character_Base]: "_Character_Base",
  [StateEnum._Weapon_Base]: "_Weapon_Base",
  [StateEnum._Ball_Base]: "_Ball_Base",
  [StateEnum.Standing]: "Standing",
  [StateEnum.Walking]: "Walking",
  [StateEnum.Running]: "Running",
  [StateEnum.Attacking]: "Attacking",
  [StateEnum.Jump]: "Jump",
  [StateEnum.Dash]: "Dash",
  [StateEnum.Rowing]: "Rowing",
  [StateEnum.Defend]: "Defend",
  [StateEnum.BrokenDefend]: "BrokenDefend",
  [StateEnum.Catching]: "Catching",
  [StateEnum.Caught]: "Caught",
  [StateEnum.Injured]: "Injured",
  [StateEnum.Falling]: "Falling",
  [StateEnum.Frozen]: "Frozen",
  [StateEnum.Lying]: "Lying",
  [StateEnum.Normal]: "Normal",
  [StateEnum.Tired]: "Tired",
  [StateEnum.Drink]: "Drink",
  [StateEnum.Burning]: "Burning",
  [StateEnum.BurnRun]: "BurnRun",
  [StateEnum.LandGoto94]: "LandGoto94",
  [StateEnum.Z_Moveable]: "Z_Moveable",
  [StateEnum.TeleportToNearestEnemy]: "TeleportToNearestEnemy",
  [StateEnum.TeleportToFarthestAlly]: "TeleportToFarthestAlly",
  [StateEnum.Weapon_InTheSky]: "Weapon_InTheSky",
  [StateEnum.Weapon_OnHand]: "Weapon_OnHand",
  [StateEnum.Weapon_Throwing]: "Weapon_Throwing",
  [StateEnum.Weapon_Rebounding]: "Weapon_Rebounding",
  [StateEnum.Weapon_OnGround]: "Weapon_OnGround",
  [StateEnum.HealSelf]: "HealSelf",
  [StateEnum.HeavyWeapon_InTheSky]: "HeavyWeapon_InTheSky",
  [StateEnum.HeavyWeapon_OnHand]: "HeavyWeapon_OnHand",
  [StateEnum.HeavyWeapon_JustOnGround]: "HeavyWeapon_JustOnGround",
  [StateEnum.HeavyWeapon_OnGround]: "HeavyWeapon_OnGround",
  [StateEnum.Ball_Flying]: "Ball_Flying",
  [StateEnum.Ball_Hitting]: "Ball_Hitting",
  [StateEnum.Ball_Hit]: "Ball_Hit",
  [StateEnum.Ball_Rebounding]: "Ball_Rebounding",
  [StateEnum.Ball_Disappear]: "Ball_Disappear",
  [StateEnum.Ball_3005]: "Ball_3005",
  [StateEnum.Ball_3006]: "Ball_3006",
  [StateEnum.TransformTo_Min]: "TransformTo_Min",
  [StateEnum.TransformTo_Max]: "TransformTo_Max",
  [StateEnum.TurnIntoLouisEX]: "TurnIntoLouisEX",
  [StateEnum.OLD_LouisCastOff]: "OLD_LouisCastOff",
  [StateEnum.Message]: "Message",
  [StateEnum.Gone]: "Gone",
  [StateEnum.Weapon_Brokens]: "Weapon_Brokens",
  [StateEnum.TransformToCatching_Begin]: "TransformToCatching_Begin",
  [StateEnum.TransformToCatching_End]: "TransformToCatching_End",
}
export const StateEnumDescriptions: Record<StateEnum, string> = {
  [StateEnum._Entity_Base]: "所有实体的基类状态",
  [StateEnum._Character_Base]: "角色的基类状态",
  [StateEnum._Weapon_Base]: "武器的基类状态",
  [StateEnum._Ball_Base]: "弹丸/气功弹的基类状态",
  [StateEnum.Standing]: "角色站立不动",
  [StateEnum.Walking]: "角色慢速行走",
  [StateEnum.Running]: "角色快速奔跑",
  [StateEnum.Attacking]: "角色正在执行攻击动作",
  [StateEnum.Jump]: "角色跳跃中",
  [StateEnum.Dash]: "角色冲刺/闪避",
  [StateEnum.Rowing]: "划船状态(LF2特殊场景)",
  [StateEnum.Defend]: "防御状态，防御值不会恢复。需结合BdyKind.Defend和broken_defend动作实现",
  [StateEnum.BrokenDefend]: "破防状态，防御值不会恢复",
  [StateEnum.Catching]: "角色正在抓取敌人",
  [StateEnum.Caught]: "角色被敌人抓取",
  [StateEnum.Injured]: "角色受伤硬直",
  [StateEnum.Falling]: "角色从空中跌落",
  [StateEnum.Frozen]: "角色被冰冻",
  [StateEnum.Lying]: "角色倒地状态",
  [StateEnum.Normal]: "普通状态（如拾物后的常态）",
  [StateEnum.Tired]: "疲劳状态（MP耗尽）",
  [StateEnum.Drink]: "消耗手中物品（喝药）",
  [StateEnum.Burning]: "燃烧状态",
  [StateEnum.BurnRun]: "燃烧奔跑，支持上下键与speedz控制Z轴移动，如Firen的D>J",
  [StateEnum.LandGoto94]: "落地时跳转至94帧（WEMAKE中通过on_landing实现）",
  [StateEnum.Z_Moveable]: "Z轴可移动，支持上下键与speedz控制，如Deep的D>J",
  [StateEnum.TeleportToNearestEnemy]: "瞬移到最近的敌人身旁",
  [StateEnum.TeleportToFarthestAlly]: "瞬移到最远的队友身旁",
  [StateEnum.Weapon_InTheSky]: "轻武器在空中飞行",
  [StateEnum.Weapon_OnHand]: "轻武器被手持",
  [StateEnum.Weapon_Throwing]: "轻武器正在被投掷",
  [StateEnum.Weapon_Rebounding]: "轻武器正在反弹",
  [StateEnum.Weapon_OnGround]: "轻武器掉落在地面",
  [StateEnum.HealSelf]: "角色自愈状态",
  [StateEnum.HeavyWeapon_InTheSky]: "重武器在空中飞行",
  [StateEnum.HeavyWeapon_OnHand]: "重武器被手持",
  [StateEnum.HeavyWeapon_JustOnGround]: "重武器刚落到地面",
  [StateEnum.HeavyWeapon_OnGround]: "重武器在地面，可与itr kind2交互",
  [StateEnum.Ball_Flying]: "弹丸飞行中，能被反弹，击中人会爆裂",
  [StateEnum.Ball_Hitting]: "弹丸命中目标，能被反弹",
  [StateEnum.Ball_Hit]: "弹丸击中效果，能被反弹，发射时上下键不可加Z速度",
  [StateEnum.Ball_Rebounding]: "弹丸反弹中，能被反弹",
  [StateEnum.Ball_Disappear]: "弹丸消失中，能被反弹",
  [StateEnum.Ball_3005]: "弹丸3005类型",
  [StateEnum.Ball_3006]: "弹丸3006类型",
  [StateEnum.TransformTo_Min]: "变身状态范围下限(8001)",
  [StateEnum.TransformTo_Max]: "变身状态范围上限(8999)",
  [StateEnum.TurnIntoLouisEX]: "变身成为LouisEX",
  [StateEnum.OLD_LouisCastOff]: "原LF2中Louis爆甲（WEMAKE中改为opoint实现）",
  [StateEnum.Message]: "消息/系统提示状态",
  [StateEnum.Gone]: "实体已消失/移除",
  [StateEnum.Weapon_Brokens]: "武器破碎状态",
  [StateEnum.TransformToCatching_Begin]: "变身抓取开始（Rudolf抓人变身后允许进入500帧）",
  [StateEnum.TransformToCatching_End]: "变身抓取结束（变成最后变过的人，Rudolf的DJA）",
}
export const SE = StateEnum;
export type SE = StateEnum;
export const S_E = StateEnum;
export type S_E = StateEnum;
export const ATTCKING_STATES: readonly StateEnum[] = [
  StateEnum.Attacking,
  StateEnum.Ball_3005,
  StateEnum.Ball_3006,
  StateEnum.Ball_Flying,
  StateEnum.Ball_Hitting,
  StateEnum.Ball_Hit,
  StateEnum.BurnRun,
  StateEnum.Z_Moveable,
  StateEnum.HeavyWeapon_JustOnGround,
  StateEnum.Weapon_Throwing,
  StateEnum.Burning,
]
export const ALL_STATES = Object.keys(StateEnum).map(k => {
  const v = (StateEnum as any)[k]
  return typeof v === 'number' ? v as StateEnum : null
}).filter(v => v !== null && v != StateEnum.Gone)