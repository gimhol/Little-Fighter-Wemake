import type { IPicture } from "../../defines/IPicture";
import { MagnificationTextureFilter } from "../../defines/MagnificationTextureFilter";
import { MinificationTextureFilter } from "../../defines/MinificationTextureFilter";
import { TextureWrapping } from "../../defines/TextureWrapping";
import type { IImageInfo } from "./IImageInfo";

export class ImageInfo<T = any> implements IImageInfo {
  key: string = '';
  url: string = '';
  src: string = '';
  src_url: string = '';
  scale: number = 0;
  w: number = 0;
  h: number = 0;
  min_filter?: MinificationTextureFilter;
  mag_filter?: MagnificationTextureFilter;
  wrap_s?: TextureWrapping;
  wrap_t?: TextureWrapping;
  pic?: IPicture<T>;
  flip_x?: boolean;
  flip_y?: boolean;
  clip_x?: number;
  clip_y?: number;
  clip_w?: number;
  clip_h?: number;
  bitmap?: ImageBitmap | null;
  constructor(o?: Partial<IImageInfo>) {
    if (o) Object.assign(this, o)
    if (o?.pic) this.pic = Object.assign({}, o.pic)
  }
  merge(o: Partial<IImageInfo>): this {
    Object.assign(this, o)
    if (o?.pic) this.pic = Object.assign({}, o.pic)
    return this
  }
  clone(): ImageInfo<T> {
    return new ImageInfo<T>(this)
  }
}
