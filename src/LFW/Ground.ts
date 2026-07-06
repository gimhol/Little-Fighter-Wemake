import type { World } from "./World";
import { TerrainEnum, type ITerrainInfo } from "./defines/ITerrainInfo";
import { abs, clamp, is_f_num } from "./utils";

export interface IBlockResult {
  block_x: number | null;
  block_z: number | null;
  block_y: number | null;
}

export class Ground {
  readonly world: World;

  private _blocked: IBlockResult = { block_x: null, block_z: null, block_y: null };
  readonly step: number = 15;

  constructor(world: World) {
    this.world = world
  }

  /**
   * 获得坐标点地形信息
   * 
   * @param {number} x X坐标
   * @param {number} z Z坐标
   * @returns {ITerrainInfo | undefined} 地形信息
   */
  segment(x: number, z: number): ITerrainInfo | undefined {
    const { terrain } = this.world.bg.data;
    if (!terrain?.length) return void 0;

    let best: ITerrainInfo | undefined;
    let best_y: number | undefined;
    for (const seg of terrain) {
      if (x < seg.x1 || x > seg.x2) continue;
      if (z < seg.z1 || z > seg.z2) continue;
      const seg_y = this.y(seg, x, z);
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
  y(seg: ITerrainInfo, x: number, z: number): number {
    switch (seg.type) {
      case TerrainEnum.Flat:
        return seg.h1;
      case TerrainEnum.SlopeH: {
        x = clamp(x, seg.x1, seg.x2)
        z = clamp(z, seg.z1, seg.z2)
        const t = (x - seg.x1) / (seg.x2 - seg.x1);
        return seg.h1 + t * (seg.h2 - seg.h1);
      }
      case TerrainEnum.SlopeV: {
        x = clamp(x, seg.x1, seg.x2)
        z = clamp(z, seg.z1, seg.z2)
        const t = (z - seg.z1) / (seg.z2 - seg.z1);
        return seg.h1 + t * (seg.h2 - seg.h1);
      }
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
    const dist_y = this.y(seg, x, z);
    const diff_h = dist_y - y;

    // 地形太高，上不去
    if (diff_h > this.step) return null;

    return dist_y;
  }

  block(
    seg: ITerrainInfo,
    x: number, y: number, z: number
  ): IBlockResult {
    const stand_y = this.enterable(seg, x, y, z);

    if (stand_y !== null && stand_y <= y + this.step) {
      this._blocked.block_x = null;
      this._blocked.block_z = null;
      this._blocked.block_y = null;
      return this._blocked;
    }

    let block_x: number | null;
    let block_z: number | null;
    let xx: number;
    let zz: number;

    const l = seg.x1 - 1
    const r = seg.x2 + 1
    const f = seg.z1 - 1
    const n = seg.z2 + 1

    const dist_l = (x - l);
    const dist_r = (r - x);
    const dist_f = (z - f);
    const dist_n = (n - z);

    if (dist_l < dist_r) {
      block_x = l;
      xx = abs(dist_l);
    } else {
      block_x = r;
      xx = abs(dist_r);
    }

    if (dist_f < dist_n) {
      block_z = f;
      zz = abs(dist_f);
    } else {
      block_z = n;
      zz = abs(dist_n);
    }
    if (xx < zz || block_z <= far || block_z >= near)
      block_z = null;
    else
      block_x = null;
    this._blocked.block_x = block_x;
    this._blocked.block_z = block_z;
    this._blocked.block_y = null;
    return this._blocked;
  }
}
