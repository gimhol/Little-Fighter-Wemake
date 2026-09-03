import { fields, flt, obj, str } from "../fields";

export interface IVec3Scale {
  x?: number;
  y?: number;
  z?: number;
}
const vec3_scale_fields = fields<IVec3Scale>({
  x: flt('X'),
  y: flt('Y'),
  z: flt('Z'),
});

export interface IModelInfo {
  id: string;
  path: string;
  variants?: string[];
  scale?: IVec3Scale;
}
export function model_info_new(): IModelInfo {
  const ret: IModelInfo = {
    id: "",
    path: ""
  }
  return ret
}
export const model_info_fields = fields<Partial<IModelInfo>>({
  id: str('模型ID'),
  path: str('路径'),
  variants: str('变体', { array: true }),
  scale: obj('缩放', { nullable: true, fields: vec3_scale_fields }),
});