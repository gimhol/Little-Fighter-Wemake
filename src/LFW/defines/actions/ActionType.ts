export enum ActionType {
  /** '攻方'发出声音 */
  A_SOUND = 'A_SOUND',
  /** 修改'攻方'下一帧 */
  A_NEXT_FRAME = 'A_NEXT_FRAME',
  A_SET_PROP = 'A_SET_PROP',
  /** 被'受方'防御时，修改'攻方'下一帧 */
  A_DEFEND = 'A_DEFEND',
  /** '受方'破防时，修改'攻方'下一帧 */
  A_BROKEN_DEFEND = 'A_BROKEN_DEFEND',

  /** '受方'发出声音 */
  V_SOUND = 'V_SOUND',
  /** 修改'受方'下一帧 */
  V_NEXT_FRAME = 'V_NEXT_FRAME',
  V_SET_PROP = 'V_SET_PROP',
  /** 被'受方'防御时，修改'受方'下一帧 */
  V_DEFEND = 'V_DEFEND',
  /** '受方'破防时，修改'受方'下一帧 */
  V_BROKEN_DEFEND = 'V_BROKEN_DEFEND',

  /** 反转'攻方'的X轴速度 */
  A_REBOUND_VX = 'A_REBOUND_VX',

  /** 反转'受方'的X轴速度 */
  V_REBOUND_VX = 'V_REBOUND_VX',

  /** '受方'转身 */
  V_TURN_FACE = 'V_TURN_FACE',

  /** '受方'加入'攻方'队伍 */
  V_TURN_TEAM = "V_TURN_TEAM",

  /** 合体 */
  FUSION = 'FUSION',

  /** 广播 */
  BROADCAST = 'BROADCAST',

  /** 吸血 */
  VALUE_STEAL = 'VALUE_STEAL',

  A_BUFF = "A_BUFF",

  V_BUFF = "V_BUFF",

  ERROR = "ERROR",

  NONE = "NONE",
}
export const ActionTypeDescriptions: Record<ActionType, string> = {
  [ActionType.A_SOUND]: "",
  [ActionType.A_NEXT_FRAME]: "",
  [ActionType.A_SET_PROP]: "",
  [ActionType.A_DEFEND]: "",
  [ActionType.A_BROKEN_DEFEND]: "",
  [ActionType.V_SOUND]: "",
  [ActionType.V_NEXT_FRAME]: "",
  [ActionType.V_SET_PROP]: "",
  [ActionType.V_DEFEND]: "",
  [ActionType.V_BROKEN_DEFEND]: "",
  [ActionType.A_REBOUND_VX]: "",
  [ActionType.V_REBOUND_VX]: "",
  [ActionType.V_TURN_FACE]: "",
  [ActionType.V_TURN_TEAM]: "",
  [ActionType.FUSION]: "",
  [ActionType.BROADCAST]: "",
  [ActionType.VALUE_STEAL]: "",
  [ActionType.A_BUFF]: "",
  [ActionType.V_BUFF]: "",
  [ActionType.ERROR]: "",
  [ActionType.NONE]: "什么都不做，可以用于actions判定的提前返回",
}
