import { ALL_HIT_FLAG, HIT_FLAG_DESC_MAP, HIT_FLAG_NAME_MAP, HitFlag } from "./HitFlag";
import type { IExpression } from "./IExpression";
import type { TNextFrame } from "./INextFrame";
import type { IQube } from "./IQube";
import type { IQubePair } from "./IQubePair";
import { ItrEffect, ItrEffectDescriptions } from "./ItrEffect";
import { ItrKind, ItrKindDescriptions } from "./ItrKind";
import type { TAction } from "./actions/TAction";
import { any, fields, flt, int, str } from "../fields";

export interface IItrInfo extends Partial<IQube> {
  id?: string;
  name?: string;
  ref?: string;

  /**
   *
   * @type {HitFlag}
   */
  hit_flag?: HitFlag | number;
  hit_flag_name?: string;

  /**
   * 自身停顿值
   * - 命中后，自己停顿多少帧
   * - 不设置时存在默认值
   */
  motionless?: number;

  /**
   * 目标停顿值
   * - 命中后，目标停顿多少帧（伴随震动）
   * - 不设置时存在默认值
   */
  shaking?: number;

  /**
   * 本itr的效果类型
   * 详细效果见ItrKind
   * @see {ItrKind}
   */
  kind: number | ItrKind;

  /** just for reading */
  kind_name?: string;
  dvx?: number;
  dvy?: number;
  dvz?: number;
  fall?: number;
  vrest?: number;
  arest?: number;

  /**
   * 破防值
   *
   * “防御状态”下的“受击目标”，击中时，其“格挡值”将被减去“破防值”，
   * 若“格挡值”小于0，“受击目标”将进入“破防动作”。
   *
   * 若非“防御状态”下的“受攻目标”存在“强硬值”，击中时，其“强硬值”将被减去“破防值”，
   * 若“强硬值”小于0，“受攻目标”被击中。
   */
  bdefend?: number;

  /** 伤害值 */
  injury?: number;

  /**
   * @see {ItrEffect}
   */
  effect?: number | ItrEffect;

  /** just for reading */
  effect_name?: string;

  __indicator_info?: IQubePair;


  /**
   * 该itr抓到人时，攻击者进入的动作
   *
   * @type {?TNextFrame}
   * 
   * @see {ItrKind.Catch}
   * @see {ItrKind.ForceCatch}
   */
  catchingact?: TNextFrame;

  /**
   * 该itr抓到人时，被抓者进入的动作
   *
   * @type {?TNextFrame}
   * 
   * @see {ItrKind.Catch}
   * @see {ItrKind.ForceCatch}
   */
  caughtact?: TNextFrame;

  on_hit_ground?: TNextFrame;
  
  actions?: TAction[];

  /**
   * 测试表达式字符串
   */
  test?: string;

  code?: number,

  /**
   * 测试碰撞是否满足条件
   * 
   * 当tester运行结果为false时，碰撞将不生效
   * 
   * tester根据test字符串，在读取数据时生成。
   *
   * @type {?IExpression<any>}
   * @type {?IExpression<any>['run']}
   * @see {IItrInfo.test}
   */
  __tester?: IExpression<any>;
  
  /** @deprecated 改用ref */
  prefab_id?: string;
}

const ALL_ITR_KIND = Object.values(ItrKind).filter(v => typeof v === 'number') as number[];
const ALL_ITR_EFFECT = Object.values(ItrEffect).filter(v => typeof v === 'number') as number[];

export function itr_info_new(): IItrInfo {
  return {
    kind: ItrKind.Normal,
  };
}

export const itr_info_fields = fields<IItrInfo>({
  id: str("预制ID"),
  name: str("预制名"),
  kind: int("类型", {
    options: ALL_ITR_KIND.map(v => ({
      value: v,
      label: ItrKind[v],
      desc: (ItrKindDescriptions as Record<number, string>)[v] || "",
    })),
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
  motionless: int("自身停顿值"),
  shaking: int("目标停顿值"),
  dvx: flt("初速度X"),
  dvy: flt("初速度Y"),
  dvz: flt("初速度Z"),
  fall: int("Fall"),
  vrest: int("Vrest"),
  arest: int("Arest"),
  bdefend: int("破防值"),
  injury: int("伤害值"),
  effect: int("效果", {
    options: ALL_ITR_EFFECT.map(v => ({
      value: v,
      label: ItrEffect[v],
      desc: (ItrEffectDescriptions as Record<number, string>)[v] || "",
    })),
  }),
  effect_name: any,
  catchingact: any,
  caughtact: any,
  on_hit_ground: any,
  actions: any,
  test: str("测试表达式"),
  __tester: any,
  code: str("Code"),
  ref: str("预制信息ID"),
  __indicator_info: any,
  prefab_id: str("预制信息ID"),
})