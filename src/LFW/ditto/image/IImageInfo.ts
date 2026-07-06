import type { IPicture } from "../../defines/IPicture";
import type { MagnificationTextureFilter } from "../../defines/MagnificationTextureFilter";
import type { MinificationTextureFilter } from "../../defines/MinificationTextureFilter";
import type { TextureWrapping } from "../../defines/TextureWrapping";

export interface IImageInfo {
  key: string;
  url: string;
  src_url: string;

  /**
   * 图片缩放倍数
   * 
   * 比如有一张hello@4X.png，缩放倍数为4
   *
   * @type {number}
   * @memberof IImageInfo
   */
  scale: number;

  /**
   * 原始图片宽度（像素） 
   *
   * @type {number}
   * @memberof IImageInfo
   */
  w: number;

  /**
   * 原始图片高度（像素）
   *
   * @type {number}
   * @memberof IImageInfo
   */
  h: number;

  min_filter?: MinificationTextureFilter;
  mag_filter?: MagnificationTextureFilter;
  wrap_s?: TextureWrapping;
  wrap_t?: TextureWrapping;

  flip_x?: boolean;
  flip_y?: boolean;
  pic?: IPicture;

  clip_x?: number;
  clip_y?: number;
  clip_w?: number;
  clip_h?: number;

  /**
   * ImageBitmap 源（优先于 url 用于创建纹理）
   * 为 null 时回退到 url + TextureLoader 路径
   */
  bitmap?: ImageBitmap | null;
}
