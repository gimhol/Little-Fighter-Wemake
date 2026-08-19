import type { LFW } from "@/LFW";
import { parse_rgba } from "@/LFW";
import type { IStyle } from "@/LFW/defines/IStyle";
import { max, round } from "@/LFW/utils";
import { BufferGeometry, CanvasTexture, Mesh } from "three";
import { MaterialFactory, MaterialKind, MeshFactory } from "../factory";
import { get_static_plane_geometry } from "../GeometryKeeper";
import { BLACK, TextMaterial } from "../materials";

const TEXT_GEOMETRY = get_static_plane_geometry(1, 1);
const DEFAULT_FONT = "9px Arial";

interface ITextLineInfo { x: number; y: number; t: string; w: number; h: number; }

function split_text_to_lines(text: string, ctx: CanvasRenderingContext2D, style: IStyle): [ITextLineInfo[], number, number] {
  let w = 0, h = 0;
  const { padding_l = 0, padding_r = 0, padding_t = 0, padding_b = 0 } = style;
  const lines = text.split("\n").map<ITextLineInfo>((line, idx, arr) => {
    const t = idx === arr.length - 1 ? line : line + "\n";
    const { width, fontBoundingBoxAscent: a, fontBoundingBoxDescent: d } = ctx.measureText(t);
    const ret = { x: 0, y: h + a, t, w: width, h: a + d };
    w = max(w, width);
    h += ret.h;
    return ret;
  });
  w += padding_l + padding_r;
  h += padding_t + padding_b;
  if (style.text_align === "center") for (const l of lines) l.x = round(w / 2);
  if (style.text_align === "right") for (const l of lines) l.x = round(w);
  return [lines, w, h];
}

function draw_underline(style: IStyle, ctx: CanvasRenderingContext2D, lines: ITextLineInfo[]) {
  const { underline_color, underline_width } = style;
  if (!underline_width) return;
  const { padding_l = 0, padding_t = 0 } = style;
  ctx.strokeStyle = underline_color ?? style.fill_style ?? "white";
  ctx.lineWidth = underline_width;
  for (const { x, y, w } of lines) {
    ctx.beginPath();
    ctx.moveTo(padding_l + x, padding_t + y + underline_width + 1);
    ctx.lineTo(padding_l + x + w, padding_t + y + underline_width + 1);
    ctx.stroke();
  }
}

function need_stroke(style: IStyle): boolean {
  if (!style.stroke_style) return false;
  if (!style.line_width || style.line_width < 0) return false;
  return !!parse_rgba(style.stroke_style)?.a;
}

function need_fill(style: IStyle): boolean {
  if (!style.fill_style) return true;
  return !!parse_rgba(style.fill_style)?.a;
}

function apply_text_style(style: IStyle, ctx: CanvasRenderingContext2D) {
  ctx.font = style.font ?? DEFAULT_FONT;
  ctx.fillStyle = style.fill_style ?? "white";
  ctx.strokeStyle = style.stroke_style ?? "";
  ctx.lineWidth = style.line_width ?? 0;
  ctx.textAlign = (style.text_align ?? "left") as CanvasTextAlign;
  ctx.shadowColor = style.shadow_color ?? "";
  ctx.shadowBlur = style.shadow_color ? (style.shadow_blur ?? 0) : 0;
  ctx.shadowOffsetX = style.shadow_color ? (style.shadow_offset_x ?? 0) : 0;
  ctx.shadowOffsetY = style.shadow_color ? (style.shadow_offset_y ?? 0) : 0;
  ctx.imageSmoothingEnabled = style.smoothing ?? false;
}

export class TextMesh extends Mesh<BufferGeometry, TextMaterial> {
  static get(): TextMesh {
    return MeshFactory.get('SmallText', TextMesh)
  }
  static KIND = 'SmallText'
  static create = () => new TextMesh()
  static reset = (inst: TextMesh) => inst.reset()

  protected _fillStyle: string = '';
  protected _strokeStyle: string = '';
  protected _text: string = '';
  protected _canvas: HTMLCanvasElement;
  protected _ctx: CanvasRenderingContext2D;
  protected _texture: CanvasTexture;
  protected _style: IStyle = {};
  protected _style_version: number = 0;
  protected _baked_text: string = '';
  protected _baked_style_version: number = -1;
  /** 文字逻辑尺寸（含 padding），用于 centering / 布局 */
  protected _text_w: number = 0;
  protected _text_h: number = 0;

  constructor() {
    const m = MaterialFactory.get(MaterialKind.Text, TextMaterial);
    super(TEXT_GEOMETRY, m);
    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d')!;
    this._texture = new CanvasTexture(this._canvas);
    this.material.texture = this._texture;
  }

  reset(): void {
    this._text = '';
    this._fillStyle = '';
    this._strokeStyle = '';
    this._style = {};
    this._style_version = 0;
    this._baked_text = '';
    this._baked_style_version = -1;
    this._text_w = 0;
    this._text_h = 0;
    this._texture.dispose();
    const canvas = document.createElement('canvas');
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d')!;
    this._texture = new CanvasTexture(canvas);
    this.material.texture = this._texture;
    this.material.mixStrength = 0;
    this.material.mixColor = BLACK;
    this.material.outlineAlpha = 0;
    this.material.outlineWidth = 0;
    this.material.outlineColor = BLACK;
  }

  get text(): string { return this._text; }
  get text_w(): number { return this._text_w; }
  get text_h(): number { return this._text_h; }

  get style(): IStyle { return this._style; }
  set style(v: IStyle) {
    this._style = v || {};
    this._style_version++;
    // 完整样式烘焙：颜色/描边已画入画布，关闭材质染色/描边
    if (Object.keys(this._style).length > 0) {
      this.material.mixStrength = 0;
      this.material.outlineAlpha = 0;
      this.material.outlineWidth = 0;
    }
    if (this._text) this._draw_text();
  }
  set_style(v: IStyle): this {
    this.style = v;
    return this;
  }

  get fillStyle() { return this._fillStyle }
  set fillStyle(v: string) {
    this._fillStyle = v
    this.material.mixStrength = v ? 1 : 0;
    this.material.mixColor = v ? v : BLACK
  }

  get strokeStyle() { return this._strokeStyle }
  set strokeStyle(v: string) {
    this._strokeStyle = v
    this.material.outlineAlpha = v ? 1 : 0;
    this.material.outlineWidth = v ? 1 : 0;
    this.material.outlineColor = v ? v : BLACK;
    if (this._text) this._draw_text();
  }

  async set_text(_lfw: LFW, text: string): Promise<this> {
    if (this._text === text && this._baked_text === text && this._baked_style_version === this._style_version)
      return this;
    this._text = text;
    this._draw_text();
    this.material.texture = this._texture;
    this.material.needsUpdate = true;
    return this;
  }

  protected _draw_text(): void {
    if (Object.keys(this._style).length > 0) {
      this._draw_styled();
    } else {
      this._draw_plain();
    }
  }

  /** 简单模式：白色文字 + 材质染色/描边（实体名字等） */
  protected _draw_plain(): void {
    const { _canvas, _ctx } = this;
    if (!this._text) {
      if (this._baked_text === '') return;
      this._baked_text = '';
      this._baked_style_version = this._style_version;
      this._text_w = 0;
      this._text_h = 0;
      _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
      this._texture.needsUpdate = true;
      this.scale.set(1, 1, 1);
      return;
    }
    this._baked_text = this._text;
    this._baked_style_version = this._style_version;

    _ctx.font = DEFAULT_FONT;
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'alphabetic';
    _ctx.imageSmoothingEnabled = false;

    const metrics = _ctx.measureText(this._text);
    const tw = Math.max(1, Math.ceil(metrics.width));
    const th = Math.max(1, Math.ceil(metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent));
    this._text_w = tw;
    this._text_h = th;

    const pad = this.material.outlineWidth;
    const cw = tw + 2 * pad;
    const ch = th + 2 * pad;

    if (_canvas.width !== cw || _canvas.height !== ch) {
      _canvas.width = cw;
      _canvas.height = ch;
      this._texture.dispose();
      this._texture = new CanvasTexture(_canvas);
    }

    _ctx.font = DEFAULT_FONT;
    _ctx.fillStyle = 'white';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.imageSmoothingEnabled = false;

    _ctx.clearRect(0, 0, cw, ch);
    _ctx.fillText(this._text, pad, pad);

    this.scale.x = cw;
    this.scale.y = ch;
    this._texture.needsUpdate = true;
  }

  /** 完整样式烘焙：font/多行/padding/HiDPI scale/对齐/阴影/下划线/填充/描边（UI 文本） */
  protected _draw_styled(): void {
    const { _canvas, _ctx } = this;
    const text = this._text;
    if (!text) {
      if (this._baked_text === '') return;
      this._baked_text = '';
      this._baked_style_version = this._style_version;
      this._text_w = 0;
      this._text_h = 0;
      _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
      this._texture.needsUpdate = true;
      this.scale.set(1, 1, 1);
      return;
    }
    this._baked_text = text;
    this._baked_style_version = this._style_version;

    const style = this._style;
    const scale = style.scale || 1;
    const { padding_l = 0, padding_t = 0, padding_r = 0, padding_b = 0 } = style;

    _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    apply_text_style(style, _ctx);

    const [lines, w, h] = split_text_to_lines(text, _ctx, style);
    this._text_w = w;
    this._text_h = h;

    const cw = Math.max(1, scale * w);
    const ch = Math.max(1, scale * h);

    if (_canvas.width !== cw || _canvas.height !== ch) {
      _canvas.width = cw;
      _canvas.height = ch;
      this._texture.dispose();
      this._texture = new CanvasTexture(_canvas);
      // 画布尺寸变化会重置状态，需重新应用样式
      apply_text_style(style, _ctx);
    }

    _ctx.save();
    _ctx.scale(scale, scale);

    const fill = style.fill_style ?? 'white';
    const nf = need_fill(style);
    const ns = need_stroke(style);

    if (nf || ns) {
      apply_text_style(style, _ctx);
      if (nf) _ctx.fillStyle = fill;
      for (const { x, y, t } of lines) {
        if (nf) _ctx.fillText(t, padding_l + x, padding_t + y);
        if (ns) _ctx.strokeText(t, padding_l + x, padding_t + y);
      }
      draw_underline(style, _ctx, lines);
    }

    _ctx.restore();

    // 逻辑尺寸（含 padding）作为 mesh 缩放；canvas 提供 HiDPI 分辨率
    this.scale.x = w;
    this.scale.y = h;
    this._texture.needsUpdate = true;
  }
}

MeshFactory.register(TextMesh)