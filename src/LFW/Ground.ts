import type { World } from ".";
import { TerrainEnum, type ITerrainInfo } from "./defines/ITerrainInfo";

export interface IBlockResult {
  blockX: boolean;
  blockZ: boolean;
  pushX: number | null;
  pushZ: number | null;
}

export class Ground {
  readonly world: World;

  private _block_result: IBlockResult = { blockX: false, blockZ: false, pushX: null, pushZ: null };

  constructor(world: World) {
    this.world = world
  }
  get_y(x: number, y: number, z: number): number {
    const { terrain } = this.world.bg.data;
    if (!terrain?.length) return 0;

    let best: number | undefined;
    for (const seg of terrain) {
      if (x < seg.x1 || x > seg.x2) continue;
      if (z < seg.z1 || z > seg.z2) continue;

      let segY = 0;
      switch (seg.type) {
        case TerrainEnum.Pit:
          segY = -9999; break;
        case TerrainEnum.Flat:
        case TerrainEnum.Platform:
          segY = seg.h00; break;
        case TerrainEnum.Slope:
          if (seg.h00 === seg.h01 && seg.h10 === seg.h11) {
            const t = (x - seg.x1) / (seg.x2 - seg.x1);
            segY = seg.h00 + t * (seg.h10 - seg.h00);
          } else if (seg.h00 === seg.h10 && seg.h01 === seg.h11) {
            const t = (z - seg.z1) / (seg.z2 - seg.z1);
            segY = seg.h00 + t * (seg.h01 - seg.h00);
          } else {
            const tx = (x - seg.x1) / (seg.x2 - seg.x1);
            const tz = (z - seg.z1) / (seg.z2 - seg.z1);
            segY = seg.h00 * (1 - tx) * (1 - tz)
              + seg.h10 * tx * (1 - tz)
              + seg.h01 * (1 - tx) * tz
              + seg.h11 * tx * tz;
          }
          break;
      }

      // 取实体脚下最近（Y 最大但 ≤ entityY）
      if (segY > y) continue;
      if (best === undefined || segY > best) best = segY;
    }
    return best ?? 0;
  }

  /** 返回实体脚下最近（Y 最大但 ≤ entityY）的地形段 */
  find_segment(x: number, y: number, z: number): ITerrainInfo | undefined {
    const { terrain } = this.world.bg.data;
    if (!terrain?.length) return undefined;

    let best: ITerrainInfo | undefined;
    let bestY: number | undefined;
    for (const seg of terrain) {
      if (x < seg.x1 || x > seg.x2) continue;
      if (z < seg.z1 || z > seg.z2) continue;

      const segY = seg.type === TerrainEnum.Slope
        ? Math.min(seg.h00, seg.h10, seg.h01, seg.h11)
        : seg.h00;

      // 找 Y 最大但 ≤ 实体当前 Y 的（脚底下方最近的那个）
      if (segY > y) continue;
      if (bestY === undefined || segY > bestY) {
        bestY = segY;
        best = seg;
      }
    }
    return best;
  }

  /** @param seg 可选。调用方已查询过的地形段，避免重复查找 */
  can_stand(fromY: number, toX: number, toZ: number, maxStep: number = 15, seg?: ITerrainInfo): number | null {
    seg ??= this.find_segment(toX, fromY, toZ);

    // === 情况1: 没有地形段 → 默认地面(高度0) ===
    if (!seg) return 0;

    // === 情况2: 坑 → 允许进入 ===
    if (seg.type === TerrainEnum.Pit) return -9999;

    // === 情况3: 平台 → 只能从上方降落，不能从侧面走入 ===
    if (seg.type === TerrainEnum.Platform) return null;

    // === 情况4: Flat / Slope → 检查高度差 ===
    const targetY = this.get_y(toX, fromY, toZ);
    const heightDiff = fromY - targetY; // 正值 = 目标更高
    if (heightDiff > maxStep) return null;
    return targetY;
  }

  /**
   * 用速度方向反推闯入的边界
   * @param vx 实体当前 X 速度
   * @param vz 实体当前 Z 速度
   * @param seg 可选。调用方已查询过的地形段
   */
  block_axis(
    fromY: number,
    x: number, z: number,
    vx: number, vz: number,
    maxStep: number = 15,
    seg?: ITerrainInfo,
  ): IBlockResult {
    seg ??= this.find_segment(x, fromY, z);
    const canHere = this.can_stand(fromY, x, z, maxStep, seg);

    if (canHere !== null || !seg) {
      this._block_result.blockX = this._block_result.blockZ = false;
      this._block_result.pushX = this._block_result.pushZ = null;
      return this._block_result;
    }

    if (seg.type === TerrainEnum.Platform) {
      this._block_result.blockX = this._block_result.blockZ = true;
      this._block_result.pushX = (x - seg.x1) < (seg.x2 - x) ? seg.x1 - 1 : seg.x2 + 1;
      this._block_result.pushZ = (z - seg.z1) < (seg.z2 - z) ? seg.z1 - 1 : seg.z2 + 1;
      return this._block_result;
    }

    let pushX: number | null = null;
    let pushZ: number | null = null;

    if (vx > 0) pushX = seg.x1 - 1;
    else if (vx < 0) pushX = seg.x2 + 1;

    if (vz > 0) pushZ = seg.z1 - 1;
    else if (vz < 0) pushZ = seg.z2 + 1;

    this._block_result.blockX = pushX !== null;
    this._block_result.blockZ = pushZ !== null;
    this._block_result.pushX = pushX;
    this._block_result.pushZ = pushZ;
    return this._block_result;
  }
}
