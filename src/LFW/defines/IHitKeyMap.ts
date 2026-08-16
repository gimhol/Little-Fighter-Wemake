import type { TNextFrame } from "./INextFrame";

export interface IHitKeyMap {
  /** 攻击键 */
  a?: TNextFrame;

  /** 跳跃键 */
  j?: TNextFrame;

  /** 防御键 */
  d?: TNextFrame;

  /** 上方向键 */
  U?: TNextFrame;

  /** 下方向键 */
  D?: TNextFrame;

  /** 左方向键 */
  L?: TNextFrame;

  /** 右方向键 */
  R?: TNextFrame;

  /** 正向键 */
  F?: TNextFrame;

  /** 反向键 */
  B?: TNextFrame;

  /** 双击跳跃键 */
  aa?: TNextFrame;

  /** 双击跳跃键 */
  jj?: TNextFrame;

  /** 双击防御键 */
  dd?: TNextFrame;

  /** 双击正向键 */
  FF?: TNextFrame;

  /** 双击反向键 */
  BB?: TNextFrame;

  /** 双击上方向键 */
  UU?: TNextFrame;

  /** 双击下方向键 */
  DD?: TNextFrame;
}
