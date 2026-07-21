import type { World } from "./World";
import { TerrainEnum, type ITerrainInfo } from "./defines/ITerrainInfo";
import type { IVector3Like } from "./defines/IVector3Like";
import { abs, clamp } from "./utils";
import { line_plane_intersection } from "./utils/math/line_plane_intersection";

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
  private readonly _intersectResult = { x: 0, y: 0, z: 0 };
  readonly land: Readonly<ITerrainInfo> = {
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
    return this.land;
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

    if (seg.id == this.land.id) return this._empty;

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

  /** 
   * 与地面的碰撞 
   * 
   * @param {number} x1 位置向量起点X坐标
   * @param {number} y1 位置向量起点Y坐标
   * @param {number} z1 位置向量起点Z坐标
   * @param {number} x2 位置向量终点X坐标
   * @param {number} y2 位置向量终点Y坐标
   * @param {number} z2 位置向量终点Z坐标
   * 
   * @returns {[IVector3Like,ITerrainInfo]} [碰撞点坐标, 碰撞XZ坐标下的地形信息]
   */
  intersect(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): [IVector3Like, ITerrainInfo] {
    const { terrain } = this.world.bg.data;
    let best_t = Infinity;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;

    if (terrain?.length) {
      for (const seg of terrain) {
        // === 顶面碰撞 ===
        let a: number, b: number, c: number, d: number;
        switch (seg.type) {
          case TerrainEnum.Flat:
            a = 0; b = 1; c = 0; d = -seg.h1;
            break;
          case TerrainEnum.SlopeH: {
            const dh = seg.h2 - seg.h1;
            const dx2 = seg.x2 - seg.x1;
            a = -dh; b = dx2; c = 0; d = seg.x1 * dh - seg.h1 * dx2;
            break;
          }
          case TerrainEnum.SlopeV: {
            const dh = seg.h2 - seg.h1;
            const dz2 = seg.z2 - seg.z1;
            a = 0; b = dz2; c = -dh; d = seg.z1 * dh - seg.h1 * dz2;
            break;
          }
          default:
            continue;
        }

        const hit = line_plane_intersection(
          a, b, c, d,
          x1, y1, z1,
          x2, y2, z2,
          false, true,
        );
        if (hit) {
          // 验证交点在地形段范围内
          if (hit.x >= seg.x1 && hit.x <= seg.x2 && hit.z >= seg.z1 && hit.z <= seg.z2) {
            const seg_y = this.y(seg, hit.x, hit.z);
            if (seg_y - y1 <= this.step) {
              // 计算参数 t（交点沿线段的比例）
              const dhx = hit.x - x1;
              const dhy = hit.y - y1;
              const dhz = hit.z - z1;
              const denom = dx * dx + dy * dy + dz * dz;
              const t = denom === 0 ? 0 : (dhx * dx + dhy * dy + dhz * dz) / denom;
              // 交点太靠近起点，说明角色已在表面上，跳过（如起跳、行走）
              if (t > 1e-6 && t < best_t) {
                best_t = t;
                this._intersectResult.x = hit.x;
                this._intersectResult.y = hit.y;
                this._intersectResult.z = hit.z;
              }
            }
          }
        }

        // === 垂直墙面碰撞（不影响Y，保持垂直速度） ===
        // 左墙 x = seg.x1
        if (dx !== 0) {
          const t = (seg.x1 - x1) / dx;
          if (t > 0 && t < 1 && t < best_t) {
            const iz = z1 + t * dz;
            if (iz >= seg.z1 && iz <= seg.z2) {
              const iy = y1 + t * dy;
              const ty = this.y(seg, seg.x1, iz);
              if (ty - iy > this.step) {
                best_t = t;
                this._intersectResult.x = seg.x1 - 1;
                this._intersectResult.y = y2;
                this._intersectResult.z = iz;
              }
            }
          }
        }
        // 右墙 x = seg.x2
        if (dx !== 0) {
          const t = (seg.x2 - x1) / dx;
          if (t > 0 && t < 1 && t < best_t) {
            const iz = z1 + t * dz;
            if (iz >= seg.z1 && iz <= seg.z2) {
              const iy = y1 + t * dy;
              const ty = this.y(seg, seg.x2, iz);
              if (ty - iy > this.step) {
                best_t = t;
                this._intersectResult.x = seg.x2 + 1;
                this._intersectResult.y = y2;
                this._intersectResult.z = iz;
              }
            }
          }
        }
        // 远墙 z = seg.z1
        if (dz !== 0) {
          const t = (seg.z1 - z1) / dz;
          if (t > 0 && t < 1 && t < best_t) {
            const ix = x1 + t * dx;
            if (ix >= seg.x1 && ix <= seg.x2) {
              const iy = y1 + t * dy;
              const ty = this.y(seg, ix, seg.z1);
              if (ty - iy > this.step) {
                best_t = t;
                this._intersectResult.x = ix;
                this._intersectResult.y = y2;
                this._intersectResult.z = seg.z1 - 1;
              }
            }
          }
        }
        // 近墙 z = seg.z2
        if (dz !== 0) {
          const t = (seg.z2 - z1) / dz;
          if (t > 0 && t < 1 && t < best_t) {
            const ix = x1 + t * dx;
            if (ix >= seg.x1 && ix <= seg.x2) {
              const iy = y1 + t * dy;
              const ty = this.y(seg, ix, seg.z2);
              if (ty - iy > this.step) {
                best_t = t;
                this._intersectResult.x = ix;
                this._intersectResult.y = y2;
                this._intersectResult.z = seg.z2 + 1;
              }
            }
          }
        }
      }
    }

    // 无碰撞时返回终点
    if (!isFinite(best_t)) {
      this._intersectResult.x = x2;
      this._intersectResult.y = y2;
      this._intersectResult.z = z2;
    }

    return [this._intersectResult, this.segment(this._intersectResult.x, this._intersectResult.z)];
  }

  /** 
   * 检查线段是否穿过阻挡地形的墙面（仅用于穿墙检测，不影响Y）
   * 
   * @returns { x: number, z: number } | null  碰撞点的XZ坐标，null表示未穿墙
   */
  intersect_wall(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
  ): { x: number, z: number } | null {
    const { terrain } = this.world.bg.data;
    if (!terrain?.length) return null;

    let best_t = Infinity;
    let best_x = 0;
    let best_z = 0;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;

    // 只有 XZ 有位移时才可能穿墙
    if (dx === 0 && dz === 0) return null;

    for (const seg of terrain) {
      // 快速跳过：地形整体高度都不足以阻挡
      const max_h = seg.h1 > seg.h2 ? seg.h1 : seg.h2;
      const min_y = y1 < y2 ? y1 : y2;
      if (max_h - min_y <= this.step) continue;

      // 左墙 x = seg.x1
      if (dx !== 0) {
        const t = (seg.x1 - x1) / dx;
        if (t > 0 && t < 1 && t < best_t) {
          const iz = z1 + t * dz;
          if (iz >= seg.z1 && iz <= seg.z2) {
            const iy = y1 + t * dy;
            const ty = this.y(seg, seg.x1, iz);
            if (ty - iy > this.step) {
              best_t = t;
              best_x = seg.x1 - 1;
              best_z = z2;
            }
          }
        }
      }
      // 右墙 x = seg.x2
      if (dx !== 0) {
        const t = (seg.x2 - x1) / dx;
        if (t > 0 && t < 1 && t < best_t) {
          const iz = z1 + t * dz;
          if (iz >= seg.z1 && iz <= seg.z2) {
            const iy = y1 + t * dy;
            const ty = this.y(seg, seg.x2, iz);
            if (ty - iy > this.step) {
              best_t = t;
              best_x = seg.x2 + 1;
              best_z = z2;
            }
          }
        }
      }
      // 远墙 z = seg.z1
      if (dz !== 0) {
        const t = (seg.z1 - z1) / dz;
        if (t > 0 && t < 1 && t < best_t) {
          const ix = x1 + t * dx;
          if (ix >= seg.x1 && ix <= seg.x2) {
            const iy = y1 + t * dy;
            const ty = this.y(seg, ix, seg.z1);
            if (ty - iy > this.step) {
              best_t = t;
              best_x = x2;
              best_z = seg.z1 - 1;
            }
          }
        }
      }
      // 近墙 z = seg.z2
      if (dz !== 0) {
        const t = (seg.z2 - z1) / dz;
        if (t > 0 && t < 1 && t < best_t) {
          const ix = x1 + t * dx;
          if (ix >= seg.x1 && ix <= seg.x2) {
            const iy = y1 + t * dy;
            const ty = this.y(seg, ix, seg.z2);
            if (ty - iy > this.step) {
              best_t = t;
              best_x = x2;
              best_z = seg.z2 + 1;
            }
          }
        }
      }
    }

    return isFinite(best_t) ? { x: best_x, z: best_z } : null;
  }
}
