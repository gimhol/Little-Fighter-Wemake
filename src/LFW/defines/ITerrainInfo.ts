export const enum TerrainEnum {
  Flat = 0,
  SlopeH = 1,
  SlopeV = 2,
}

export interface ITerrainInfo {
  id: number; // 自动生成?
  type: number;
  x1: number; // left
  x2: number; // right
  z1: number; // far
  z2: number; // near
  h1: number; // y
  h2: number; // y
}

export function terrain_info_new(): ITerrainInfo {
  return {
    id: 0,
    type: 0,
    x1: 0,
    x2: 0,
    z1: 0,
    z2: 0,
    h1: 0,
    h2: 0
  };
}