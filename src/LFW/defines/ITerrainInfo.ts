import { fields, bool, int, str } from "../fields";
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
  id?: string,
  name?: string,
  type: number;
  x1: number; // left
  x2: number; // right
  z1: number; // far
  z2: number; // near
  h1: number; // left-y or far-y
  h2: number; // right-y or near-y
  /**
   * 单向平台
   *
   * 四周不阻挡、允许物体从其下方通过，只有从上方落下（或本来就站在顶面）时才踩在顶面上；
   * 不填等同于普通实心地形。
   */
  one_way?: boolean;
  /**
   * 悬崖（极低地形）
   *
   * 触发“坠崖”
   */
  cliff?: boolean;
  /** 坠崖时进入的帧ID（缺省 = 角色的受伤帧） */
  cliff_frame?: string;
  /** 坠崖后从多高重生（缺省 = 背景高度 bg.height） */
  cliff_respawn_y?: number;
}

export function terrain_info_new(): ITerrainInfo {
  return {
    type: 0,
    x1: 0,
    x2: 0,
    z1: 0,
    z2: 0,
    h1: 0,
    h2: 0,
    one_way: false,
    cliff: false,
  };
}

export const terrain_info_fields = fields<ITerrainInfo>({
  id: str,
  name: str,
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
  one_way: bool,
  cliff: bool,
  cliff_frame: str,
  cliff_respawn_y: int,
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
    name: { type: "string", nullable: true, },
    id: { type: "string", nullable: true, },
    x1: { type: "number", nullable: false, },
    x2: { type: "number", nullable: false, },
    z1: { type: "number", nullable: false, },
    z2: { type: "number", nullable: false, },
    h1: { type: "number", nullable: false, },
    h2: { type: "number", nullable: false, },
    one_way: { type: "boolean", nullable: true, },
    cliff: { type: "boolean", nullable: true, },
    cliff_frame: { type: "string", nullable: true, },
    cliff_respawn_y: { type: "number", nullable: true, },
  },
})