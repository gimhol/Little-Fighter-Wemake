import { fields, obj } from "../fields";
import { next_frame_fields } from "./INextFrame";
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

export const hit_key_map_fields = fields<IHitKeyMap>({
  a: obj('攻击键', { nullable: true, array: 'auto', fields: next_frame_fields }),
  j: obj('跳跃键', { nullable: true, array: 'auto', fields: next_frame_fields }),
  d: obj('防御键', { nullable: true, array: 'auto', fields: next_frame_fields }),
  U: obj('上方向键', { nullable: true, array: 'auto', fields: next_frame_fields }),
  D: obj('下方向键', { nullable: true, array: 'auto', fields: next_frame_fields }),
  L: obj('左方向键', { nullable: true, array: 'auto', fields: next_frame_fields }),
  R: obj('右方向键', { nullable: true, array: 'auto', fields: next_frame_fields }),
  F: obj('正向键', { nullable: true, array: 'auto', fields: next_frame_fields }),
  B: obj('反向键', { nullable: true, array: 'auto', fields: next_frame_fields }),
  aa: obj('双击攻击键', { nullable: true, array: 'auto', fields: next_frame_fields }),
  jj: obj('双击跳跃键', { nullable: true, array: 'auto', fields: next_frame_fields }),
  dd: obj('双击防御键', { nullable: true, array: 'auto', fields: next_frame_fields }),
  FF: obj('双击正向键', { nullable: true, array: 'auto', fields: next_frame_fields }),
  BB: obj('双击反向键', { nullable: true, array: 'auto', fields: next_frame_fields }),
  UU: obj('双击上方向键', { nullable: true, array: 'auto', fields: next_frame_fields }),
  DD: obj('双击下方向键', { nullable: true, array: 'auto', fields: next_frame_fields }),
})