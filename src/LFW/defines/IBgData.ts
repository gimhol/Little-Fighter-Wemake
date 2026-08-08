import { any, fields, str } from "../fields";
import { make_schema } from "../utils/schema";
import { bg_info_new, type IBgInfo } from "./IBgInfo";
import { Schema_IBgLayerInfo, type IBgLayerInfo } from "./IBgLayerInfo";
import { Schema_ITerrainInfo, type ITerrainInfo } from "./ITerrainInfo";
import { Schema_IWorldDataset_Partial, type IWorldDataset } from "./IWorldDataset";
export interface IBgData {
  id: string;
  alias_id?: string;
  base: IBgInfo;
  type: "background";
  dataset?: Partial<IWorldDataset>;
  layers?: IBgLayerInfo[];
  terrain?: ITerrainInfo[];
}

export const bg_data_fields = fields<IBgData>({
  id: str("ID"),
  alias_id: str("别名ID"),
  type: str("类型"),
  base: any,
  dataset: any,
  layers: any,
  terrain: any
});

export function bg_data_new(): IBgData {
  return {
    type: "background",
    id: "",
    base: bg_info_new(),
    layers: [],
  };
}


export const Schema_IBgData = make_schema<IBgData>({
  key: "IBgData",
  type: "object",
  properties: {
    id: { type: 'string' },
    type: { type: 'string', oneof: ['background'] },
    alias_id: { type: 'string', nullable: true },
    base: Schema_IWorldDataset_Partial,
    dataset: { type: 'object', nullable: true },
    layers: { type: 'array', items: Schema_IBgLayerInfo, nullable: true },
    terrain: { type: 'array', items: Schema_ITerrainInfo, nullable: true }
  },
});