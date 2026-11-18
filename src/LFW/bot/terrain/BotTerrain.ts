import type { ITerrainInfo } from "../../defines";
import { terrain_top, type ITerrainSolid } from "../../terrain/TerrainSolid";
import { TerrainWorld } from "../../terrain/TerrainWorld";
import type { World } from "../../World";

/** 一个 XZ 位置的落脚探测结果 */
export interface IBotStepProbe {
  x: number;
  z: number;
  /** 探测时参照的实体高度 */
  y: number;
  /** 该 XZ 位置、以 y 为参照时的地形段 */
  seg: Readonly<ITerrainInfo>;
  /** 地形顶面高度 */
  top: number;
  /** top - y：正数=要往上，负数=要往下 */
  dy: number;
  /** 悬崖：走进去会坠崖 */
  cliff: boolean;
  /** 被实心地形挡住（上不去） */
  blocked: boolean;
}

/** 新建一个探测结果对象 */
export function step_probe_new(): IBotStepProbe {
  return {
    x: 0,
    z: 0,
    y: 0,
    seg: TerrainWorld.horizon,
    top: 0,
    dy: 0,
    cliff: false,
    blocked: false,
  };
}

/**
 * Bot 用的地形探针。
 *
 * 只读、无状态；能不能走、能不能站，全部复用 `TerrainWorld` 的规则，
 * 不另写一套高度比较，免得 Bot 的判断和实体实际行为对不上。
 */
export class BotTerrain {
  /** `column` 的复用数组 */
  private readonly _column: ITerrainSolid[] = [];
  private readonly _step_cur = step_probe_new();
  private readonly _step_near = step_probe_new();
  private readonly _step_far = step_probe_new();

  /**
   * @param _source 世界（会随背景切换自动跟随其地形），或直接给一块地形
   */
  constructor(private readonly _source: World | TerrainWorld) { }

  /** 当前地形 */
  get terrain(): TerrainWorld {
    const source = this._source;
    return source instanceof TerrainWorld ? source : source.terrain;
  }

  /** 允许直接跨过的高度差 */
  get step(): number {
    return this.terrain.step;
  }

  /**
   * 探一个点：以 y 为参照，落点有没有被挡住、是不是悬崖、高度差多少。
   *
   * `prev_y` 与 `World.restrict` 一致（= y），否则单向/穿透平台的判定会不一样。
   *
   * @param {number} x X坐标
   * @param {number} z Z坐标
   * @param {number} y 参照高度（一般为实体脚底）
   * @param {IBotStepProbe} [out] 复用的输出对象
   * @returns {IBotStepProbe} 探测结果
   */
  probe(x: number, z: number, y: number, out?: IBotStepProbe): IBotStepProbe {
    const ret = out ?? step_probe_new();
    const terrain = this.terrain;
    const seg = terrain.segment(x, z, y, false, y);
    const top = terrain.y(seg, x, z);
    ret.x = x;
    ret.z = z;
    ret.y = y;
    ret.seg = seg;
    ret.top = top;
    ret.dy = top - y;
    ret.cliff = !!seg.cliff;
    ret.blocked = terrain.enterable(seg, x, y, z) === null;
    return ret;
  }

  /**
   * 该点能否站人（非悬崖、不是墙里、台阶不高）
   *
   * @param {number} x X坐标
   * @param {number} z Z坐标
   * @param {number} y 参照高度（一般为实体脚底）
   */
  standable(x: number, z: number, y: number): boolean {
    const terrain = this.terrain;
    const seg = terrain.segment(x, z, y, false, y);
    if (seg.cliff) return false;
    const top = terrain.y(seg, x, z);
    if (top - y > terrain.step) return false;
    // 顶面之上还有实心地形：说明这个高度在墙里
    return terrain.solids_at(x, top + 1, z).length === 0;
  }

  /**
   * 能不能朝 dx/dz 迈一步
   *
   * - 近处：换了一段地形还被挡住 → 墙/台阶。
   * - 远处：只查悬崖和过大落差。同一段斜坡上，远处的高度差会随距离变大，
   *   那不是墙，所以远处不能用 `blocked`。
   *
   * @param {number} x 当前X
   * @param {number} z 当前Z
   * @param {number} y 当前脚底高度
   * @param {number} dx X方向
   * @param {number} dz Z方向
   * @param {number} near_dist 近处探测距离
   * @param {number} far_dist 远处探测距离
   * @param {number} max_drop 允许直接走下去的最大落差
   * @returns {boolean} 能走返回 true
   */
  can_step(
    x: number,
    z: number,
    y: number,
    dx: -1 | 0 | 1,
    dz: -1 | 0 | 1,
    near_dist: number,
    far_dist: number,
    max_drop: number,
  ): boolean {
    if (!dx && !dz) return true;
    const cur = this.probe(x, z, y, this._step_cur);
    const near = this.probe(x + dx * near_dist, z + dz * near_dist, y, this._step_near);
    if (near.cliff) return false;
    if (near.blocked && near.seg !== cur.seg) return false;
    if (near.dy < -max_drop) return false;
    const far = this.probe(x + dx * far_dist, z + dz * far_dist, y, this._step_far);
    return !far.cliff && far.dy >= -max_drop;
  }

  /**
   * 在 (x, z) 处找 y 上方可站立的台面
   *
   * @param {number} x X坐标
   * @param {number} z Z坐标
   * @param {number} y 参照高度（一般为实体脚底）
   * @param {number} max_rise 最大可跳上的高度
   * @returns {number | null} 台面高度；没有可上的台面时返回 null
   */
  climbable_top(x: number, z: number, y: number, max_rise: number): number | null {
    const terrain = this.terrain;
    const solids = terrain.column(x, z, this._column);
    let best: number | null = null;
    for (const solid of solids) {
      if (solid.source.cliff) continue;
      const top = terrain_top(solid, x, z);
      const dy = top - y;
      // 一步就能走上去的不算“要跳的台子”
      if (dy <= terrain.step || dy > max_rise) continue;
      if (!this.standable(x, z, top)) continue;
      if (best === null || top > best) best = top;
    }
    return best;
  }
}
