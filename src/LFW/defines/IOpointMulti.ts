import type { OpointMultiEnum } from "./OpointMultiEnum";


export interface IOpointMulti {
  /** 生成数量的决定方式 */
  type: OpointMultiEnum | number;
  /**
   * 依据数量零时，将不生成（数量需参见决定方式）
   * @see {OpointMultiEnum.AccordingEnemies}
   *
   * - 当：
   *   - multi.type == OpointMultiEnum.AccordingEnemies。
   *   - multi.skip_zero == true
   *   - 场上无敌人
   * - 则：
   *   - 该Opoint将不会生成东西（即使设置了min/max）
   */
  skip_zero?: boolean;
  /** 至少产生多少个 */
  min?: number;
  /** 至多产生多少个 */
  max?: number;
}

export function opoint_multi_new(): IOpointMulti {
  return {
    type: 0
  }
}