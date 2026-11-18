import { TerrainEnum, type ITerrainInfo, type IVector3Like } from "../defines";
import { clamp, round } from "../utils";
import { line_plane_intersection } from "../utils/math/line_plane_intersection";
import {
  TerrainMode,
  terrain_top,
  to_terrain_solids,
  type ITerrainSolid,
} from "./TerrainSolid";

export const TERRAIN_STEP = 10;
const EPS = 0.5;
/** 挤出后与地形边界保持的距离 */
const PUSH_OUT_MARGIN = 1;
const PUSH_OUT_MAX_TRAVEL = 256;
/** 寻找可站立地面时，方形环采样的步长 */
const STANDABLE_STEP = 4;
/** 寻找可站立地面时，最大搜索半径 */
const STANDABLE_MAX_RADIUS = 512;

/** 可站立的地面坐标 */
export interface IStandablePoint {
  x: number;
  y: number;
  z: number;
}

/** 地形挤出的结果 */
export interface IPushOut {
  x: number;
  y: number;
  z: number;

  /** 是否被挤出 */
  moved: boolean;
}


export interface ISurfaceQuery {
  y?: number;
  rising?: boolean;
  prev_y?: number;
  drop_through?: boolean;
  step?: number;
}

export interface ISurfaceHit {
  solid: ITerrainSolid | undefined;
  y: number;
}

/** 一条射线与地形相交的参数区间；`enter <= 0 <= exit` 表示起点在其中 */
interface ISpan {
  enter: number;
  exit: number;
}

/** 顶面的线性表达式：`top = c + kx * x + kz * z` */
interface ITopPlane {
  c: number;
  kx: number;
  kz: number;
}

/**
 * 求实心地形顶面：平地是常数，斜坡沿 x 或 z 线性变化。
 * 退化的斜坡（没有坡长）与其它未知类型都按平地处理，与 `terrain_top` 一致。
 */
function solid_top_plane(solid: Readonly<ITerrainSolid>): ITopPlane {
  const dh = solid.h2 - solid.h1;
  if (solid.type === TerrainEnum.SlopeH && dh !== 0 && solid.x1 !== solid.x2) {
    const k = dh / (solid.x2 - solid.x1);
    return { c: solid.h1 - k * solid.x1, kx: k, kz: 0 };
  }
  if (solid.type === TerrainEnum.SlopeV && dh !== 0 && solid.z1 !== solid.z2) {
    const k = dh / (solid.z2 - solid.z1);
    return { c: solid.h1 - k * solid.z1, kx: 0, kz: k };
  }
  return { c: solid.h1, kx: 0, kz: 0 };
}

/** 无限射线 `(sx, sz) + t * (ux, uz)` 与地形 (x, z) 矩形的相交参数区间 */
function rect_span(
  sx: number,
  sz: number,
  ux: number,
  uz: number,
  solid: Readonly<ITerrainSolid>,
): ISpan | null {
  let enter = -Infinity;
  let exit = Infinity;
  if (ux === 0) {
    if (sx < solid.x1 || sx > solid.x2) return null;
  } else {
    const a = (solid.x1 - sx) / ux;
    const b = (solid.x2 - sx) / ux;
    if (a < b) {
      enter = a;
      exit = b;
    } else {
      enter = b;
      exit = a;
    }
  }
  if (uz === 0) {
    if (sz < solid.z1 || sz > solid.z2) return null;
  } else {
    const a = (solid.z1 - sz) / uz;
    const b = (solid.z2 - sz) / uz;
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    if (lo > enter) enter = lo;
    if (hi < exit) exit = hi;
  }
  if (enter > exit) return null;
  return { enter, exit };
}

export class TerrainWorld {
  static readonly BUCKET_SIZE = 256;
  /** 没有地形时的默认平台 */
  static readonly horizon: Readonly<ITerrainInfo> = {
    id: 'horizon_0',
    name: 'horizon_0',
    type: TerrainEnum.Flat,
    x1: Number.MIN_SAFE_INTEGER,
    x2: Number.MAX_SAFE_INTEGER,
    z1: Number.MIN_SAFE_INTEGER,
    z2: Number.MAX_SAFE_INTEGER,
    h1: 0,
    h2: 0,
  };
  /** 深渊 */
  static readonly abyss: Readonly<ITerrainInfo> = {
    id: 'ABYSS_0',
    name: 'ABYSS_0',
    type: TerrainEnum.Flat,
    x1: Number.MIN_SAFE_INTEGER,
    x2: Number.MAX_SAFE_INTEGER,
    z1: Number.MIN_SAFE_INTEGER,
    z2: Number.MAX_SAFE_INTEGER,
    h1: Number.MIN_SAFE_INTEGER,
    h2: Number.MIN_SAFE_INTEGER,
  };
  readonly source: readonly ITerrainInfo[] | undefined;
  readonly solids: readonly ITerrainSolid[];
  /** 一步能跨过的高度差 */
  readonly step: number = TERRAIN_STEP;
  /** 找不到地形时返回的默认平台 */
  readonly base: Readonly<ITerrainInfo> = TerrainWorld.horizon;
  private readonly buckets: ITerrainSolid[][];
  private readonly bucket_origin: number;
  private readonly _intersect_result = { x: 0, y: 0, z: 0 };

  constructor(terrain: readonly ITerrainInfo[] | undefined) {
    this.source = terrain;
    this.solids = to_terrain_solids(terrain);
    if (!this.solids.length) {
      this.bucket_origin = 0;
      this.buckets = [];
      return;
    }
    let min = Infinity;
    let max = -Infinity;
    for (const s of this.solids) {
      if (s.x1 < min) min = s.x1;
      if (s.x2 > max) max = s.x2;
    }
    this.bucket_origin = min;
    const count = Math.max(1, Math.floor((max - min) / TerrainWorld.BUCKET_SIZE) + 1);
    this.buckets = new Array(count);
    for (let i = 0; i < count; ++i) this.buckets[i] = [];
    for (const s of this.solids) {
      const a = this.bucket_index(s.x1);
      const b = this.bucket_index(s.x2);
      for (let i = a; i <= b; ++i) this.buckets[i].push(s);
    }
  }

  private bucket_index(x: number): number {
    const i = Math.floor((x - this.bucket_origin) / TerrainWorld.BUCKET_SIZE);
    if (i < 0) return 0;
    if (i >= this.buckets.length) return this.buckets.length - 1;
    return i;
  }

  private candidates(x: number): readonly ITerrainSolid[] {
    if (!this.buckets.length) return this.solids;
    return this.buckets[this.bucket_index(x)];
  }

  surface_at(x: number, z: number, query: ISurfaceQuery = {}): ISurfaceHit {
    const {
      y,
      rising = false,
      prev_y,
      drop_through = false,
    } = query;
    let best: ITerrainSolid | undefined;
    let best_y = 0;
    for (const solid of this.candidates(x)) {
      if (x < solid.x1 || x > solid.x2 || z < solid.z1 || z > solid.z2) continue;
      const top = terrain_top(solid, x, z);
      const passable = solid.mode === TerrainMode.OneWay || solid.mode === TerrainMode.Through;
      if (passable && y !== void 0) {
        if (rising) {
          if (y <= top) continue;
        } else if (
          solid.mode === TerrainMode.Through &&
          drop_through
        ) {
          continue;
        } else if (y < top - EPS) {
          if (prev_y === void 0 || prev_y < top) continue;
        }
      }
      if (!best || top > best_y) {
        best = solid;
        best_y = top;
      }
    }
    return { solid: best, y: best ? best_y : 0 };
  }

  solids_at(x: number, y: number, z: number): ITerrainSolid[] {
    let ret: ITerrainSolid[] | undefined;
    for (const solid of this.candidates(x)) {
      if (solid.mode !== TerrainMode.Solid) continue;
      if (x < solid.x1 || x > solid.x2 || z < solid.z1 || z > solid.z2) continue;
      if (y >= terrain_top(solid, x, z) - EPS) continue;
      (ret ??= []).push(solid);
    }
    return ret ?? [];
  }

  is_inside(x: number, y: number, z: number): boolean {
    return this.solids_at(x, y, z).length > 0;
  }

  /**
   * 获得坐标点地形信息
   *
   * @param {number} x X坐标
   * @param {number} z Z坐标
   * @param {number} [y] 物体当前高度
   * @param {boolean} [rising] 物体正在上升（velocity.y > 0）
   * @param {number} [prev_y] 本帧移动前的高度
   * @param {boolean} [drop_through] 是否正按住防御+下（可穿过 through 平台向下）
   * @returns {Readonly<ITerrainInfo>} 地形信息，找不到时返回默认平台
   */
  segment(
    x: number,
    z: number,
    y?: number,
    rising: boolean = false,
    prev_y?: number,
    drop_through: boolean = false,
  ): Readonly<ITerrainInfo> {
    let best: ITerrainSolid | undefined;
    let best_y = 0;
    for (const solid of this.candidates(x)) {
      if (x < solid.x1 || x > solid.x2 || z < solid.z1 || z > solid.z2) continue;
      const top = terrain_top(solid, x, z);
      const passable =
        solid.mode === TerrainMode.OneWay || solid.mode === TerrainMode.Through;
      if (passable && y !== void 0) {
        if (rising) {
          if (y <= top) continue;
        } else if (
          solid.mode === TerrainMode.Through &&
          drop_through
        ) {
          continue;
        } else if (y < top - EPS) {
          if (prev_y === void 0 || prev_y < top) continue;
        }
      }
      if (!best || top > best_y) {
        best = solid;
        best_y = top;
      }
    }
    return best?.source ?? this.base;
  }

  /**
   * 获得地形高度
   *
   * @param {Readonly<ITerrainInfo>} seg 地形信息
   * @param {number} x X坐标
   * @param {number} z Z坐标
   * @returns {number} Y坐标
   */
  y(seg: Readonly<ITerrainInfo>, x: number, z: number): number {
    switch (seg.type) {
      case TerrainEnum.Flat:
        return seg.h1;
      case TerrainEnum.SlopeH: {
        if (seg.x1 === seg.x2) return seg.h1;
        const t = (clamp(x, seg.x1, seg.x2) - seg.x1) / (seg.x2 - seg.x1);
        return seg.h1 + t * (seg.h2 - seg.h1);
      }
      case TerrainEnum.SlopeV: {
        if (seg.z1 === seg.z2) return seg.h1;
        const t = (clamp(z, seg.z1, seg.z2) - seg.z1) / (seg.z2 - seg.z1);
        return seg.h1 + t * (seg.h2 - seg.h1);
      }
    }
    return 0;
  }

  /** 在 x 附近找一个可站立的位置（避开悬崖） */
  standable_x(x: number, z: number, min_x: number, max_x: number): number {
    if (!this.segment(x, z).cliff) return x;
    for (let d = 8; d <= 240; d += 8) {
      const l = clamp(x - d, min_x, max_x);
      if (!this.segment(l, z).cliff) return l;
      const r = clamp(x + d, min_x, max_x);
      if (!this.segment(r, z).cliff) return r;
      if (l <= min_x && r >= max_x) break;
    }
    return x;
  }

  /** 可站立地面查询的结果（复用，避免每次查询分配对象） */
  private readonly _standable_result: IStandablePoint = { x: 0, y: 0, z: 0 };

  /**
   * 寻找距离 (x, z) 最近的可站立地面坐标
   *
   * 以 (x, z) 为锚点，由近到远按方形环采样。环上的点到锚点的距离不小于环半径，
   * 所以一旦找到候选点，半径更大的环就不必再看。
   *
   * @param {number} x 锚点 X 坐标
   * @param {number} z 锚点 Z 坐标
   * @param {number} left X 轴下限（舞台左边界）
   * @param {number} right X 轴上限（舞台右边界）
   * @param {number} near Z 轴上限（舞台近边界）
   * @param {number} far Z 轴下限（舞台远边界）
   * @returns {Readonly<IStandablePoint> | undefined} 最近的可站立地面坐标，结果对象会被复用；找不到时返回 undefined
   */
  nearest_standable(
    x: number,
    z: number,
    left: number,
    right: number,
    near: number,
    far: number,
  ): Readonly<IStandablePoint> | undefined {
    const ax = clamp(round(x), left, right);
    const az = clamp(round(z), far, near);
    let best_x = ax;
    let best_z = az;
    let best_seg: Readonly<ITerrainInfo> | undefined;
    let best_d2 = Infinity;
    for (let r = 0; r <= STANDABLE_MAX_RADIUS; r += STANDABLE_STEP) {
      if (r * r >= best_d2) break;
      // r === 0 时只看锚点本身，否则把方形环的四条边首尾相接遍历
      const edge = 2 * r / STANDABLE_STEP + 1;
      const count = r === 0 ? 1 : 4 * edge;
      for (let i = 0; i < count; ++i) {
        let dx = 0;
        let dz = 0;
        if (r !== 0) {
          if (i < edge) { // 远边：z = -r
            dx = i * STANDABLE_STEP - r;
            dz = -r;
          } else if (i < 2 * edge) { // 右边：x = r
            dx = r;
            dz = (i - edge) * STANDABLE_STEP - r;
          } else if (i < 3 * edge) { // 近边：z = r
            dx = r - (i - 2 * edge) * STANDABLE_STEP;
            dz = r;
          } else { // 左边：x = -r
            dx = -r;
            dz = r - (i - 3 * edge) * STANDABLE_STEP;
          }
        }
        const cx = ax + dx;
        const cz = az + dz;
        if (cx < left || cx > right || cz < far || cz > near) continue;
        const d2 = dx * dx + dz * dz;
        if (d2 >= best_d2) continue;
        const seg = this.segment(cx, cz);
        if (seg.cliff) continue;
        best_x = cx;
        best_z = cz;
        best_seg = seg;
        best_d2 = d2;
      }
    }
    if (!best_seg) return void 0;
    const ret = this._standable_result;
    ret.x = best_x;
    ret.y = this.y(best_seg, best_x, best_z);
    ret.z = best_z;
    return ret;
  }

  /**
   * 该 XZ 位置涉及的所有地形段，按顶面从高到低排序。
   *
   * 只读查询，供 AI、调试等上层逻辑使用；物理判定仍走 `segment` / `enterable`。
   * 传 `out` 可复用数组，避免高频查询时反复分配。
   *
   * @param {number} x X坐标
   * @param {number} z Z坐标
   * @param {ITerrainSolid[]} [out] 复用的输出数组
   * @returns {ITerrainSolid[]} 地形段列表（按顶面降序）
   */
  column(x: number, z: number, out: ITerrainSolid[] = []): ITerrainSolid[] {
    out.length = 0;
    for (const solid of this.candidates(x)) {
      if (x < solid.x1 || x > solid.x2 || z < solid.z1 || z > solid.z2) continue;
      out.push(solid);
    }
    // 同一点上的地形段通常只有 1~3 块，直接插入排序：
    // 不额外创建比较函数（这里是每帧都会走的热路径）。
    for (let i = 1; i < out.length; ++i) {
      const solid = out[i];
      const top = terrain_top(solid, x, z);
      let j = i - 1;
      while (j >= 0 && terrain_top(out[j], x, z) < top) {
        out[j + 1] = out[j];
        --j;
      }
      out[j + 1] = solid;
    }
    return out;
  }

  /**
   * 能否进入地点
   *
   * @param {Readonly<ITerrainInfo>} seg 地形信息
   * @param {number} x X坐标
   * @param {number} y Y坐标
   * @param {number} z Z坐标
   * @returns {number | null} 新高度，当返回 null，表示无法进入地点
   */
  enterable(
    seg: Readonly<ITerrainInfo>,
    x: number,
    y: number,
    z: number,
  ): number | null {
    const dist_y = this.y(seg, x, z);
    // 单向平台：物体在顶面下方时允许通过（保持当前高度，不会被抬上去）
    if ((seg.one_way || seg.through) && y < dist_y - this.step) return y;
    const diff_h = dist_y - y;

    // 地形太高，上不去
    if (diff_h > this.step) return null;

    return dist_y;
  }

  /**
   * 与地面的碰撞
   *
   * @returns {[IVector3Like, ITerrainInfo]} [碰撞点坐标, 碰撞XZ坐标下的地形信息]
   */
  intersect(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
  ): [IVector3Like, ITerrainInfo] {
    let best_t = Infinity;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;

    for (const solid of this.solids) {
      const passable =
        solid.mode === TerrainMode.OneWay || solid.mode === TerrainMode.Through;

      // === 顶面碰撞 ===
      let a: number;
      let b: number;
      let c: number;
      let d: number;
      switch (solid.type) {
        case TerrainEnum.Flat:
          a = 0; b = 1; c = 0; d = -solid.h1;
          break;
        case TerrainEnum.SlopeH: {
          const dh = solid.h2 - solid.h1;
          const len = solid.x2 - solid.x1;
          if (dh === 0 || len === 0) {
            a = 0; b = 1; c = 0; d = -solid.h1;
          } else {
            a = -dh; b = len; c = 0; d = solid.x1 * dh - solid.h1 * len;
          }
          break;
        }
        case TerrainEnum.SlopeV: {
          const dh = solid.h2 - solid.h1;
          const len = solid.z2 - solid.z1;
          if (dh === 0 || len === 0) {
            a = 0; b = 1; c = 0; d = -solid.h1;
          } else {
            a = 0; b = len; c = -dh; d = solid.z1 * dh - solid.h1 * len;
          }
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
        if (
          hit.x >= solid.x1 && hit.x <= solid.x2 &&
          hit.z >= solid.z1 && hit.z <= solid.z2
        ) {
          const seg_y = terrain_top(solid, hit.x, hit.z);
          // 单向平台：只从上方踩得到，从下方上穿时直接穿过
          const from_top = !passable || y1 >= seg_y - 1e-6;
          if (from_top && seg_y - y1 <= this.step) {
            // 计算参数 t（交点沿线段的比例）
            const dhx = hit.x - x1;
            const dhy = hit.y - y1;
            const dhz = hit.z - z1;
            const denom = dx * dx + dy * dy + dz * dz;
            const t = denom === 0 ? 0 : (dhx * dx + dhy * dy + dhz * dz) / denom;
            // 交点太靠近起点，说明角色已在表面上，跳过（如起跳、行走）
            if (t > 1e-6 && t < best_t) {
              best_t = t;
              this._intersect_result.x = hit.x;
              this._intersect_result.y = hit.y;
              this._intersect_result.z = hit.z;
            }
          }
        }
      }

      // 单向平台没有侧面碰撞
      if (passable) continue;

      // === 垂直墙面碰撞（不影响Y，保持垂直速度） ===
      // 左墙 x = solid.x1
      if (dx !== 0) {
        const t = (solid.x1 - x1) / dx;
        if (t > 0 && t < 1 && t < best_t) {
          const iz = z1 + t * dz;
          if (iz >= solid.z1 && iz <= solid.z2) {
            const iy = y1 + t * dy;
            const ty = terrain_top(solid, solid.x1, iz);
            if (ty - iy > this.step) {
              best_t = t;
              this._intersect_result.x = solid.x1 - 1;
              this._intersect_result.y = y2;
              this._intersect_result.z = iz;
            }
          }
        }
      }
      // 右墙 x = solid.x2
      if (dx !== 0) {
        const t = (solid.x2 - x1) / dx;
        if (t > 0 && t < 1 && t < best_t) {
          const iz = z1 + t * dz;
          if (iz >= solid.z1 && iz <= solid.z2) {
            const iy = y1 + t * dy;
            const ty = terrain_top(solid, solid.x2, iz);
            if (ty - iy > this.step) {
              best_t = t;
              this._intersect_result.x = solid.x2 + 1;
              this._intersect_result.y = y2;
              this._intersect_result.z = iz;
            }
          }
        }
      }
      // 远墙 z = solid.z1
      if (dz !== 0) {
        const t = (solid.z1 - z1) / dz;
        if (t > 0 && t < 1 && t < best_t) {
          const ix = x1 + t * dx;
          if (ix >= solid.x1 && ix <= solid.x2) {
            const iy = y1 + t * dy;
            const ty = terrain_top(solid, ix, solid.z1);
            if (ty - iy > this.step) {
              best_t = t;
              this._intersect_result.x = ix;
              this._intersect_result.y = y2;
              this._intersect_result.z = solid.z1 - 1;
            }
          }
        }
      }
      // 近墙 z = solid.z2
      if (dz !== 0) {
        const t = (solid.z2 - z1) / dz;
        if (t > 0 && t < 1 && t < best_t) {
          const ix = x1 + t * dx;
          if (ix >= solid.x1 && ix <= solid.x2) {
            const iy = y1 + t * dy;
            const ty = terrain_top(solid, ix, solid.z2);
            if (ty - iy > this.step) {
              best_t = t;
              this._intersect_result.x = ix;
              this._intersect_result.y = y2;
              this._intersect_result.z = solid.z2 + 1;
            }
          }
        }
      }
    }

    // 无碰撞时返回终点
    if (!isFinite(best_t)) {
      this._intersect_result.x = x2;
      this._intersect_result.y = y2;
      this._intersect_result.z = z2;
    }

    return [
      this._intersect_result,
      this.segment(this._intersect_result.x, this._intersect_result.z),
    ];
  }

  /**
   * 检查线段是否穿过阻挡地形的墙面（仅用于穿墙检测，不影响Y）
   *
   * @returns {{ x: number, z: number } | null} 碰撞点的XZ坐标，null表示未穿墙
   */
  intersect_wall(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
  ): { x: number; z: number } | null {
    if (!this.solids.length) return null;

    let best_t = Infinity;
    let best_x = 0;
    let best_z = 0;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;

    // 只有 XZ 有位移时才可能穿墙
    if (dx === 0 && dz === 0) return null;

    for (const solid of this.solids) {
      // 单向平台不参与穿墙检测（四周不阻拦）
      if (solid.mode === TerrainMode.OneWay || solid.mode === TerrainMode.Through)
        continue;

      // 快速跳过：地形整体高度都不足以阻挡
      const max_h = solid.h1 > solid.h2 ? solid.h1 : solid.h2;
      const min_y = y1 < y2 ? y1 : y2;
      if (max_h - min_y <= this.step) continue;

      // 左墙 x = solid.x1
      if (dx !== 0) {
        const t = (solid.x1 - x1) / dx;
        if (t > 0 && t < 1 && t < best_t) {
          const iz = z1 + t * dz;
          if (iz >= solid.z1 && iz <= solid.z2) {
            const iy = y1 + t * dy;
            const ty = terrain_top(solid, solid.x1, iz);
            if (ty - iy > this.step) {
              best_t = t;
              best_x = solid.x1 - 1;
              best_z = z2;
            }
          }
        }
      }
      // 右墙 x = solid.x2
      if (dx !== 0) {
        const t = (solid.x2 - x1) / dx;
        if (t > 0 && t < 1 && t < best_t) {
          const iz = z1 + t * dz;
          if (iz >= solid.z1 && iz <= solid.z2) {
            const iy = y1 + t * dy;
            const ty = terrain_top(solid, solid.x2, iz);
            if (ty - iy > this.step) {
              best_t = t;
              best_x = solid.x2 + 1;
              best_z = z2;
            }
          }
        }
      }
      // 远墙 z = solid.z1
      if (dz !== 0) {
        const t = (solid.z1 - z1) / dz;
        if (t > 0 && t < 1 && t < best_t) {
          const ix = x1 + t * dx;
          if (ix >= solid.x1 && ix <= solid.x2) {
            const iy = y1 + t * dy;
            const ty = terrain_top(solid, ix, solid.z1);
            if (ty - iy > this.step) {
              best_t = t;
              best_x = x2;
              best_z = solid.z1 - 1;
            }
          }
        }
      }
      // 近墙 z = solid.z2
      if (dz !== 0) {
        const t = (solid.z2 - z1) / dz;
        if (t > 0 && t < 1 && t < best_t) {
          const ix = x1 + t * dx;
          if (ix >= solid.x1 && ix <= solid.x2) {
            const iy = y1 + t * dy;
            const ty = terrain_top(solid, ix, solid.z2);
            if (ty - iy > this.step) {
              best_t = t;
              best_x = x2;
              best_z = solid.z2 + 1;
            }
          }
        }
      }
    }

    return isFinite(best_t) ? { x: best_x, z: best_z } : null;
  }

  private readonly _push_out: IPushOut = {
    x: 0, y: 0, z: 0, moved: false
  }

  /**
   * 向指定方向挤出
   */
  push_out(
    sx: number,
    sy: number,
    sz: number,
    vx: number,
    vy: number,
    vz: number,
    out: IPushOut = this._push_out,
  ): Readonly<IPushOut> {
    out.x = sx;
    out.y = sy;
    out.z = sz;
    out.moved = false;
    if (!this.is_inside(sx, sy, sz))
      return out;
    const len = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (len > 1e-6) {
      const ux = vx / len;
      const uy = vy / len;
      const uz = vz / len;

      const spans: ISpan[] = [];
      for (const solid of this.solids) {
        if (solid.mode !== TerrainMode.Solid) continue;

        const slab = rect_span(sx, sz, ux, uz, solid);
        if (!slab) continue;
        let enter = slab.enter;
        let exit = slab.exit;
        if (exit < 0) continue;
        if (enter < 0) enter = 0;

        const plane = solid_top_plane(solid);
        const slope = plane.kx * ux + plane.kz * uz;
        const ha = plane.c + plane.kx * sx + plane.kz * sz - EPS - sy;
        const hb = uy - slope;
        if (hb === 0) {
          if (ha <= 0) continue;
        } else {
          const ht = ha / hb;
          if (hb > 0) {
            if (ht < exit) exit = ht;
          } else if (ht > enter) {
            enter = ht;
          }
        }
        if (enter > exit) continue;
        spans.push({ enter, exit });
      }
      spans.sort((a, b) => a.enter - b.enter);

      let reach = 0;
      for (const span of spans) {
        if (span.enter > reach + PUSH_OUT_MARGIN) break;
        if (span.exit > reach) reach = span.exit;
      }

      if (reach < PUSH_OUT_MAX_TRAVEL) {
        const t = reach + PUSH_OUT_MARGIN;
        const x = sx + ux * t;
        const y = sy + uy * t;
        const z = sz + uz * t;
        if (!this.is_inside(x, y, z)) {
          out.x = x;
          out.y = y;
          out.z = z;
          out.moved = true;
          return out;
        }
      }
    }

    const surface = this.surface_at(sx, sz, { y: sy });
    if (surface.solid) {
      out.y = surface.y;
      out.moved = true;
    }
    return out;
  }
}
