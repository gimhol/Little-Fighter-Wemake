import { ALL_CHASE_LOST, CHASE_LOST_DESC_MAP, CHASE_LOST_LABEL_MAP, ChaseLost } from "./ChaseLost";
import { ALL_CHASE_STRATEGY, CHASE_STRATEGY_DESC_MAP, CHASE_STRATEGY_LABEL_MAP, ChaseStrategy } from "./ChaseStrategy";
import { ALL_HIT_FLAG, HIT_FLAG_DESC_MAP, HIT_FLAG_NAME_MAP, HitFlag } from "./HitFlag";
import { fields, int } from "../fields";

export interface IChaseInfo {
  /**
   * 切换跟踪对象的策略
   */
  stratedy?: number | ChaseStrategy;

  /**
   * 跟踪对象的标志
   */
  flag: number | HitFlag;

  /**
   * 跟踪对象丢失后的行为
   */
  lost: number | ChaseLost;

  oy?: number;
}

export function chase_info_new(): IChaseInfo {
  return {
    flag: 0,
    lost: 0
  };
}

export const chase_info_fields = fields<IChaseInfo>({
  stratedy: int("切换跟踪对象的策略", {
    options: ALL_CHASE_STRATEGY.map(v => ({
      value: v,
      label: CHASE_STRATEGY_LABEL_MAP[v],
      desc: CHASE_STRATEGY_DESC_MAP[v],
    })),
  }),
  flag: int("跟踪对象的标志", {
    bitFlag: true,
    nullable: true,
    options: ALL_HIT_FLAG.map(v => ({
      value: v,
      label: HIT_FLAG_NAME_MAP[v],
      desc: HIT_FLAG_DESC_MAP[v],
    })),
  }),
  lost: int("跟踪对象丢失后的行为", {
    options: ALL_CHASE_LOST.map(v => ({
      value: v,
      label: CHASE_LOST_LABEL_MAP[v],
      desc: CHASE_LOST_DESC_MAP[v],
    })),
  }),
  oy: int("Y 轴偏移"),
});
