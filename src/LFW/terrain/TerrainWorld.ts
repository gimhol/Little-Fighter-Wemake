import type { ITerrainInfo, IVector3Like } from "../defines";
import {
  TerrainMode,
  terrain_top,
  to_terrain_solids,
  type ITerrainSolid,
} from "./TerrainSolid";

export const TERRAIN_STEP = 10;
const EPS = 0.5;
const PUSH_OUT_STEP = 0.5;
const PUSH_OUT_MAX_STEPS = 512;
const PUSH_OUT_MAX_TRAVEL = 256;

export interface IPushOut {
  x: number;
  y: number;
  z: number;
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

  push_out(
    out: IPushOut,
    from: Readonly<IVector3Like>,
    to: Readonly<IVector3Like>,
  ): IPushOut {
    const sx = from.x;
    const sy = from.y;
    const sz = from.z;
    out.x = sx;
    out.y = sy;
    out.z = sz;
    out.moved = false;
    if (!this.is_inside(sx, sy, sz)) return out;

    const tx = to.x - sx;
    const tz = to.z - sz;
    const len = Math.sqrt(tx * tx + tz * tz);
    if (len > 1e-6) {
      const ux = tx / len;
      const uz = tz / len;
      let cur_x = sx;
      let cur_z = sz;
      let traveled = 0;
      while (traveled < PUSH_OUT_MAX_TRAVEL) {
        let prev = 0;
        let next = 0;
        let found = false;
        for (let i = 1; i <= PUSH_OUT_MAX_STEPS; ++i) {
          const d = i * PUSH_OUT_STEP;
          if (this.is_inside(cur_x + ux * d, sy, cur_z + uz * d)) {
            prev = d;
            continue;
          }
          next = d;
          found = true;
          break;
        }
        if (!found) break;
        for (let i = 0; i < 12; ++i) {
          const mid = (prev + next) / 2;
          if (this.is_inside(cur_x + ux * mid, sy, cur_z + uz * mid)) prev = mid;
          else next = mid;
        }
        const d = next + 1;
        cur_x += ux * d;
        cur_z += uz * d;
        traveled += d;
        if (!this.is_inside(cur_x, sy, cur_z)) {
          out.x = cur_x;
          out.z = cur_z;
          out.moved = true;
          return out;
        }
      }
    }

    out.y = this.surface_at(sx, sz, { y: sy }).y;
    out.moved = true;
    return out;
  }
}
