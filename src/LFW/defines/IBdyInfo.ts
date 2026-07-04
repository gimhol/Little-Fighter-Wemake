import { BdyKind } from "./BdyKind";
import { ALL_HIT_FLAG, HIT_FLAG_DESC_MAP, HIT_FLAG_NAME_MAP, HitFlag } from "./HitFlag";
import type { IExpression } from "./IExpression";
import type { IQube } from "./IQube";
import type { IQubePair } from "./IQubePair";
import type { TAction } from "./actions/TAction";
import { any, fields, int, str } from "../fields";
import type { TNextFrame } from "./INextFrame";

export interface IBdyInfo extends Partial<IQube> {
  id?: string;
  name?: string;
  ref?: string;

  /**
   * 碰撞标记，决定能与哪些对象碰撞
   * [LFW]
   * @see {HitFlag}
   * @type {HitFlag}
   */
  hit_flag?: HitFlag | number;
  hit_flag_name?: string;

  /**
   * [LF2][LFW]
   * 
   * @see {BdyKind}
   * @type {number}
   */
  kind: number | BdyKind;

  kind_name?: string;


  /**
   * 产生collision时，执行的actions
   * [LFW]
   * @type {?TAction[]}
   * @memberof IBdyInfo
   */
  actions?: TAction[];

  test?: string;


  /**
   * 目前用途:
   *    firen存在code为123的itr, freeze存在code为123的bdy, 
   *    这个itr与bdy通过对方的code判断能否碰撞，再通过actions来实现合体。
   * [LFW]
   * @file LFW/dat_translator/fighters/make_fighter_data_freeze.ts
   * @file LFW/dat_translator/fighters/make_fighter_data_firen.ts
   * @type {(number)}
   * @memberof IBdyInfo
   */
  code?: number,

  /** @deprecated 改用ref */
  prefab_id?: string;

  on_hit_ground?: TNextFrame;
  
  /**
   * 代码生成，用于bdy碰撞盒显示
   * [LFW]
   * @type {?IQubePair}
   * @memberof IBdyInfo
   */
  __indicator_info?: IQubePair;
  __tester?: IExpression<any>;
}

export function bdy_info_new(): IBdyInfo {
  return {
    kind: BdyKind.Normal,
  };
}

export const bdy_info_fields = fields<IBdyInfo>({
  id: str("预制ID"),
  name: str("预制名"),
  kind: int("类型", {
    options: [
      { value: BdyKind.Normal, label: "Normal" },
      { value: BdyKind.Criminal, label: "Criminal" },
      { value: BdyKind.Defend, label: "Defend" },
      { value: BdyKind.Ignore, label: "Ignore" },
    ],
  }),
  kind_name: any,
  x: int("X"),
  y: int("Y"),
  w: int("W"),
  h: int("H"),
  z: int("Z"),
  l: int("L"),
  hit_flag: int("碰撞标记", {
    bitFlag: true,
    nullable: true,
    options: ALL_HIT_FLAG.map(v => ({
      value: v,
      label: HIT_FLAG_NAME_MAP[v],
      desc: HIT_FLAG_DESC_MAP[v],
    })),
  }),
  hit_flag_name: any,
  ref: str("预制信息ID"),
  prefab_id: any,
  actions: any,
  test: str("测试表达式"),
  code: str("Code"),
  on_hit_ground: any,

  __tester: any,
  __indicator_info: any,
})