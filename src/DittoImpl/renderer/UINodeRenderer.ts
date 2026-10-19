import { parse_rgba, TextInfo } from "@/LFW";
import { ImageInfo } from "@/LFW/ditto/image/ImageInfo";
import type { IUINodeRenderer } from "@/LFW/ditto/render/IUINodeRenderer";
import { TextInput } from "@/LFW/ui/component/TextInput";
import type { INinePatch, IUIImgInfo } from "@/LFW/ui/IUIImgInfo.dat";
import type { UINode } from "@/LFW/ui/UINode";
import { is_num, is_str, round } from "@/LFW/utils";
import * as T from "../_t";
import { CSS2DObject, SRGBColorSpace } from "../_t";
import { ImageMgr } from "../ImageMgr";
import { MaterialFactory, MaterialKind } from "./factory/MaterialFactory";
import { get_ninepatch_geometry, get_plane_geometry, get_static_plane_geometry } from "./GeometryKeeper";
import { BLACK, OutlineMaterial, type IUIClipRect } from "./materials/OutlineMaterial";
import styles from "./ui_node_style.module.scss";
import { UITextRenderer } from "./UITextRenderer";
import type { WorldRenderer } from "./WorldRenderer";
/** 平滑时间常数(ms)：约一帧(60fps)，每帧都移动、无停顿，避免 30UPS/60FPS 下 df 复位造成的抖动 */
const SMOOTH_TAU = 1000 / 60;

let clip_version = 0;

interface IUserData {
  w?: number;
  h?: number;
  t_x?: number,
  t_y?: number,
  t_z?: number,
  ui_img?: IUIImgInfo,
  img?: ImageInfo<T.Texture> | null,
  nine_patch?: INinePatch,
}
export class UINodeRenderer implements IUINodeRenderer {
  mesh: T.Mesh<T.BufferGeometry, OutlineMaterial>;

  ui: UINode;
  protected _css_obj: CSS2DObject | undefined;
  protected _dom: HTMLDivElement | undefined;
  protected _ui_img?: IUIImgInfo;
  protected _geo = get_static_plane_geometry(0, 0, 0, 0, 0);
  protected _color: string | null = null;
  protected _input: HTMLInputElement | undefined;
  protected _txt: TextInfo<any> | null = null;
  protected _img: ImageInfo<T.Texture> | null = null;
  protected _text_renderer: UITextRenderer | undefined;
  protected _uv_anim_angle: number = 0;
  protected _p1 = new T.Vector3();
  protected _s1 = new T.Vector3(1, 1, 1);
  protected _old_alpha: number | null = null;
  protected _last_sync_lifetime = -1;
  protected _bg_layer_proxy: T.Object3D | undefined;
  protected _frame_rect: IUIClipRect | null = null;
  protected readonly _v_tmp = new T.Vector3();
  protected _mx = NaN;
  protected _my = NaN;
  protected _mz = NaN;
  protected _sx = NaN;
  protected _sy = NaN;
  protected _sz = NaN;
  protected _clip_children_last: boolean | undefined = void 0;
  protected _clip_ver = -1;
  protected _clip_empty = true;
  protected readonly _clip_cache = { x0: 0, y0: 0, x1: 0, y1: 0 };
  protected readonly _clip_applied = { x0: 0, y0: 0, x1: 0, y1: 0 };
  protected _clip_applied_empty = false;
  protected _clip_text_done = false;

  protected get dom() {
    if (this._dom) return this._dom;
    this._dom = document.createElement('div');
    this._dom.className = styles.ui_node_style
    this._css_obj = new CSS2DObject(this._dom);
    this._css_obj.position.set(0, 0, 0);
    this._css_obj.center.set(0, 1);

    const txt = this.ui.text
    if (txt?.style.font) this.dom.style.font = txt.style.font;
    if (txt?.style.fill_style) this.dom.style.color = txt.style.fill_style;
    this.mesh.add(this._css_obj);
    return this._dom;
  }
  protected release_dom() {
    if (!this._css_obj) return;
    this.mesh.remove(this._css_obj);
    delete this._css_obj;
    delete this._dom;
    delete this._input
  }
  protected hide_dom() {
    if (!this._css_obj) return;
    if (!this._css_obj.parent) return;
    this.mesh.remove(this._css_obj);
  }
  protected show_dom() {
    if (!this._css_obj) return;
    if (this._css_obj.parent) return;
    this.mesh.add(this._css_obj);
  }
  get world() { return this.ui.lfw.world }
  get lfw() { return this.ui.lfw }
  get parent() { return this.ui.parent?.renderer || null }
  constructor(ui: UINode) {
    this.ui = ui;
    this.mesh = new T.Mesh(
      this.next_geometry(),
      MaterialFactory.get(MaterialKind.Outline, OutlineMaterial)
    )
    this.mesh.name = `UINodeMesh`;
    this.mesh.material.alpha = 0;
    this.mesh.material.texture = void 0;
    this.mesh.userData.owner = ui;
    this.mesh.matrixAutoUpdate = false;

    if (ui.text) {
      this._text_renderer = new UITextRenderer(this);
      this.mesh.add(this._text_renderer.mesh);
    }
  }
  del(child: UINodeRenderer) {
    this.mesh.remove(child.mesh)
    clip_version++;
  }
  add(child: UINodeRenderer) {
    this.mesh.add(child.mesh)
    clip_version++;
  }
  del_self() {
    this.mesh.removeFromParent();
  }
  on_resume(): void {
    if (this.ui.root === this.ui) this.attach_ui_layer();
    const text_input = this.ui.find_component(TextInput)
    if (text_input) {
      const ele_input = this._input = document.createElement('input');
      ele_input.id = this.ui.id ? `text_input_${this.ui.id}` : "text_input"
      const { maxLength, defaultValue, text, placeholder } = text_input
      if (is_num(maxLength)) ele_input.maxLength = maxLength
      else ele_input.removeAttribute('maxLength')
      if (is_str(defaultValue)) ele_input.defaultValue = defaultValue
      else ele_input.removeAttribute('defaultValue')
      if (is_str(placeholder)) ele_input.placeholder = placeholder
      ele_input.value = text
      ele_input.style.textAlign = text_input.node.style.text_align || 'left'
      ele_input.style.padding = '0 6px'
      ele_input.style.boxSizing = 'border-box'
      ele_input.onchange = () => text_input.text = ele_input.value
      ele_input.onkeydown = (e) => {
        if (e.key !== 'Enter') return;
        text_input.text = ele_input.value;
        text_input.on_submit?.();
        e.preventDefault();
      }
      ele_input.onfocus = () => text_input.node.focused = true
      ele_input.onblur = () => text_input.node.focused = false
      this.dom.appendChild(ele_input)
    }
  }

  get_input_value(): string {
    if (this._input) return this._input.value;
    return this.ui.find_component(TextInput)?.text ?? '';
  }

  set_input_value(value: string): void {
    const text_input = this.ui.find_component(TextInput);
    if (text_input) text_input.text = value;
    if (this._input) this._input.value = value;
  }

  set_input_placeholder(value: string): void {
    if (this._input) this._input.placeholder = value;
  }

  focus_input(): void {
    this._input?.focus();
  }

  on_pause(): void {
    if (this.ui.root === this.ui) this.detach_ui_layer();
    const text_input = this.ui.find_component(TextInput)
    if (text_input) this.release_dom()
  }

  protected attach_ui_layer(): void {
    const wr = this.lfw.world.renderer as WorldRenderer;
    if ((this.ui.z ?? 0) < 0) {
      wr.ui_bg_container.add(this.mesh);
      return;
    }
    wr.ui_fg_container.add(this.mesh);
    const bg = this._bg_layer_proxy ?? (this._bg_layer_proxy = new T.Object3D());
    let has_bg_child = false;
    for (const child of this.ui.children) {
      const r = child.renderer;
      if (!(r instanceof UINodeRenderer)) continue;
      if ((child.z ?? 0) >= 0) continue;
      bg.add(r.mesh);
      has_bg_child = true;
    }
    if (!has_bg_child) return;
    bg.position.copy(this.mesh.position);
    bg.scale.copy(this.mesh.scale);
    bg.quaternion.copy(this.mesh.quaternion);
    wr.ui_bg_container.add(bg);
  }

  protected detach_ui_layer(): void {
    this.mesh.removeFromParent();
    this._bg_layer_proxy?.removeFromParent();
  }

  on_show(): void {
    this.mesh.visible = true;
    this.show_dom();
  }

  on_hide(): void {
    this.mesh.visible = false;
    this.hide_dom();
  }
  on_start() {
    this.update_center_and_size()
    const { x, y, z } = this.ui;
    this.mesh.position.set(x, -y, z)
    this.mesh.updateMatrix()
    this.update_pos_scale()
    this.mesh.visible = this.ui.visible;
    this.mesh.name = `layout(name= ${this.ui.name}, id=${this.ui.id})`
    this.apply();
    this.ui.parent?.renderer.add(this);
  }
  on_stop() {
    this.del_self()
    this.release_dom();
  }

  apply() {
    const { mesh: sp } = this;
    sp.geometry = this.next_geometry();
    const t = sp.material.texture
    const { material: m } = sp;
    const { uniforms: u } = m;
    const i = this.ui.image;
    if (t && i) {
      const {
        w, h, scale,
        clip_x = 0,
        clip_y = 0,
        clip_w = this.ui.data.img?.dw ?? w / scale,
        clip_h = this.ui.data.img?.dh ?? h / scale
      } = i
      m.set_origin_size(
        w,
        h,
      )
      m.set_origin_scale(
        scale * t.repeat.x,
        scale * t.repeat.y,
      )
      m.set_clip(
        (clip_x + t.offset.x * clip_w / t.repeat.x) % (w / scale),
        (clip_y + t.offset.y * clip_h / t.repeat.y) % (h / scale),
        clip_w,
        clip_h,
      )
    }
    if (u.tex.value !== t) {
      u.tex.value?.dispose();
      u.tex.value = t;
    }
    if (this._old_alpha == null) {
      this._old_alpha = m.alpha = this.ui.global_opacity;
    } else {
      const a = m.alpha + (this.ui.global_opacity - m.alpha) * 0.5
      this._old_alpha = m.alpha = a;
    }
    if (this._text_renderer)
      this._text_renderer.mesh.material.alpha = m.alpha;
    return this;
  }

  update_txt() {
    if (this._txt === this.ui.text) return;
    this._txt = this.ui.text;
    if (this.ui.text) {
      if (!this._text_renderer) {
        this._text_renderer = new UITextRenderer(this);
        this.mesh.add(this._text_renderer.mesh);
        this._clip_text_done = false;
      }
      this._text_renderer.update();
    }
  }

  update_img() {
    if (
      this._txt === this.ui.text &&
      this._img === this.ui.image &&
      this._color === this.ui.color
    ) return;

    const img = this.ui.image;
    this._ui_img = this.ui.data.img;
    this._img = img;
    const rgba = parse_rgba(this.ui.color)
    if (img) {
      this.mesh.material.texture = img.pic?.texture;
      this.mesh.material.coverColor = BLACK;
      this.mesh.material.coverStength = 0;
      this.mesh.material.cover = false
      this.mesh.material.mixColor = rgba ? new T.Color().setRGB(rgba.r / 255, rgba.g / 255, rgba.b / 255, SRGBColorSpace) : BLACK;
      this.mesh.material.mixStrength = rgba?.a ?? 0;
    } else if (rgba) {
      this.mesh.material.texture = ImageMgr.WHITE_TEXTURE.clone();
      this.mesh.material.coverColor = new T.Color().setRGB(rgba.r / 255, rgba.g / 255, rgba.b / 255, SRGBColorSpace);
      this.mesh.material.coverStength = rgba.a;
      this.mesh.material.cover = true
      this.mesh.material.mixColor = BLACK;
      this.mesh.material.mixStrength = 0;
    } else {
      this.mesh.material.texture = void 0
      this.mesh.material.coverColor = BLACK;
      this.mesh.material.coverStength = 0;
      this.mesh.material.cover = true
      this.mesh.material.mixColor = BLACK;
      this.mesh.material.mixStrength = 0;
    }
  }
  get x(): number { return this.mesh.position.x }
  set x(v: number) { this.mesh.position.x = v; this.mesh.updateMatrix(); }
  get y(): number { return this.mesh.position.y }
  set y(v: number) { this.mesh.position.y = v; this.mesh.updateMatrix(); }
  get visible() {
    return this.mesh.visible
  }
  set visible(v: boolean) {
    this.mesh.visible = v
    if (v) this.show_dom(); else this.hide_dom()
  }
  protected _tran_x: number = 0;
  protected _tran_y: number = 0;
  protected _tran_z: number = 0;
  protected _w: number = 0;
  protected _h: number = 0;
  readonly user_data: IUserData = {}

  is_geo_changed(): boolean {
    const { _w, _h, _tran_x, _tran_y, _tran_z, _img } = this;
    const _nine_path = this._ui_img?.nine_patch
    const { w, h, t_x, t_y, t_z, nine_patch, img } = this.user_data;
    return _w != w || _h != h || t_x != _tran_x || t_y != _tran_y ||
      t_z != _tran_z || _nine_path != nine_patch || _img != img
  }
  protected next_geometry(): T.BufferGeometry {
    if (!this.is_geo_changed()) return this._geo;
    const { _w: w, _h: h, _tran_x, _tran_y, _tran_z, _ui_img: ui_img, _img: img } = this;
    const nine_patch = ui_img?.nine_patch;
    if (ui_img && nine_patch && img) {
      this._geo = get_ninepatch_geometry({
        ...nine_patch, w, h, tx: _tran_x, ty: _tran_y, tz: _tran_z, t_s: 1 / img.scale
      })
    } else {
      this._geo = get_plane_geometry({ w, h, tx: _tran_x, ty: _tran_y, tz: _tran_z });
    }
    this.user_data.img = img
    this.user_data.nine_patch = nine_patch
    this.user_data.w = w;
    this.user_data.h = h;
    this.user_data.t_x = _tran_x;
    this.user_data.t_y = _tran_y;
    this.user_data.t_z = _tran_z;
    this.user_data.nine_patch = nine_patch;
    return this._geo;
  }

  update_center_and_size() {
    const { w, h } = this.ui;
    const { x, y, z } = this.ui.center
    this._w = w;
    this._h = h;
    this._tran_x = round(w * (0.5 - x));
    this._tran_y = round(h * (y - 0.5));
    this._tran_z = round(z);
  }
  update_dom() {
    if (this._dom) {
      this._dom.style.width = `${this._w}px`;
      this._dom.style.height = `${this._h}px`;
    }
    if (this._css_obj)
      this._css_obj.center.set(this.ui.center.x, this.ui.center.y);
  }
  protected update_pos_scale() {
    const { pos, scale } = this.ui;
    const tx = pos.x, ty = -pos.y, tz = pos.z;
    const sx = scale.x, sy = scale.y, sz = scale.z;
    if (
      tx === this._p1.x && ty === this._p1.y && tz === this._p1.z &&
      sx === this._s1.x && sy === this._s1.y && sz === this._s1.z
    ) return;
    this._p1.set(tx, ty, tz);
    this._s1.set(sx, sy, sz);
  }

  update_texture_attributes(dt: number) {
    const t = this.mesh.material.texture;
    if (!t || !this._ui_img) return;
    const { offsetAnimX = 0, offsetAnimY = 0, offsetAnimR = 0 } = this._ui_img;
    const { wrapS, wrapT, repeatX, repeatY } = this._ui_img;
    if (!offsetAnimX && !offsetAnimY && !offsetAnimR &&
      wrapS === void 0 && wrapT === void 0 && repeatX === void 0 && repeatY === void 0) return;
    const sec = dt / 1000;
    if (offsetAnimR) this._uv_anim_angle += sec * offsetAnimR;
    if (offsetAnimX || offsetAnimY) {
      const angle = this._uv_anim_angle;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      t.offset.x += sec * (offsetAnimX * cos - offsetAnimY * sin);
      t.offset.y += sec * (offsetAnimX * sin + offsetAnimY * cos);
    }
    if (wrapS !== void 0) t.wrapS = (wrapS as any);
    if (wrapT !== void 0) t.wrapT = (wrapT as any);
    if (repeatX !== void 0) t.repeat.setX(repeatX);
    if (repeatY !== void 0) t.repeat.setY(repeatY);
  }

  render(dt: number, df: number) {
    const { ui } = this;
    this.mesh.visible = ui.visible
    this.update_texture_attributes(dt)
    this.update_pos_scale();
    const t = 1 - Math.exp(-dt / SMOOTH_TAU);
    this.mesh.position.lerp(this._p1, t);
    this.mesh.scale.lerp(this._s1, t);
    this.update_matrix_if_changed();

    if (this.world.lifetime !== this._last_sync_lifetime) {
      this._last_sync_lifetime = this.world.lifetime;
      this.sync();
    }

    if (this._clip_children_last !== ui.clip_children) {
      this._clip_children_last = ui.clip_children;
      clip_version++;
    }
    this.apply_clip(this.compute_effective_clip());
    if (ui.clip_children) this.update_frame_rect();

    for (const child of ui.children) {
      if (child.visible || (child.visible != child.renderer.visible))
        child.renderer.render(dt, df)
    }
  }

  protected update_matrix_if_changed(): void {
    const p = this.mesh.position, s = this.mesh.scale;
    if (p.x === this._mx && p.y === this._my && p.z === this._mz &&
      s.x === this._sx && s.y === this._sy && s.z === this._sz) return;
    this._mx = p.x; this._my = p.y; this._mz = p.z;
    this._sx = s.x; this._sy = s.y; this._sz = s.z;
    this.mesh.updateMatrix();
  }

  quad_world_rect(): IUIClipRect | null {
    return this.update_frame_rect();
  }

  effective_clip_rect(refresh: boolean = false): IUIClipRect | null {
    if (!refresh && this._clip_ver === clip_version)
      return this._clip_empty ? null : this._clip_cache;
    let has = false;
    let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
    let p = this.ui.parent;
    while (p) {
      if (p.clip_children) {
        const r = refresh
          ? (p.renderer as UINodeRenderer).update_frame_rect()
          : (p.renderer as UINodeRenderer)._frame_rect;
        if (r) {
          if (!has) {
            has = true;
            x0 = r.x0; y0 = r.y0; x1 = r.x1; y1 = r.y1;
          } else {
            if (r.x0 > x0) x0 = r.x0;
            if (r.y0 > y0) y0 = r.y0;
            if (r.x1 < x1) x1 = r.x1;
            if (r.y1 < y1) y1 = r.y1;
            if (x0 >= x1 || y0 >= y1) has = false;
          }
        }
      }
      p = p.parent;
    }
    this._clip_ver = clip_version;
    this._clip_empty = !has;
    if (!has) return null;
    const c = this._clip_cache;
    c.x0 = x0; c.y0 = y0; c.x1 = x1; c.y1 = y1;
    return c;
  }

  protected apply_clip(clip: IUIClipRect | null): void {
    const a = this._clip_applied;
    const same = clip
      ? !this._clip_applied_empty && a.x0 === clip.x0 && a.y0 === clip.y0 && a.x1 === clip.x1 && a.y1 === clip.y1
      : this._clip_applied_empty;
    if (same && (!this._text_renderer || this._clip_text_done)) return;
    if (!same) {
      this._clip_applied_empty = !clip;
      if (clip) {
        a.x0 = clip.x0; a.y0 = clip.y0; a.x1 = clip.x1; a.y1 = clip.y1;
      }
      this.mesh.material.set_clip_rect(clip);
    }
    if (this._text_renderer) {
      this._text_renderer.mesh.material.set_clip_rect(clip);
      this._clip_text_done = true;
    }
  }

  protected update_frame_rect(): IUIClipRect | null {
    const { _w: w, _h: h, _tran_x: tx, _tran_y: ty } = this;
    if (!(w > 0) || !(h > 0)) {
      if (this._frame_rect) {
        this._frame_rect = null;
        clip_version++;
      }
      return null;
    }
    this.mesh.updateWorldMatrix(true, false);
    const m = this.mesh.matrixWorld;
    const v = this._v_tmp;
    const x0 = tx - w / 2;
    const y0 = ty - h / 2;
    const x1 = tx + w / 2;
    const y1 = ty + h / 2;
    v.set(x0, y0, 0).applyMatrix4(m);
    let minX = v.x, minY = v.y, maxX = v.x, maxY = v.y;
    v.set(x1, y0, 0).applyMatrix4(m);
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
    v.set(x0, y1, 0).applyMatrix4(m);
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
    v.set(x1, y1, 0).applyMatrix4(m);
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
    const cur = this._frame_rect;
    if (cur) {
      if (cur.x0 === minX && cur.y0 === minY && cur.x1 === maxX && cur.y1 === maxY) return cur;
      cur.x0 = minX; cur.y0 = minY; cur.x1 = maxX; cur.y1 = maxY;
    } else {
      this._frame_rect = { x0: minX, y0: minY, x1: maxX, y1: maxY };
    }
    clip_version++;
    return this._frame_rect;
  }

  protected compute_effective_clip(): IUIClipRect | null {
    return this.effective_clip_rect(false);
  }

  protected sync() {
    const { ui } = this;
    this.update_center_and_size()
    this.update_dom();
    this.update_img();
    this.update_txt();
    const { background, backgroundAlpha, foreground, foregroundAlpha } = ui
    this.mesh.material.bgColor = background;
    this.mesh.material.bgAlpha = backgroundAlpha;
    this.mesh.material.fgColor = foreground;
    this.mesh.material.fgAlpha = foregroundAlpha;
    this.mesh.material.outlineWidth = ui.outlineWidth || 0;
    this.mesh.material.outlineColor = ui.outlineColor || 0
    this.mesh.material.outlineAlpha = ui.outlineAlpha || 0
    this.apply()
    if (this._dom) {
      this._dom.style.opacity = '' + this.mesh.material.alpha
      if (this._input) {
        const font_size = this.ui.find_component(TextInput)?.fontSize;
        if (is_num(font_size)) {
          this._input.style.fontSize = `${font_size}px`;
          this._input.style.lineHeight = 'normal';
        } else {
          this._input.style.fontSize = this._dom.style.height;
          this._input.style.lineHeight = this._dom.style.height;
        }
      }
    }
    this._img = ui.image
    this._txt = ui.text
    this._color = ui.color
  }
}
