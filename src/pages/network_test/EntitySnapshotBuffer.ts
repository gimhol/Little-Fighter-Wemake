import { NSlot, NUM_SLOTS, SSlot, STR_SLOTS } from "@/LFW/entity/EntitySnapshot";
import type { Entity } from "@/LFW";

/**
 * 实体平铺快照缓冲（rollback / lockstep 比对用）
 *
 * 内部数组复用，仅在实体数量增长时扩容。
 */
export class EntitySnapshotBuffer {
  nums: number[][] = [];
  strs: string[][] = [];
  count = 0;

  capture(entities: readonly Entity[]): void {
    const { nums, strs } = this;
    while (nums.length < entities.length) {
      nums.push(new Array<number>(NUM_SLOTS));
      strs.push(new Array<string>(STR_SLOTS));
    }
    for (let i = 0; i < entities.length; i++)
      entities[i].to_snapshot(nums[i], strs[i]);
    this.count = entities.length;
  }

  /**
   * 还原为可读对象数组（字段名 → 值），便于 lockstep 失败时对比。
   * NaN 还原为 null，空字符串还原为 null。
   */
  to_readable(): Record<string, number | string | null>[] {
    const out: Record<string, number | string | null>[] = [];
    for (let i = 0; i < this.count; i++) {
      const nums = this.nums[i];
      const strs = this.strs[i];
      const row: Record<string, number | string | null> = {};
      for (let j = 0; j < NUM_SLOTS; j++) {
        const v = nums[j];
        row[NSlot[j]] = Number.isNaN(v) ? null : v;
      }
      for (let j = 0; j < STR_SLOTS; j++)
        row[SSlot[j]] = strs[j] || null;
      out.push(row);
    }
    return out;
  }
}
