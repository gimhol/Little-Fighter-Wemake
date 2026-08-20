import type { IOpointInfo } from "./IOpointInfo";
export type __KEEP__ = IOpointInfo

/**
 * 数量生成控制
 * 
 * @see {IOpointInfo.multi}
 */
export enum OpointMultiEnum {
  /** 
   * 根据敌人数量生成
   * @see {IOpointInfo.multi}
   */
  AccordingEnemies = 0,

  /**
   * 根据存活队友角色数量生成(不包含自己/与自己的发射者)
   * @see {IOpointInfo.multi}
   */
  AccordingAllies = 1,

  Emitter = 2,
}
export const OpointMultiEnumDescriptions: Record<OpointMultiEnum, string> = {
  [OpointMultiEnum.AccordingEnemies]: "",
  [OpointMultiEnum.AccordingAllies]: "",
  [OpointMultiEnum.Emitter]: "",
}
