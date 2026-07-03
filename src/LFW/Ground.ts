import type { World } from "./World";
import { TerrainEnum, type ITerrainInfo } from "./defines/ITerrainInfo";
import { clamp } from "./utils";

export interface IBlockResult {
  block_x: number | null;
  block_z: number | null;
}

export class Ground {
  readonly world: World;

  private _blocked: IBlockResult = { block_x: null, block_z: null };
  private _step: number = 15;

  constructor(world: World) {
    this.world = world
  }

  /**
   * 获得坐标点脚下的地形信息
   * 
   * @param {number} x X坐标
   * @param {number} y Y坐标
   * @param {number} z Z坐标
   * @returns {ITerrainInfo | undefined} 地形信息
   */
  segment(x: number, y: number, z: number): ITerrainInfo | undefined {
    const { terrain } = this.world.bg.data;
    if (!terrain?.length) return void 0;

    // 向上一步，“允许走楼梯”
    y += this._step;

    let best: ITerrainInfo | undefined;
    let best_y: number | undefined;
    for (const seg of terrain) {
      if (x < seg.x1 || x > seg.x2) continue;
      if (z < seg.z1 || z > seg.z2) continue;
      const seg_y = this.ground(seg, x, z);
      if (seg_y > y) continue;
      if (best_y === void 0 || seg_y > best_y) {
        best_y = seg_y;
        best = seg;
      }
    }
    return best;
  }

  /**
   * 获得地形高度
   * 
   * @param {ITerrainInfo} seg 地形信息
   * @param {number} x X坐标
   * @param {number} z Z坐标
   * @returns {number} Y坐标
   */
  ground(seg: ITerrainInfo, x: number, z: number): number {
    switch (seg.type) {
      case TerrainEnum.Pit:
        return -9999;
      case TerrainEnum.Flat:
      case TerrainEnum.Platform:
        return seg.h00;
      case TerrainEnum.Slope:
        x = clamp(x, seg.x1, seg.x2)
        z = clamp(z, seg.z1, seg.z2)
        if (seg.h00 === seg.h01 && seg.h10 === seg.h11) {
          const t = (x - seg.x1) / (seg.x2 - seg.x1);
          return seg.h00 + t * (seg.h10 - seg.h00);
        }
        if (seg.h00 === seg.h10 && seg.h01 === seg.h11) {
          const t = (z - seg.z1) / (seg.z2 - seg.z1);
          return seg.h00 + t * (seg.h01 - seg.h00);
        }
        const tx = (x - seg.x1) / (seg.x2 - seg.x1);
        const tz = (z - seg.z1) / (seg.z2 - seg.z1);
        return (
          seg.h00 * (1 - tx) * (1 - tz)
          + seg.h10 * tx * (1 - tz)
          + seg.h01 * (1 - tx) * tz
          + seg.h11 * tx * tz
        )
    }
    return 0;
  }

  /**
   * 能否进入地点
   * 
   * @param {ITerrainInfo} seg 地形信息
   * @param {number} x X坐标
   * @param {number} y Z坐标
   * @param {number} z Z坐标
   * @returns {number | null} 新高度，当返回null，表示无法进入地点
   */
  enterable(seg: ITerrainInfo, x: number, y: number, z: number): number | null {
    const dist_y = this.ground(seg, x, z);
    const diff_h = dist_y - y;

    // 平台不能从下方走上，只能从上方降落
    if (seg.type === TerrainEnum.Platform && diff_h > 0) return null;

    // 地形太高，上不去
    if (diff_h > this._step) return null;

    return dist_y;
  }

  block(seg: ITerrainInfo, x: number, y: number, z: number, vx: number, vz: number): IBlockResult {
    const stand_y = this.enterable(seg, x, y, z);

    if (stand_y !== null) {
      this._blocked.block_x = this._blocked.block_z = null;
      return this._blocked;
    }

    let push_x: number | null = null;
    let push_z: number | null = null;

    if (seg.type === TerrainEnum.Platform) {
      // 平台：挡所有有速度的轴
      if (vx > 0) push_x = seg.x1 - 1;
      else if (vx < 0) push_x = seg.x2 + 1;
      else push_x = (x - seg.x1) < (seg.x2 - x) ? seg.x1 - 1 : seg.x2 + 1;

      if (vz > 0) push_z = seg.z1 - 1;
      else if (vz < 0) push_z = seg.z2 + 1;
      else push_z = (z - seg.z1) < (seg.z2 - z) ? seg.z1 - 1 : seg.z2 + 1;
    } else {
      // Flat / Slope：仅挡有速度的轴
      if (vx > 0) push_x = seg.x1 - 1;
      else if (vx < 0) push_x = seg.x2 + 1;

      if (vz > 0) push_z = seg.z1 - 1;
      else if (vz < 0) push_z = seg.z2 + 1;
    }

    this._blocked.block_x = push_x;
    this._blocked.block_z = push_z;
    return this._blocked;
  }
}
