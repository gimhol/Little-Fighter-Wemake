
export enum ChaseStrategy {
  /** 总是跟踪最近的目标 */
  Default = 0,
  /**
   * 在当前跟踪目标丢失前，不会更改跟踪目标
   */
  UntilLost = 1,
  /**
   * 丢失目标后不再跟踪
   */
  StopOnLost = 2,
}

export const ALL_CHASE_STRATEGY: ChaseStrategy[] = [
  ChaseStrategy.Default,
  ChaseStrategy.UntilLost,
  ChaseStrategy.StopOnLost,
];

export const CHASE_STRATEGY_LABEL_MAP: Record<ChaseStrategy, string> = {
  [ChaseStrategy.Default]: "Default",
  [ChaseStrategy.UntilLost]: "UntilLost",
  [ChaseStrategy.StopOnLost]: "StopOnLost",
};

export const CHASE_STRATEGY_DESC_MAP: Record<ChaseStrategy, string> = {
  [ChaseStrategy.Default]: "总是跟踪最近的目标",
  [ChaseStrategy.UntilLost]: "在当前跟踪目标丢失前，不会更改跟踪目标",
  [ChaseStrategy.StopOnLost]: "丢失目标后不再跟踪",
};
export const ChaseStrategyDescriptions: Record<ChaseStrategy, string> = {
  [ChaseStrategy.Default]: "",
  [ChaseStrategy.UntilLost]: "",
  [ChaseStrategy.StopOnLost]: "",
}
