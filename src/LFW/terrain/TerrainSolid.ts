import { TerrainEnum, type ITerrainInfo } from "../defines";
import { clamp } from "../utils";

export const enum TerrainMode {
  Solid = 0,
  OneWay = 1,
  Through = 2,
  Cliff = 3,
}

export interface ITerrainSolid {
  id: string;
  x1: number;
  x2: number;
  z1: number;
  z2: number;
  h1: number;
  h2: number;
  type: number;
  mode: TerrainMode;
  source: Readonly<ITerrainInfo>;
}

export function terrain_mode_of(seg: Readonly<ITerrainInfo>): TerrainMode {
  if (seg.cliff) return TerrainMode.Cliff;
  if (seg.through) return TerrainMode.Through;
  if (seg.one_way) return TerrainMode.OneWay;
  return TerrainMode.Solid;
}

export function terrain_top(solid: Readonly<ITerrainSolid>, x: number, z: number): number {
  switch (solid.type) {
    case TerrainEnum.SlopeH: {
      if (solid.x1 === solid.x2) return solid.h1;
      const t = (clamp(x, solid.x1, solid.x2) - solid.x1) / (solid.x2 - solid.x1);
      return solid.h1 + t * (solid.h2 - solid.h1);
    }
    case TerrainEnum.SlopeV: {
      if (solid.z1 === solid.z2) return solid.h1;
      const t = (clamp(z, solid.z1, solid.z2) - solid.z1) / (solid.z2 - solid.z1);
      return solid.h1 + t * (solid.h2 - solid.h1);
    }
    default:
      return solid.h1;
  }
}

export function to_terrain_solids(
  terrain: readonly ITerrainInfo[] | undefined,
): ITerrainSolid[] {
  if (!terrain?.length) return [];
  const ret: ITerrainSolid[] = [];
  for (const seg of terrain) {
    ret.push({
      id: seg.id ?? "",
      x1: seg.x1,
      x2: seg.x2,
      z1: seg.z1,
      z2: seg.z2,
      h1: seg.h1,
      h2: seg.h2,
      type: seg.type,
      mode: terrain_mode_of(seg),
      source: seg,
    });
  }
  return ret;
}
