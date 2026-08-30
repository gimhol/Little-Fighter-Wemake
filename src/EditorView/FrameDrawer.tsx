import { type IRect, Resizable, Shape, ShapeData } from "@fimagine/writeboard";
import { type IBdyInfo, type ICpoint, type IFrameInfo, type IFramePic, type IItrInfo, type IOpointInfo, type IWpointInfo } from "../LFW/defines";
import type { IEntityData } from "../LFW/defines/IEntityData";
import type { IZip } from "../LFW/ditto";
import { loop_arr } from "../LFW/utils/array/loop_arr";
import { EditorShapeEnum } from "./EditorShapeEnum";
import { img_map } from "./FrameEditorView";

export class FrameDrawerData extends ShapeData {
  img?: HTMLImageElement;
  frame?: IFrameInfo;
  data?: IEntityData;
  zip?: IZip;
  constructor(o?: Partial<FrameDrawerData>) {
    super()
    this.type = EditorShapeEnum.LF2_FRAME
    if (o) this.read(o)
  }
  override read(o: Partial<FrameDrawerData>): this {
    super.read(o);
    this.img = o.img;
    this.frame = o.frame;
    this.data = o.data;
    this.zip = o.zip;
    return this;
  }
}

export class FrameDrawer extends Shape<FrameDrawerData> {
  constructor(data: Partial<FrameDrawerData>) {
    super(data, FrameDrawerData)
  }
  static get_size(f: IFrameInfo) {
    const { pic: { w = 0, h = 0 } = {} } = f;
    const { l, r, t, b } = this.get_bounding(f)
    return { w: w - l + r, h: h - t + b }
  }
  static get_bounding(f: IFrameInfo) {
    const { pic = { w: 0, h: 0 } } = f;
    let l = 0;
    let t = 0;
    let r = 0;
    let b = 0;
    const check_rect = ({ x, y, w, h }: IRect) => {
      l = Math.min(x, l);
      t = Math.min(y, t);
      r = Math.max((x + w) - pic.w, r);
      b = Math.max((y + h) - pic.h, b);
    };
    const check_vec2 = ({ x = 0, y = 0 }: { x?: number, y?: number }) => {
      x -= 20;
      y -= 20
      l = Math.min(x, l);
      t = Math.min(y, t);
      r = Math.max((x + 40) - pic.w, r);
      b = Math.max((y + 40) - pic.h, b);
    };

    check_vec2({ x: f.centerx, y: f.centery })
    // if (f.bdy) loop_arr(f.bdy, bdy => check_rect(bdy))
    // if (f.itr) loop_arr(f.itr, itr => check_rect(itr))
    if (f.opoint) loop_arr(f.opoint, opoint => check_vec2(opoint))
    if (f.cpoint) check_vec2(f.cpoint);
    if (f.bpoint) check_vec2(f.bpoint)

    l += 0;
    t += 0;
    r += 0;
    b += 0;
    return { l, r, t, b };
  }
  override get resizable(): Resizable {
    return Resizable.None;
  }
  draw_center(ctx: CanvasRenderingContext2D, frame: IFrameInfo) {
    const { centerx, centery } = frame;
    ctx.beginPath();
    ctx.moveTo(centerx, centery + 2);
    ctx.lineTo(centerx - 2, centery);
    ctx.lineTo(centerx, centery - 2);
    ctx.lineTo(centerx + 2, centery);
    ctx.closePath();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'black';
    ctx.fillStyle = 'white';
    ctx.stroke();
    ctx.fill();
  }
  draw_bdy(ctx: CanvasRenderingContext2D, bdy: IBdyInfo) {
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    const { x = 0, y = 0, w = 0, h = 0 } = bdy
    ctx.rect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.closePath();
    ctx.stroke();
  }
  draw_itr(ctx: CanvasRenderingContext2D, itr: IItrInfo) {
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.lineDashOffset = 2;
    const { x = 0, y = 0, w = 0, h = 0 } = itr
    ctx.rect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.closePath();
    ctx.stroke();
  }
  draw_cpoint(ctx: CanvasRenderingContext2D, cpoint: ICpoint) {
    ctx.beginPath();
    const { x = 0, y = 0 } = cpoint;
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x - 2, y);
    ctx.lineTo(x, y - 2);
    ctx.lineTo(x + 2, y);
    ctx.closePath();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'black';
    ctx.fillStyle = 'yellow';
    ctx.stroke();
    ctx.fill();
    ctx.strokeText('' + cpoint.kind, x + 2, y - 2)
    ctx.fillText('' + cpoint.kind, x + 2, y - 2)
  }
  draw_wpoint(ctx: CanvasRenderingContext2D, point: IWpointInfo) {
    ctx.beginPath();
    const { x, y } = point;
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x - 2, y);
    ctx.lineTo(x, y - 2);
    ctx.lineTo(x + 2, y);
    ctx.closePath();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'black';
    ctx.fillStyle = 'green';
    ctx.stroke();
    ctx.fill();
  }
  draw_opoint(ctx: CanvasRenderingContext2D, point: IOpointInfo) {
    ctx.beginPath();
    const { x, y } = point;
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x - 2, y);
    ctx.lineTo(x, y - 2);
    ctx.lineTo(x + 2, y);
    ctx.closePath();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'black';
    ctx.fillStyle = 'red';
    ctx.stroke();
    ctx.fill();
    ctx.textAlign = 'center'
    ctx.font = 'light 9px serif'
    ctx.strokeText('' + point.oid, x + 2, y - 5)
    ctx.fillText('' + point.oid, x + 2, y - 5)
  }
  draw_frame_bound(ctx: CanvasRenderingContext2D, pic: IFramePic) {
    ctx.strokeStyle = '#FFFFFFaa';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.rect(0.5, 0.5, pic.w - 1, pic.h - 1);
    ctx.closePath();
    ctx.stroke();
  }
  get_img(zip: IZip, data: IEntityData, tex: string): Promise<HTMLImageElement> {
    const { base: { files = {} } } = data;
    const pic = files[tex];
    if (!pic) {
      return Promise.reject(new Error('pic not found: ' + tex))
    }
    const img = this.data.img = img_map.get(pic.path) || new Image();
    if (!img_map.has(pic.path)) {
      img_map.set(pic.path, img);
      zip.file(pic.path)?.blob_url().then((r) => {
        img.src = r;
      })
    }
    return new Promise<HTMLImageElement>((resolve, reject) => {
      let remain = 0;
      const resolving = () => {
        if (img.width && img.height) {
          resolve(img)
        } else if (remain <= 5) {
          ++remain;
          setTimeout(() => resolving(), remain * 10)
        } else {
          reject(new Error('width or height got zero'))
        }
      }
      if (img.complete) {
        resolving()
        return;
      }
      const on_load = () => {
        resolving()
        img.removeEventListener('load', on_load);
        img.removeEventListener('error', on_error);
      }
      const on_error = (e: ErrorEvent) => {
        reject(new Error(e.message))
        img.removeEventListener('load', on_load);
        img.removeEventListener('error', on_error);
      }
      img.addEventListener('load', on_load, { once: true });
      img.addEventListener('error', on_error, { once: true });
    })
  }

  override render(ctx: CanvasRenderingContext2D): void {
    this.beginDraw(ctx);
    ctx.scale(2, 2);
    const { frame, data, zip } = this.data;
    if (!this.data.img && frame?.pic?.tex && data && zip) {
      this.get_img(zip, data, frame.pic.tex).then((img) => {
        this.beginDirty()
        this.data.img = img;
        this.endDirty()
      })
    }
    const { img } = this.data;
    if (frame) {

      const { l, t } = FrameDrawer.get_bounding(frame);
      ctx.translate(-l, -t);
      const { pic } = frame;
      if (pic) this.draw_frame_bound(ctx, pic);
      if (img && pic) ctx.drawImage(img, pic.x, pic.y, pic.w, pic.h, 0, 0, pic.w, pic.h);
      if (frame.itr) loop_arr(frame.itr, itr => this.draw_itr(ctx, itr))
      if (frame.bdy) loop_arr(frame.bdy, bdy => this.draw_bdy(ctx, bdy))
      if (frame.opoint) loop_arr(frame.opoint, opoint => this.draw_opoint(ctx, opoint))
      if (frame.cpoint) this.draw_cpoint(ctx, frame.cpoint);
      if (frame.wpoint) this.draw_wpoint(ctx, frame.wpoint);
      this.draw_center(ctx, frame);
    }
    this.endDraw(ctx);

    super.render(ctx)
  }
}
