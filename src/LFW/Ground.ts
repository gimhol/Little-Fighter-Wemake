import type { World } from "./World";
import { TerrainEnum, type ITerrainInfo } from "./defines/ITerrainInfo";
import { abs, clamp } from "./utils";

export type IBlockResult = ReadonlyArray<{
  readonly x: number,
  readonly z: number
}>;

export class Ground {
  readonly world: World;

  readonly step: number = 10;
  private readonly _ret = [
    { x: 0, z: 0 },
    { x: 0, z: 0 },
    { x: 0, z: 0 },
    { x: 0, z: 0 },
  ];
  private readonly _empty = [];
  private _land: Readonly<ITerrainInfo> = {
    id: 'GROUND_0',
    name: 'GROUND_0',
    type: TerrainEnum.Flat,
    x1: Number.MIN_SAFE_INTEGER,
    x2: Number.MAX_SAFE_INTEGER,
    z1: Number.MIN_SAFE_INTEGER,
    z2: Number.MAX_SAFE_INTEGER,
    h1: 0,
    h2: 0,
  };

  constructor(world: World) {
    this.world = world
  }

  /**
   * 获得坐标点地形信息
   * 
   * @param {number} x X坐标
   * @param {number} z Z坐标
   * @returns {Readonly<ITerrainInfo>} 地形信息，找不到时返回默认平台
   */
  segment(x: number, z: number): Readonly<ITerrainInfo> {
    const { terrain } = this.world.bg.data;
    if (terrain?.length) {
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
      if (best) return best;
    }
    // 找不到地形时返回默认平台
    return this._land;
  }

  /**
   * 获得地形高度
   * 
   * @param {ITerrainInfo} seg 地形信息
   * @param {number} x X坐标
   * @param {number} z Z坐标
   * @returns {number} Y坐标
   */
  y(seg: Readonly<ITerrainInfo>, x: number, z: number): number {
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
   * @param {Readonly<ITerrainInfo>} seg 地形信息
   * @param {number} x X坐标
   * @param {number} y Z坐标
   * @param {number} z Z坐标
   * @returns {number | null} 新高度，当返回null，表示无法进入地点
   */
  enterable(seg: Readonly<ITerrainInfo>, x: number, y: number, z: number): number | null {
    const dist_y = this.y(seg, x, z);
    const diff_h = dist_y - y;

    // 地形太高，上不去
    if (diff_h > this.step) return null;

    return dist_y;
  }

  /**
   * 计算被地形阻挡后的替代位置。当角色无法进入目标坐标时，
   * 返回最近的可通行边界点（优先沿 X 轴或 Z 轴方向推挤）。
   * 
   * 注意：该函数返回的
   *
   * [斜坡与碰撞](../../docs/dev/terrain_slope_and_block/terrain_slope_and_block.md)
   * 
   * @param {Readonly<ITerrainInfo>} seg 地形信息
   * @param {number} x   目标 X 坐标
   * @param {number} y   当前 Y 坐标（高度）
   * @param {number} z   目标 Z 坐标
   * @returns {{ x: number, z: number }[]} 
   *    替代位置数组（按优先级排序)，
   *    若可直接进入则返回 null, 若无法替代，返回空数组
   */
  block(
    seg: Readonly<ITerrainInfo>,
    x: number,
    y: number,
    z: number,
    prev_x: number = x,
    prev_y: number = y,
    prev_z: number = z,
  ): Readonly<IBlockResult> {

    if (seg.id == this._land.id) return this._empty;

    let l = seg.x1 - 1;
    let r = seg.x2 + 1;
    let f = seg.z1 - 1;
    let n = seg.z2 + 1;

    const mid_x = (seg.x1 + seg.x2) / 2;
    const mid_z = (seg.z1 + seg.z2) / 2;
    let slope_x: number | undefined;
    let slope_z: number | undefined;

    switch (seg.type) {
      case TerrainEnum.SlopeH: {
        const dh = seg.h2 - seg.h1;
        if (dh === 0) break;
        const t = (y - seg.h1) / dh;
        slope_x = seg.x1 + clamp(t, 0, 1) * (seg.x2 - seg.x1);
        const sx = clamp(seg.x1 + t * (seg.x2 - seg.x1), l, r);
        if (sx > x) r = sx + 1; else l = sx - 1;
        break;
      }
      case TerrainEnum.SlopeV: {
        const dh = seg.h2 - seg.h1;
        if (dh === 0) break;
        const t = (y - seg.h1) / dh;
        slope_z = seg.z1 + clamp(t, 0, 1) * (seg.z2 - seg.z1);
        const sz = clamp(seg.z1 + t * (seg.z2 - seg.z1), f, n);
        if (sz > z) n = sz + 1; else f = sz - 1;
        break;
      }
    }
    const from_l = prev_x <= (slope_x ?? mid_x);
    const from_f = prev_z <= (slope_z ?? mid_z);
    const fx = from_l ? l : r;
    const ox = from_l ? r : l;
    const fz = from_f ? f : n;
    const oz = from_f ? n : f;
    // 近侧
    if (abs(fx - x) < abs(fz - z)) {
      this._ret[0].x = fx;
      this._ret[0].z = z;
      this._ret[1].x = x;
      this._ret[1].z = fz;
    } else {
      this._ret[0].x = x;
      this._ret[0].z = fz;
      this._ret[1].x = fx;
      this._ret[1].z = z;
    }

    // 远侧
    if (abs(ox - x) < abs(oz - z)) {
      this._ret[2].x = ox;
      this._ret[2].z = z;
      this._ret[3].x = x;
      this._ret[3].z = oz;
    } else {
      this._ret[2].x = x;
      this._ret[2].z = oz;
      this._ret[3].x = ox;
      this._ret[3].z = z;
    }
    return this._ret;
  }
}
