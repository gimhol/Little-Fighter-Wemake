export enum EntityVal {
  /**
   * X轴运动趋势
   * 当X轴速度为0时, 有trend_x==0, 
   * 速度与朝向一致时, 有trend_x==1, 
   * 速度与朝向不一致时, 有trend_x==-1, 
   */
  TrendX = "trend_x",

  /**
   * 按着前或后
   * 
   * 可用值:
   *    - 1: 按着“前”
   *    - 0: 同时（按|没按）着“前”和“后” 
   *    - -1: 按着“后”
   */
  PressFB = "press_F_B",

  PressUD = "press_U_D",

  PressLR = "press_L_R",

  /** 
   * 角色手持的武器类型 
   */
  Holding_W_Type = "holding_w_type",

  /** 剩余血量占比(0~100) */
  HP_P = "hp_p",

  /** 是否开启了作弊码 lf2.net, 1 = 是, 0 = 否 */
  LF2_NET_ON = "lf2_net_on",

  /** 是否开启了作弊码 herofighter.com, 1 = 是, 0 = 否 */
  HERO_FT_ON = "hero_ft_on",

  /** 是否开启了作弊码 gim.ink, 1 = 是, 0 = 否 */
  GIM_INK_ON = "gim_ink_on",

  HAS_TRANSFORM_DATA = "has_transform_data",

  /** 是否抓住某物, 1 = 是, 0 = 否 */
  Catching = "catching",

  /** 是否正在被抓, 1 = 是, 0 = 否 */
  CAUGHT = "caught",

  /** 角色是否应该使用重击 */
  RequireSuperPunch = "super_punch",

  HitByCharacter = "hit_by_character",
  HitByWeapon = "hit_by_weapon",
  HitByBall = "hit_by_ball",
  HitByState = "hit_by_state",

  HitByItrKind = "hit_by_itr_kind",
  HitByItrEffect = "hit_by_itr_effect",

  HitOnCharacter = "hit_on_character",
  HitOnWeapon = "hit_on_weapon",
  HitOnBall = "hit_on_ball",
  HitOnState = "hit_on_state",
  /** 击中物品的数量 */
  HitOnSth = "hit_on_something",
  HP = "hp",
  MP = "mp",
  VX = "vx",
  VY = "vy",
  VZ = "vz",
  FrameState = "frame_state",
  Shaking = "shaking",
  Holding = "holding",
  HoldingHeavy = "holdingHeavy",
  HoldingOID = "holdingOID",
  HpRecoverable = "hp_recoverable",
  HitByMagicFlute = 'hit_by_magic_flute',
  TransformListSize = 'transform_list_size',
  IsOnGround = 'is_on_ground',
  TransformIndex = 'transform_index',
}

export const EntityValDescriptions: Record<EntityVal, string> = {
  [EntityVal.TrendX]: "",
  [EntityVal.PressFB]: "",
  [EntityVal.PressUD]: "",
  [EntityVal.PressLR]: "",
  [EntityVal.Holding_W_Type]: "",
  [EntityVal.HP_P]: "",
  [EntityVal.LF2_NET_ON]: "",
  [EntityVal.HERO_FT_ON]: "",
  [EntityVal.GIM_INK_ON]: "",
  [EntityVal.HAS_TRANSFORM_DATA]: "",
  [EntityVal.Catching]: "",
  [EntityVal.CAUGHT]: "",
  [EntityVal.RequireSuperPunch]: "",
  [EntityVal.HitByCharacter]: "",
  [EntityVal.HitByWeapon]: "",
  [EntityVal.HitByBall]: "",
  [EntityVal.HitByState]: "",
  [EntityVal.HitByItrKind]: "",
  [EntityVal.HitByItrEffect]: "",
  [EntityVal.HitOnCharacter]: "",
  [EntityVal.HitOnWeapon]: "",
  [EntityVal.HitOnBall]: "",
  [EntityVal.HitOnState]: "",
  [EntityVal.HitOnSth]: "",
  [EntityVal.HP]: "",
  [EntityVal.MP]: "",
  [EntityVal.VX]: "",
  [EntityVal.VY]: "",
  [EntityVal.VZ]: "",
  [EntityVal.FrameState]: "",
  [EntityVal.Shaking]: "",
  [EntityVal.Holding]: "",
  [EntityVal.HoldingHeavy]: "",
  [EntityVal.HoldingOID]: "",
  [EntityVal.HpRecoverable]: "",
  [EntityVal.HitByMagicFlute]: "",
  [EntityVal.TransformListSize]: "",
  [EntityVal.IsOnGround]: "",
  [EntityVal.TransformIndex]: ""
}

export const E_Val = EntityVal
export type E_Val = EntityVal