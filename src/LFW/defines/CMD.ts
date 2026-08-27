import { CheatEnum } from "./CheatType";
/** 游戏指令枚举 */
export const enum CMD {
  /** 暂停/继续 */
  F1 = 'f1',
  /** 单步执行，未暂停时会暂停 */
  F2 = 'f2',
  /** 锁定功能键 */
  F3 = 'f3',
  /** 弹出当前 UI */
  F4 = 'f4',
  /** 切换加速模式 */
  F5 = 'f5',
  /** 无限 MP */
  F6 = 'f6',
  /** 全员 HP/MP 回满 */
  F7 = 'f7',
  /** 生成场景武器 */
  F8 = 'f8',
  /** 清除所有武器 */
  F9 = 'f9',
  /** 清除所有敌人 */
  F10 = 'f10',
  /** 作弊1 */
  LF2_NET = CheatEnum.LF2_NET,
  /** 作弊2 */
  HERO_FT = CheatEnum.HERO_FT,
  /** 作弊3 */
  GIM_INK = CheatEnum.GIM_INK,
  /** 杀死所有敌人 */
  KILL_ENEMIES = 'KILL_ENEMIES',
  /** 杀死 Boss */
  KILL_BOSS = 'KILL_BOSS',
  /** 杀死小兵 */
  KILL_SOLIDERS = 'KILL_SOLIDERS',
  /** 杀死其他实体 */
  KILL_OTHERS = 'KILL_OTHERS',
  /** 移除指定玩家的傀儡 */
  DEL_PUPPET = 'DEL_PUPPET',
  /** 设置难度 */
  SET_DIFFICULTY = "SET_DIFFICULTY",
  /** 设置摄像机位置 */
  DIST_CAM = "DIST_CAM",
  /** 锁定摄像机位置 */
  LOCK_CAM = "LOCK_CAM",
  /** 切换背景 */
  CHANGE_BG = "CHANGE_BG",
  /** 切换关卡 */
  CHANGE_STAGE = "CHANGE_STAGE",
  /** 播放 BGM（? 为随机下一首） */
  BGM = "bgm",
  /** 暂停 */
  PAUSE = "PAUSE",
}
export const CMD_NAMES: Record<CMD, string> = {
  [CMD.F1]: "F1",
  [CMD.F2]: "F2",
  [CMD.F3]: "F3",
  [CMD.F4]: "F4",
  [CMD.F5]: "F5",
  [CMD.F6]: "F6",
  [CMD.F7]: "F7",
  [CMD.F8]: "F8",
  [CMD.F9]: "F9",
  [CMD.F10]: "F10",
  [CMD.LF2_NET]: "LF2_NET",
  [CMD.HERO_FT]: "HERO_FT",
  [CMD.GIM_INK]: "GIM_INK",
  [CMD.KILL_ENEMIES]: "KILL_ENEMIES",
  [CMD.KILL_BOSS]: "KILL_BOSS",
  [CMD.KILL_SOLIDERS]: "KILL_SOLIDERS",
  [CMD.KILL_OTHERS]: "KILL_OTHERS",
  [CMD.DEL_PUPPET]: "DEL_PUPPET",
  [CMD.SET_DIFFICULTY]: "SET_DIFFICULTY",
  [CMD.DIST_CAM]: "DIST_CAM",
  [CMD.LOCK_CAM]: "LOCK_CAM",
  [CMD.CHANGE_BG]: "CHANGE_BG",
  [CMD.CHANGE_STAGE]: "CHANGE_STAGE",
  [CMD.BGM]: "BGM",
  [CMD.PAUSE]: "PAUSE"
}