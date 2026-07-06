import img_error from "@/assets/error.png";
import img_white from "@/assets/white.png";
import { MagnificationTextureFilter } from "@/LFW/defines/MagnificationTextureFilter";
import { MinificationTextureFilter } from "@/LFW/defines/MinificationTextureFilter";
import { TextureWrapping } from "@/LFW/defines/TextureWrapping";
import type { IImageInfo } from "@/LFW/ditto/image/IImageInfo";
import { TextInfo } from "@/LFW/ditto/image/TextInfo";
import type { LFW } from "../../LFW";
import type { ILegacyPictureInfo } from "../../LFW/defines/ILegacyPictureInfo";
import type { IPicture } from "../../LFW/defines/IPicture";
import type { IPictureInfo } from "../../LFW/defines/IPictureInfo";
import type { IStyle } from "../../LFW/defines/IStyle";
import type { IImageMgr, ImageOperation } from "../../LFW/ditto/image/IImageMgr";
import { validate_ui_img_operation_crop } from "../../LFW/loader/validate_ui_img_operation_crop";
import { is_positive_int, max, round } from "../../LFW/utils";
import { create_img_ele } from "../../Utils/create_img_ele";
import { get_blob } from "../../Utils/get_blob";
import * as T from "../_t";
import { AsyncValuesKeeper } from "../AsyncValuesKeeper";
import { RImageInfo } from "../RImageInfo";
import { handle_image_operation_crop, handle_image_operation_flip, handle_image_operation_mask, handle_image_operation_resize } from "./handle_image_operation";
export class ImageMgr implements IImageMgr {
  static readonly TextureLoader = new T.TextureLoader();
  static readonly ERROR_TEXTURE: Readonly<T.Texture<HTMLImageElement>> = ImageMgr.TextureLoader.load(img_error)
  static readonly WHITE_TEXTURE: Readonly<T.Texture<HTMLImageElement>> = ImageMgr.TextureLoader.load(img_white);
  static readonly EMPTY_TEXTURE: Readonly<T.Texture<HTMLImageElement>> = ImageMgr.TextureLoader.load("");

  /** Safari < 16.4 不支持 OffscreenCanvas.transferToImageBitmap */
  private static readonly CAN_TRANSFER: boolean =
    typeof OffscreenCanvas !== 'undefined' &&
    typeof (OffscreenCanvas.prototype as any).transferToImageBitmap === 'function';

  protected pictures = new Map<string, IPicture>();
  protected infos = new AsyncValuesKeeper<RImageInfo>();
  protected disposables = new Map<string, RImageInfo>();
  readonly lfw: LFW;
  constructor(lfw: LFW) { this.lfw = lfw; }

  private async create_img_info(key: string, src: string, operations?: ImageOperation[]): Promise<RImageInfo> {
    const disposable = src.startsWith('?');
    if (disposable) src = src.substring(1)

    const exact = src.startsWith('!');
    if (exact) src = src.substring(1)

    const vaild_operations = operations?.filter(v => {
      switch (v.type) {
        case "mask": return true;
        case "crop":
          const errors: string[] = []
          const ok = validate_ui_img_operation_crop(v, errors);
          if (errors.length) console.warn(errors)
          return ok
        case "resize":
          if (!is_positive_int(v.w)) return false
          if (!is_positive_int(v.h)) return false
          return true;
        case "flip":
          return v.x || v.y;
      }
    });

    // 无图片操作：优先使用 ImageBitmap 路径（减少 Blob 创建，支持零拷贝 GPU 上传）
    if (!vaild_operations?.length) {
      try {
        const [bitmap, src_url] = await this.lfw.import_image_bitmap(src, exact);
        const scale = this.get_img_scale(src_url);
        const ret = new RImageInfo({
          key,
          src,
          url: '', // ImageBitmap 不需要 blob URL
          src_url,
          scale,
          w: bitmap.width,
          h: bitmap.height,
          bitmap,
        });
        if (disposable) this.add_disposable(ret)
        return ret;
      } catch {
        // ImageBitmap 解码失败时，回退到 blob URL + Image 元素路径
      }
    }

    // 有图片操作：也优先 ImageBitmap 作为源，最终产出 ImageBitmap
    if (vaild_operations?.length) {
      try {
        const [bitmap, src_url] = await this.lfw.import_image_bitmap(src, exact);
        const scale = this.get_img_scale(src_url);

        // 将 ImageBitmap 转为带属性的 Canvas，供操作管线使用
        const src_cvs = document.createElement('canvas');
        src_cvs.width = bitmap.width;
        src_cvs.height = bitmap.height;
        src_cvs.setAttribute('src-url', src_url);
        src_cvs.setAttribute('scale', '' + scale);
        src_cvs.getContext('2d')!.drawImage(bitmap, 0, 0);
        bitmap.close();

        let cvs: HTMLCanvasElement | null = null;
        for (const op of vaild_operations) cvs = this.edit_image(cvs || src_cvs, op);

        // Canvas → ImageBitmap（Safari 15+ 支持 createImageBitmap）
        const result = await createImageBitmap(cvs!);

        const ret = new RImageInfo({
          key, src, url: '', src_url, scale,
          w: result.width, h: result.height, bitmap: result,
        });
        if (disposable) this.add_disposable(ret);
        return ret;
      } catch {
        // ImageBitmap 解码失败时，回退到 blob URL + Image 元素路径
      }
    }

    // 回退路径：blob URL + Image 元素（无操作或 ImageBitmap 失败时）
    {
      const [blob_url, src_url] = await this.lfw.import_resource(src, exact);
      const img = await create_img_ele(blob_url);
      img.setAttribute('src-url', src_url)

      const scale = this.get_img_scale(src_url);
      img.setAttribute('scale', '' + scale)

      if (!vaild_operations?.length) {
        const ret = new RImageInfo({
          key, src,
          url: blob_url, src_url, scale,
          w: img.width, h: img.height,
        });
        if (disposable) this.add_disposable(ret)
        return ret;
      }

      let cvs: HTMLCanvasElement | null = null;
      for (const op of vaild_operations) cvs = this.edit_image(cvs || img, op)

      const blob = await get_blob(cvs!).catch((e) => {
        const err = new Error(e.message + " key:" + key);
        Object.assign(err, { cause: e.cause })
        throw err
      });
      const url = URL.createObjectURL(blob);
      const ret = new RImageInfo({ key, url, src_url, scale, w: cvs!.width, h: cvs!.height });
      if (disposable) this.add_disposable(ret);
      return ret;
    }
  }

  private get_img_scale(src_url: string): number {
    return max(1,
      Number(
        src_url.match(/@(\d)[x|X](.png|.webp)$/)?.[1] ??
        src_url.match(/@(\d)[x|X]\/(.*)(.png|.webp)$/)?.[1]
      ) || 1
    )
  }

  private add_disposable(ret: RImageInfo) {
    this.disposables.set(ret.key, ret);
    if (this.disposables.size > 1000) {
      const { value } = this.disposables.keys().next();
      if (value) {
        this.disposables.delete(value);
        this.infos.del(value);
      }
    }
  }

  find(key: string): RImageInfo | undefined {
    return this.infos.get(key);
  }

  measure_text(text: string, style?: IStyle | null): TextInfo {
    const s = style || {};
    const { scale = 2 } = s;
    const cvs = document.createElement('canvas');
    const ctx = cvs.getContext('2d')!;
    apply_text_style(s, ctx);
    const [, w, h] = split_text_to_lines(text, ctx, s);
    return new TextInfo({ text, style: s, w: scale * w, h: scale * h, scale });
  }

  load_img(key: string, src: string, operations?: ImageOperation[]): Promise<RImageInfo> {
    const fn = async () => {
      this.lfw.emit_progress(`${key}`, 0);
      const info = await this.create_img_info(key, src, operations);
      info.pic = await this.p_create_picture(info);
      return info;
    };
    return this.infos.fetch(key, fn);
  }

  del(key: string) {
    const img = this.infos.del(key);
    if (!img) return;
    if (img.url.startsWith("blob:")) URL.revokeObjectURL(img.url);
    if (img.bitmap) { img.bitmap.close(); img.bitmap = null; }
    return;
  }

  protected _gen_key = (f: ILegacyPictureInfo | IPictureInfo) => {
    if ('row' in f)
      return `${f.path}#${f.cell_w || 0}_${f.cell_h || 0}_${f.row}_${f.col}`;
    return f.path;
  }

  async load_by_pic_info(f: ILegacyPictureInfo | IPictureInfo): Promise<RImageInfo> {
    const key = this._gen_key(f);
    return this.load_img(key, f.path);
  }
  find_by_pic_info(f: IPictureInfo | ILegacyPictureInfo): RImageInfo | undefined {
    return this.infos.get(this._gen_key(f));
  }

  private edit_image(src: HTMLCanvasElement | HTMLImageElement, op: ImageOperation): HTMLCanvasElement {
    switch (op.type) {
      case 'mask': return handle_image_operation_mask(src, op);
      case 'crop': return handle_image_operation_crop(src, op);
      case 'resize': return handle_image_operation_resize(src, op);
      case 'flip': return handle_image_operation_flip(src, op);
    }
  }

  /** 翻转 ImageBitmap，兼容 Safari < 16.4 */
  private flip_bitmap(bitmap: ImageBitmap): ImageBitmap | HTMLCanvasElement {
    const w = bitmap.width, h = bitmap.height;
    if (ImageMgr.CAN_TRANSFER) {
      const off = new OffscreenCanvas(w, h);
      const ctx = off.getContext('2d')!;
      ctx.translate(0, h);
      ctx.scale(1, -1);
      ctx.drawImage(bitmap, 0, 0);
      return off.transferToImageBitmap();
    }
    // Safari < 16.4：回退 DOM Canvas
    const cvs = document.createElement('canvas');
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext('2d')!;
    ctx.translate(0, h);
    ctx.scale(1, -1);
    ctx.drawImage(bitmap, 0, 0);
    return cvs;
  }

  create_picture(
    img_info: IImageInfo,
    onLoad?: (data: IPicture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void): IPicture {
    const {
      url, w, h, bitmap,
      min_filter = MinificationTextureFilter.Nearest,
      mag_filter = MagnificationTextureFilter.Nearest,
      wrap_s = TextureWrapping.MirroredRepeat,
      wrap_t = TextureWrapping.MirroredRepeat,
      scale
    } = img_info;

    const ret: IPicture = {
      id: img_info.key,
      w: w / scale,
      h: h / scale,
      texture: ImageMgr.EMPTY_TEXTURE.clone()
    };

    // ImageBitmap 路径：直接创建纹理，跳过 TextureLoader 和 DOM Image 元素
    if (bitmap) {
      const flipped = this.flip_bitmap(bitmap);
      bitmap.close();

      // ImageBitmap 由 del() 统一 close；Canvas 无需清理
      img_info.bitmap = flipped instanceof ImageBitmap ? flipped : null;

      // 已翻转，不再依赖 UNPACK_FLIP_Y_WEBGL
      ret.texture = new T.Texture(flipped as any);
      ret.texture.flipY = false;
      ret.texture.needsUpdate = true;
      ret.texture.colorSpace = T.SRGBColorSpace;
      ret.texture.minFilter = min_filter;
      ret.texture.magFilter = mag_filter;
      ret.texture.wrapS = wrap_s;
      ret.texture.wrapT = wrap_t;
      onLoad?.(ret);
      return ret;
    }

    ret.texture = ImageMgr.TextureLoader.load(url, (t) => {
      ret.texture = t
      t.needsUpdate = true;
      onLoad?.(ret)
    }, onProgress, onError);
    ret.texture.colorSpace = T.SRGBColorSpace;
    ret.texture.minFilter = min_filter;
    ret.texture.magFilter = mag_filter;
    ret.texture.wrapS = wrap_s;
    ret.texture.wrapT = wrap_t;
    return ret;
  }
  p_create_picture(
    img_info: IImageInfo,
    onProgress?: (event: ProgressEvent) => void
  ): Promise<IPicture> {
    return new Promise((resolve, reject) => {
      this.create_picture(img_info, resolve, onProgress, reject)
    })
  }
}
interface ITextLineInfo {
  x: number;
  y: number;
  t: string;
  w: number;
  h: number;
}
function split_text_to_lines(text: string, ctx: CanvasRenderingContext2D, style: IStyle): [ITextLineInfo[], number, number] {
  let w = 0
  let h = 0;
  const { padding_l = 2, padding_r = 2, padding_t = 2, padding_b = 2 } = style
  const lines = text.split("\n").map<ITextLineInfo>((line, idx, arr) => {
    const t = idx === arr.length ? line + "\n" : line;
    const {
      width, fontBoundingBoxAscent: a, fontBoundingBoxDescent: d,
    } = ctx.measureText(t);
    const ret = {
      x: 0,
      y: h + a,
      t,
      w: width,
      h: a + d
    };
    w = max(w, width);
    h += ret.h;
    ret.h += a + d;
    return ret;
  });
  w += padding_l + padding_r
  h += padding_t + padding_b
  if (style.text_align === "center") for (const l of lines) l.x = round(w / 2);
  if (style.text_align === "right") for (const l of lines) l.x = round(w);
  return [lines, w, h];
}

function apply_text_style(style: IStyle, ctx: CanvasRenderingContext2D) {
  ctx.font = style.font ?? "normal 9px system-ui";
  ctx.fillStyle = style.fill_style ?? "white";
  ctx.strokeStyle = style.stroke_style ?? "";
  ctx.lineWidth = style.line_width ?? 0;
  ctx.textAlign = style.text_align ?? "left";
  ctx.shadowColor = style.shadow_color ?? "";
  ctx.shadowBlur = style.shadow_color ? style.shadow_blur ?? 0 : 0;
  ctx.shadowOffsetX = style.shadow_color ? style.shadow_offset_x ?? 0 : 0;
  ctx.shadowOffsetY = style.shadow_color ? style.shadow_offset_y ?? 0 : 0;
  ctx.imageSmoothingEnabled = style.smoothing ?? false;

}
