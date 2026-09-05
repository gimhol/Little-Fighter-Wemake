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
const vec3_offset_fields = fields<IVec3Scale>({
  x: flt('X'),
  y: flt('Y'),
  z: flt('Z'),
});
const vec3_rotation_fields = fields<IVec3Scale>({
  x: flt('X'),
  y: flt('Y'),
  z: flt('Z'),
});

export interface IModelInfo {
  id: string;
  path: string;
  variants?: string[];
  /**
   * 任意旋转（欧拉角，弧度，缺省 0；three XYZ 顺序）。
   * 先应用本旋转，再叠加帧 model.rotation（作用于模型自身坐标系）。
   */
  rotation?: IVec3Scale;
  /** 缩放系数（x,y,z，缺省 1）；与帧 model.scale 同时存在时逐轴相乘 */
  scale?: IVec3Scale;
  /** 平移偏移（x,y,z，单位=游戏像素，y 向上为正）；与帧 model.offset 逐轴相加 */
  offset?: IVec3Scale;
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
  rotation: obj('旋转(弧度)', { nullable: true, fields: vec3_rotation_fields }),
  scale: obj('缩放', { nullable: true, fields: vec3_scale_fields }),
  offset: obj('偏移', { nullable: true, fields: vec3_offset_fields }),
});