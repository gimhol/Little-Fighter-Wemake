export const enum TerrainEnum {
  Flat = 0,
  Slope = 1
}

export interface ITerrainInfo {
  id: number; // 自动生成?
  type: number;
  x1: number; // left
  x2: number; // right
  z1: number; // far
  z2: number; // near
  h00: number; // y at (x1, z1)
  h01: number; // y at (x1, z2)
  h10: number; // y at (x2, z1)
  h11: number; // y at (x2, z2)
}

export function terrain_info_new(): ITerrainInfo {
  return {
    id: 0,
    type: 0,
    x1: 0,
    x2: 0,
    z1: 0,
    z2: 0,
    h00: 0,
    h10: 0,
    h01: 0,
    h11: 0
  };
}