/**
 * Entity 平铺快照布局（rollback 用）
 *
 * 数字字段按 NSlot 索引写入定长 number[]，
 * 字符串/引用字段按 SSlot 索引写入定长 string[]。
 *
 * 约定：
 * - 可空数字：null 用 NaN 表示
 * - 可空字符串：null 用 '' 表示
 * - 三态布尔：-1 = null，0 = false，1 = true
 */
export enum NSlot {
  WAIT = 0,
  VARIANT,
  TRANSFORM_INDEX,
  LIFETIME,
  SPAWN_TIME,

  RESERVE,
  MOUNTED,
  GHOSTED,

  RESTING,
  RESTING_MAX,
  TOUGHNESS,
  TOUGHNESS_MAX,
  TOUGHNESS_R_VALUE,
  TOUGHNESS_RESTING,
  TOUGHNESS_RESTING_MAX,

  FALL_VALUE,
  FALL_VALUE_MAX,
  FALL_R_VALUE,
  DEFEND_VALUE,
  DEFEND_VALUE_MAX,
  DEFEND_R_VALUE,
  HEALING,
  DEFEND_RATIO,

  FALLINJURY,
  THROWINJURY,
  FACING,

  POS_X, POS_Y, POS_Z,
  PREV_POS_X, PREV_POS_Y, PREV_POS_Z,
  VEL_X, VEL_Y, VEL_Z,
  PREV_VEL_X, PREV_VEL_Y, PREV_VEL_Z,

  MP, MP_MAX,
  HP, HP_R, HP_MAX,

  AREST,
  MOTIONLESS,
  SHAKING,

  CATCH_TIME,
  CATCH_TIME_MAX,
  DISMISS_TIME,

  INVISIBLE_DURATION,
  INVULNERABLE_DURATION,
  BLINKING_DURATION,

  JUMP_X, JUMP_Y, JUMP_Z, JUMP_T,

  GROUND_Y,
  PREV_GROUND_Y,

  AABB_MIN_X, AABB_MAX_X, AABB_MIN_Z, AABB_MAX_Z,
  L_LEN, R_LEN,

  STAT_BAR_TYPE,

  // —— Times：每个占 5 个连续槽位（value, min, max, lifes, remains）——
  HP_R_TICK_VALUE, HP_R_TICK_MIN, HP_R_TICK_MAX, HP_R_TICK_LIFES, HP_R_TICK_REMAINS,
  MP_R_TICK_VALUE, MP_R_TICK_MIN, MP_R_TICK_MAX, MP_R_TICK_LIFES, MP_R_TICK_REMAINS,
  RESTING_TICK_VALUE, RESTING_TICK_MIN, RESTING_TICK_MAX, RESTING_TICK_LIFES, RESTING_TICK_REMAINS,
  TOUGHNESS_R_TICK_VALUE, TOUGHNESS_R_TICK_MIN, TOUGHNESS_R_TICK_MAX, TOUGHNESS_R_TICK_LIFES, TOUGHNESS_R_TICK_REMAINS,
  FALL_R_TICK_VALUE, FALL_R_TICK_MIN, FALL_R_TICK_MAX, FALL_R_TICK_LIFES, FALL_R_TICK_REMAINS,
  DEFEND_R_TICK_VALUE, DEFEND_R_TICK_MIN, DEFEND_R_TICK_MAX, DEFEND_R_TICK_LIFES, DEFEND_R_TICK_REMAINS,

  // —— 布尔 / 三态（-1 = null, 0 = false, 1 = true）——
  BOUNCED,
  LYING_A_COUNT,
  LYING_D_COUNT,
  LYING_C_COUNT,
  DROP_HURTED,
  IS_ON_GROUND,
  KEY_ROLE,
  NAME_VISIBLE,
  WAKEUP_INVULN,
  DEAD_GONE,
  CTRL_VISIBLE,

  COUNT,
}

export enum SSlot {
  ID = 0,
  DATA_ID,
  FRAME_ID,
  PREV_FRAME_ID,
  LANDING_FRAME_ID,
  CATCHING_ID,
  CATCHER_ID,
  BEARER_ID,
  HOLDING_ID,
  TEAM,
  NAME,
  AFTER_BLINK,
  DISMISS_DATA_ID,
  TRANSFORM_0_ID,
  TRANSFORM_1_ID,
  COUNT,
}

export const NUM_SLOTS = NSlot.COUNT;
export const STR_SLOTS = SSlot.COUNT;

/** 可空数字：NaN → null */
export const num_or_null = (v: number): number | null => (Number.isNaN(v) ? null : v);

/** 三态布尔编码 */
export const to_tri = (v: boolean | null | undefined): number => (v == null ? -1 : v ? 1 : 0);

/** 三态布尔解码 */
export const from_tri = (v: number): boolean | null => (v < 0 ? null : v !== 0);
