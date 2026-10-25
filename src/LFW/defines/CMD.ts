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
  KILL_SOLDIERS = 'KILL_SOLDIERS',
  /** 杀死其他实体 */
  KILL_OTHERS = 'KILL_OTHERS',
  /** 创建或更新指定玩家的傀儡 */
  SET_PUPPET = 'SET_PUPPET',
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
  /** 生成实体 */
  SPAWN = "SPAWN",
  /** 移除指定实体（直接删除） */
  DESPAWN = "DESPAWN",
  /** 击杀指定实体（hp=0，触发死亡流程） */
  KILL = "KILL",

  POINTER_DOWN   /**/ = "POINTER_DOWN",
  POINTER_MOVE   /**/ = "POINTER_MOVE",
  POINTER_UP     /**/ = "POINTER_UP",
  POINTER_CANCEL /**/ = "POINTER_CANCEL",
  POINTER_LEAVE  /**/ = "POINTER_LEAVE",
  POINTER_ENTER  /**/ = "POINTER_ENTER",
  POINTER_CLICK  /**/ = "POINTER_CLICK",

  KEY_EVENT  /**/ = "KEY_EVENT",

  /** 列出所有命令 */
  HELP /**/ = "HELP",

  /** 列出某一类数据的 id */
  LIST /**/ = "LIST",
  /** 列出场上实体 */
  ENTITIES /**/ = "ENTITIES",
  /** 看 / 改单个实体（位置、帧、状态、各种属性） */
  ENTITY /**/ = "ENTITY",
  /** 当前世界概要 */
  INFO /**/ = "INFO",
  /** 数据集分层（背景 / 实体 / 世界） */
  DATASET /**/ = "DATASET",
  /** 列出 UI 层 / 节点树 */
  UI /**/ = "UI",

  /** 运行时切换 UI 语言 */
  SET_LANG /**/ = "SET_LANG"
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
  [CMD.KILL_SOLDIERS]: "KILL_SOLDIERS",
  [CMD.KILL_OTHERS]: "KILL_OTHERS",
  [CMD.SET_PUPPET]: "SET_PUPPET",
  [CMD.DEL_PUPPET]: "DEL_PUPPET",
  [CMD.SET_DIFFICULTY]: "SET_DIFFICULTY",
  [CMD.DIST_CAM]: "DIST_CAM",
  [CMD.LOCK_CAM]: "LOCK_CAM",
  [CMD.CHANGE_BG]: "CHANGE_BG",
  [CMD.CHANGE_STAGE]: "CHANGE_STAGE",
  [CMD.BGM]: "BGM",
  [CMD.PAUSE]: "PAUSE",
  [CMD.SPAWN]: "SPAWN",
  [CMD.DESPAWN]: "DESPAWN",
  [CMD.KILL]: "KILL",
  [CMD.POINTER_DOWN]: "POINTER_DOWN",
  [CMD.POINTER_MOVE]: "POINTER_MOVE",
  [CMD.POINTER_UP]: "POINTER_UP",
  [CMD.POINTER_CANCEL]: "POINTER_CANCEL",
  [CMD.POINTER_LEAVE]: "POINTER_LEAVE",
  [CMD.POINTER_ENTER]: "POINTER_ENTER",
  [CMD.POINTER_CLICK]: "POINTER_CLICK",
  [CMD.KEY_EVENT]: "KEY_DOWN",
  [CMD.HELP]: "HELP",
  [CMD.LIST]: "LIST",
  [CMD.ENTITIES]: "ENTITIES",
  [CMD.ENTITY]: "ENTITY",
  [CMD.INFO]: "INFO",
  [CMD.DATASET]: "DATASET",
  [CMD.UI]: "UI",
  [CMD.SET_LANG]: "SET_LANG"
}