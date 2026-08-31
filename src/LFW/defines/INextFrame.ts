import type { FacingFlag } from "./FacingFlag";
import type { IExpression } from "./IExpression";
import type { IVelocityInfo } from "./IVelocityInfo";
import { any, fields, fields_map_2_fields_obj, int, str } from "../fields";
import { velocity_info_fields } from "./IVelocityInfo";
export interface INextFrame extends IVelocityInfo {
  id?: string | string[];

  desc?: string;

  /**
   * 下一帧的持续时间策略
   *
   * - i:    this.wait = this.wait
   * - d:    this.wait = frame.wait - this.frame.wait + this.wait
   * - 正数: this.wait = nf.wait
   * @see {IFrameInfo.wait} 下一帧自带的wait
   * 
   * @type {?(string | number)}
   */
  wait?: string | number;

  /**
   * 下帧转向
   *
   * @type {?FacingFlag}
   */
  facing?: number | FacingFlag;

  /**
   * 判断表达式
   * 
   * 当不满足表达式时，将无法进入该帧
   * 
   * @type {string}
   */
  expression?: string;

  /**
   * 进入此帧消耗的蓝量
   * MP不足时，将
   *
   * @note 原版中，消耗mp放在frame后面，```mp: N```
   *       从一个frame进入另一个frame有两种方式，其消耗mp的判断也不一致，如下
   *          - 通过hit进入的
   *            - N>0 耗mp
   *            - N<0 补mp
   *          - 通过next进入此动作
   *            - N>0 不耗mp
   *            - N<0 耗mp
   *          - 另外有N>1000时, 会消耗hp， N:4300 = 40hp, 300mp
   *
   *       这与Wemake内部逻辑的八字不合。提取至INextFrame中可以方便我同时实现以上的需求
   *
   * @type {?number}
   */
  mp?: number;

  /**
   * - mp_mode == 1:
   *    - mp不足时，仍允许进入下一帧，mp归0
   * @type {?number}
   */
  mp_mode?: number;

  /**
   * 进入此帧消耗的血量
   *
   * 其他说明参见mp
   *
   * @see {mp}
   * @type {?number}
   */
  hp?: number;

  /**
   * 进入帧时，播放声音
   *
   * @type {?string[]}
   */
  sound?: string | string[];

  /**
   * 进入帧时，闪烁时长
   *
   * @type {?number}
   */
  blink_time?: number;

  reset_keys?: number;

  transfrom_to_another?: number;

  /**
   * 根据判断表达式 生成的表达式实例
   * @see {expression}
   * 
   * @type {IExpression<any>}
   */
  __judger?: IExpression<any>;
}
export function next_frame_new(): INextFrame {
  return {}
}
export type TNextFrame = INextFrame | INextFrame[];

/** INextFrame 字段定义（供编辑器 / 校验使用） */
export const next_frame_fields = fields<INextFrame>({
  id: str('帧ID', { nullable: true, array: 'auto' }),
  desc: str('描述', { nullable: true }),
  wait: any('等待策略', 'i: 保持本帧; d: 相对差值; 正数: 固定值', { nullable: true }),
  facing: int('转向', { nullable: true }),
  expression: str('判断表达式', '不满足时无法进入此帧', { nullable: true }),
  mp: int('耗MP', { nullable: true }),
  mp_mode: int('MP不足模式', 'mp_mode==1 时 MP 不足仍可进入，MP 归 0', { nullable: true }),
  hp: int('耗HP', { nullable: true }),
  sound: str('音效', { nullable: true, array: 'auto' }),
  blink_time: int('闪烁时长', { nullable: true }),
  reset_keys: int('重置按键', { nullable: true }),
  transfrom_to_another: int('变身目标', { nullable: true }),
  __judger: any,
  ...fields_map_2_fields_obj(velocity_info_fields),
});
