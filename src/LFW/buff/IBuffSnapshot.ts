import type { ITimesSnapshot } from "../utils/ITimesSnapshot";

/**
 * Buff 状态快照（rollback netcode 用）
 *
 * 记录 Buff 的可变运行状态：
 * - attacker_id：施放者实体 id
 * - level：等级
 * - mounted：是否已挂载到 world.buffs
 * - victims：受害者 id 列表
 * - ticker / lifetime：两个计时器
 */
export interface IBuffSnapshot {
  attacker_id: string;
  level: number;
  mounted: boolean;
  victims: string[];
  ticker: ITimesSnapshot;
  lifetime: ITimesSnapshot;
}
