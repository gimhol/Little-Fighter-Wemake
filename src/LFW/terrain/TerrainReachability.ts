import { type ITerrainInfo, type IVector3Like } from "../defines";
import { terrain_top, TerrainMode, type ITerrainSolid } from "./TerrainSolid";

export type TerrainReachDir = "left" | "right" | "far" | "near" | "up" | "down";

export type TerrainReachKind = "move" | "jump" | "drop";

export interface ITerrainReachEdge {
  from: Readonly<ITerrainInfo>;
  to: Readonly<ITerrainInfo>;
  dir: TerrainReachDir;
  from_point: IVector3Like;
  to_point: IVector3Like;
  gap: number;
  dy: number;
  move: boolean;
  jump: boolean;
  drop: boolean;
}

export interface ITerrainReachOptions {
  step?: number;
  jump_rise?: number;
  jump_forward?: number;
  max_drop?: number;
}

export const DEFAULT_TERRAIN_REACH_OPTIONS: Required<ITerrainReachOptions> = {
  step: 10,
  jump_rise: 160,
  jump_forward: 140,
  max_drop: 480,
};

const EPS = 0.5;

export class TerrainReachability {
  readonly solids: readonly ITerrainSolid[];
  readonly options: Required<ITerrainReachOptions>;
  readonly edges: readonly ITerrainReachEdge[];

  private readonly _edges_of = new Map<Readonly<ITerrainInfo>, ITerrainReachEdge[]>();
  private readonly _seg_of = new Map<Readonly<ITerrainInfo>, ITerrainSolid>();

  constructor(solids: readonly ITerrainSolid[], options: ITerrainReachOptions = {}) {
    this.options = { ...DEFAULT_TERRAIN_REACH_OPTIONS, ...options };
    this.solids = solids.filter((v) => v.mode !== TerrainMode.Cliff);
    for (const solid of this.solids) this._seg_of.set(solid.source, solid);

    const edges: ITerrainReachEdge[] = [];
    for (const a of this.solids) {
      for (const b of this.solids) {
        if (a === b) continue;
        const edge = this._build_edge(a, b);
        if (!edge) continue;
        edges.push(edge);
        const list = this._edges_of.get(edge.from);
        if (list) list.push(edge);
        else this._edges_of.set(edge.from, [edge]);
      }
    }
    this.edges = edges;
  }

  /** `seg` 出发的所有可达关系 */
  edges_of(seg: Readonly<ITerrainInfo>): readonly ITerrainReachEdge[] {
    return this._edges_of.get(seg) ?? EMPTY_EDGES;
  }

  /** `seg` 在某类关系下的相邻段 */
  neighbors(
    seg: Readonly<ITerrainInfo>,
    kind: TerrainReachKind = "move",
  ): readonly Readonly<ITerrainInfo>[] {
    const ret: Readonly<ITerrainInfo>[] = [];
    for (const edge of this.edges_of(seg)) {
      if (edge[kind] && !ret.includes(edge.to)) ret.push(edge.to);
    }
    return ret;
  }

  /** 方向移动可达 */
  move_reachable(
    from: Readonly<ITerrainInfo>,
    to: Readonly<ITerrainInfo>,
    dir?: TerrainReachDir,
  ): boolean {
    return this._has(from, to, "move", dir);
  }

  /** 跳跃可达 */
  jump_reachable(
    from: Readonly<ITerrainInfo>,
    to: Readonly<ITerrainInfo>,
    dir?: TerrainReachDir,
  ): boolean {
    return this._has(from, to, "jump", dir);
  }

  /** 坠落可达 */
  drop_reachable(
    from: Readonly<ITerrainInfo>,
    to: Readonly<ITerrainInfo>,
    dir?: TerrainReachDir,
  ): boolean {
    return this._has(from, to, "drop", dir);
  }

  /** 是否可达（默认三种关系都算） */
  reachable(from: Readonly<ITerrainInfo>, to: Readonly<ITerrainInfo>): boolean {
    return this._has(from, to, "move") || this._has(from, to, "jump") ||
      this._has(from, to, "drop");
  }

  /**
   * 最短可达路径（BFS）
   *
   * @param {Readonly<ITerrainInfo>} from 起点段
   * @param {Readonly<ITerrainInfo>} to 终点段
   * @param {TerrainReachKind} [kind] 只走某一类关系；缺省三类都走
   * @returns {readonly ITerrainReachEdge[] | null} 边序列；不可达返回 null
   */
  path(
    from: Readonly<ITerrainInfo>,
    to: Readonly<ITerrainInfo>,
    kind?: TerrainReachKind,
  ): readonly ITerrainReachEdge[] | null {
    if (from === to) return [];
    if (!this._seg_of.has(from) || !this._seg_of.has(to)) return null;
    const prev = new Map<Readonly<ITerrainInfo>, ITerrainReachEdge>();
    const seen = new Set<Readonly<ITerrainInfo>>([from]);
    const queue: Readonly<ITerrainInfo>[] = [from];
    for (let i = 0; i < queue.length; ++i) {
      const cur = queue[i];
      for (const edge of this.edges_of(cur)) {
        if (kind && !edge[kind]) continue;
        if (seen.has(edge.to)) continue;
        seen.add(edge.to);
        prev.set(edge.to, edge);
        if (edge.to === to) {
          const ret: ITerrainReachEdge[] = [];
          let step: ITerrainReachEdge | undefined = edge;
          while (step) {
            ret.push(step);
            const from_seg: Readonly<ITerrainInfo> = step.from;
            if (from_seg === from) break;
            step = prev.get(from_seg);
          }
          return ret.reverse();
        }
        queue.push(edge.to);
      }
    }
    return null;
  }

  private _has(
    from: Readonly<ITerrainInfo>,
    to: Readonly<ITerrainInfo>,
    kind: TerrainReachKind,
    dir?: TerrainReachDir,
  ): boolean {
    for (const edge of this.edges_of(from)) {
      if (edge.to !== to) continue;
      if (!edge[kind]) continue;
      if (!dir || edge.dir === dir) return true;
    }
    return false;
  }

  private _build_edge(a: ITerrainSolid, b: ITerrainSolid): ITerrainReachEdge | null {
    const xo = min(a.x2, b.x2) - max(a.x1, b.x1);
    const zo = min(a.z2, b.z2) - max(a.z1, b.z1);

    let dir: TerrainReachDir;
    let gap = 0;
    let fx = 0, fy = 0, fz = 0;
    let tx = 0, ty = 0, tz = 0;

    if (zo >= EPS && b.x1 >= a.x2 - EPS) {
      dir = "right";
      gap = max(0, b.x1 - a.x2);
      const z = (max(a.z1, b.z1) + min(a.z2, b.z2)) / 2;
      [fx, fz] = [a.x2, z];
      [tx, tz] = [b.x1, z];
      fy = terrain_top(a, fx, fz);
      ty = terrain_top(b, tx, tz);
    } else if (zo >= EPS && a.x1 >= b.x2 - EPS) {
      dir = "left";
      gap = max(0, a.x1 - b.x2);
      const z = (max(a.z1, b.z1) + min(a.z2, b.z2)) / 2;
      [fx, fz] = [a.x1, z];
      [tx, tz] = [b.x2, z];
      fy = terrain_top(a, fx, fz);
      ty = terrain_top(b, tx, tz);
    } else if (xo >= EPS && b.z1 >= a.z2 - EPS) {
      dir = "near";
      gap = max(0, b.z1 - a.z2);
      const x = (max(a.x1, b.x1) + min(a.x2, b.x2)) / 2;
      [fx, fz] = [x, a.z2];
      [tx, tz] = [x, b.z1];
      fy = terrain_top(a, fx, fz);
      ty = terrain_top(b, tx, tz);
    } else if (xo >= EPS && a.z1 >= b.z2 - EPS) {
      dir = "far";
      gap = max(0, a.z1 - b.z2);
      const x = (max(a.x1, b.x1) + min(a.x2, b.x2)) / 2;
      [fx, fz] = [x, a.z1];
      [tx, tz] = [x, b.z2];
      fy = terrain_top(a, fx, fz);
      ty = terrain_top(b, tx, tz);
    } else if (xo >= EPS && zo >= EPS) {
      const x = (max(a.x1, b.x1) + min(a.x2, b.x2)) / 2;
      const z = (max(a.z1, b.z1) + min(a.z2, b.z2)) / 2;
      [fx, fy, fz] = [x, terrain_top(a, x, z), z];
      [tx, ty, tz] = [x, terrain_top(b, x, z), z];
      dir = ty - fy >= 0 ? "up" : "down";
    } else {
      return null;
    }

    const dy = ty - fy;

    const { step, jump_rise, jump_forward, max_drop } = this.options;
    const move = Math.abs(dy) <= step && gap <= step;
    const jump = dy > step
      ? dy <= jump_rise && gap <= jump_forward
      : gap > step && gap <= jump_forward && dy >= -max_drop;
    const drop = dy < -step && dy >= -max_drop && gap <= step;
    if (!move && !jump && !drop) return null;

    return {
      from: a.source,
      to: b.source,
      dir,
      from_point: { x: fx, y: fy, z: fz },
      to_point: { x: tx, y: ty, z: tz },
      gap,
      dy,
      move,
      jump,
      drop,
    };
  }
}

const EMPTY_EDGES: readonly ITerrainReachEdge[] = [];

function min(a: number, b: number): number {
  return a < b ? a : b;
}

function max(a: number, b: number): number {
  return a > b ? a : b;
}
