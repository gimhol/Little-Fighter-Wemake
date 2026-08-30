import type { TNextFrame } from "./INextFrame";
import type { IQubePair } from "./IQubePair";
import { any, fields, int, str } from "../fields";

export interface ICpoint {
  kind?: number;
  x?: number;
  y?: number;
  z?: number;
  vaction?: TNextFrame;
  injury?: number;
  hurtable?: number;
  decrease?: number;
  throwvx?: number;
  throwvy?: number;
  throwvz?: number;
  /**
   * 被丢者的落地受伤量
   * -1: 抓人者变成被抓者
   * @type {number}
   * @memberof ICpoint
   */
  throwinjury?: number;
  fronthurtact?: string;
  backhurtact?: string;
  /**  */
  shaking?: number;
  motionless?: number;

  /*dircontrol*/
  __indicator_info?: IQubePair;
}

export function cpoint_new(): ICpoint {
  return {
    kind: 1,
  };
}

export const cpoint_info_fields = fields<ICpoint>({
  kind: int("类型", {
    options: [
      { value: 1, label: "Kind 1" },
      { value: 2, label: "Kind 2" },
    ],
  }),
  x: int("X"),
  y: int("Y"),
  z: int("Z"),
  vaction: any,
  injury: int("伤害值"),
  hurtable: int("可受伤", {
    options: [
      { value: 0, label: "否" },
      { value: 1, label: "是" },
    ],
  }),
  decrease: int("递减值"),
  throwvx: int("投掷初速度X"),
  throwvy: int("投掷初速度Y"),
  throwvz: int("投掷初速度Z"),
  throwinjury: int("投掷落地受伤量"),
  fronthurtact: str("正面受伤动作"),
  backhurtact: str("背面受伤动作"),
  shaking: int("目标停顿值"),
  motionless: int(),
  __indicator_info: any,
})
