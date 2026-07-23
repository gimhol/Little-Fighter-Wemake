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

  /** 旋转 */
  r?: number;
  /** 变换中心x */
  ox?: number;
  /** 变换中心y */
  oy?: number;

  __cos_r?: number;
  __sin_r?: number;
}

export const frame_picture_info_fields = fields<IFramePictureInfo>({
  tex: str('图片ID'),
  x: int('裁剪起点X坐标（像素）'),
  y: int('裁剪起点Y坐标（像素）'),
  w: int('宽度（像素）'),
  h: int('高度（像素）'),
  r: int({ nullable: true }),
  ox: int({ nullable: true }),
  oy: int({ nullable: true }),
});

export const Schema_IFramePictureInfo = make_schema<IFramePictureInfo>({
  key: 'IFramePictureInfo',
  type: 'object',
  properties: {
    tex: { type: "string", description: "图片ID" },
    x: { type: "number", description: "裁剪起点X坐标（像素）" },
    y: { type: "number", description: "裁剪起点Y坐标（像素）" },
    w: { type: "number", description: "宽度（像素）" },
    h: { type: "number", description: "高度（像素）" },
    r: { type: "number", nullable: true },
    ox: { type: "number", nullable: true },
    oy: { type: "number", nullable: true },
    __cos_r: { type: "number", nullable: true },
    __sin_r: { type: "number", nullable: true },
  },
});