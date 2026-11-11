import { TerrainEnum, type ITerrainInfo } from "../defines";
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
  readonly source: readonly ITerrainInfo[] | undefined;
  readonly solids: readonly ITerrainSolid[];
  private readonly buckets: ITerrainSolid[][];
  private readonly bucket_origin: number;

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
      step = TERRAIN_STEP,
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
        } else if (solid.mode === TerrainMode.Through && drop_through) {
          if (y <= top + EPS && y >= top - step) continue;
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
