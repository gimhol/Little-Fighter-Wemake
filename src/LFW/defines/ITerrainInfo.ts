import { fields, int } from "../fields";
import { make_schema } from "../utils";

export const enum TerrainEnum {
  /** 平地 */
  Flat = 0,
  /* X 轴方向的斜坡 */
  SlopeH = 1,
  /* Z 轴方向斜坡 */
  SlopeV = 2,
}

export interface ITerrainInfo {
  type: number;
  x1: number; // left
  x2: number; // right
  z1: number; // far
  z2: number; // near
  h1: number; // left-y or far-y
  h2: number; // right-y or near-y
}

export function terrain_info_new(): ITerrainInfo {
  return {
    type: 0,
    x1: 0,
    x2: 0,
    z1: 0,
    z2: 0,
    h1: 0,
    h2: 0
  };
}

export const terrain_info_fields = fields<ITerrainInfo>({
  type: int({
    options: [{
      value: TerrainEnum.Flat, label: 'Flat'
    }, {
      value: TerrainEnum.SlopeH, label: 'SlopeH'
    }, {
      value: TerrainEnum.SlopeV, label: 'SlopeV'
    }]
  }),
  x1: int,
  x2: int,
  z1: int,
  z2: int,
  h1: int,
  h2: int,
})
export const Schema_ITerrainInfo = make_schema<ITerrainInfo>({
  key: "ITerrainInfo",
  type: "object",
  properties: {
    type: {
      type: 'number',
      nullable: false,
      oneof: [
        TerrainEnum.Flat,
        TerrainEnum.SlopeH,
        TerrainEnum.SlopeV
      ]
    },
    x1: { type: "number", nullable: false, },
    x2: { type: "number", nullable: false, },
    z1: { type: "number", nullable: false, },
    z2: { type: "number", nullable: false, },
    h1: { type: "number", nullable: false, },
    h2: { type: "number", nullable: false, },
  },
})