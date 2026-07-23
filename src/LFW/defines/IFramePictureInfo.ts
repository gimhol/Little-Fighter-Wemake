import { fields, int, str } from "../fields";
import { make_schema } from "../utils/schema/make_schema";

export interface IFramePictureInfo {
  /** 图片ID */
  tex: string;
  /** 裁剪起点X坐标（像素） */
  x: number;
  /** 裁剪起点Y坐标（像素） */
  y: number;
  /** 宽度（像素） */
  w: number;
  /** 高度（像素） */
  h: number;
}

export const frame_picture_info_fields = fields<IFramePictureInfo>({
  tex: str('图片ID'),
  x: int('裁剪起点X坐标（像素）'),
  y: int('裁剪起点Y坐标（像素）'),
  w: int('宽度（像素）'),
  h: int('高度（像素）'),
});

export const Schema_IFramePictureInfo = make_schema<IFramePictureInfo>({
  key: 'IFramePictureInfo',
  type: 'object',
  properties: {
    tex: { type: "string", description: "图片ID" },
    x: { type: "number", description: "裁剪起点X坐标（像素）" },
    y: { type: "number", description: "裁剪起点Y坐标（像素）" },
    w: { type: "number", description: "宽度（像素）" },
    h: { type: "number", description: "高度（像素）" }
  },
});