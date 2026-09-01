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
import { BLACK, OutlineMaterial } from "./materials/OutlineMaterial";
import styles from "./ui_node_style.module.scss";
import { UITextRenderer } from "./UITextRenderer";
import type { WorldRenderer } from "./WorldRenderer";
/** 平滑时间常数(ms)：约一帧(60fps)，每帧都移动、无停顿，避免 30UPS/60FPS 下 df 复位造成的抖动 */
const SMOOTH_TAU = 1000 / 60;

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
  protected _uv_anim_vec = new T.Vector2(0, 0);
  protected _p1 = new T.Vector3();
  protected _s1 = new T.Vector3(1, 1, 1);
  protected _old_alpha: number | null = null;
  protected _last_sync_lifetime = -1;

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
  get lf2() { return this.ui.lfw }
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

    if (ui.text) {
      this._text_renderer = new UITextRenderer(this);
      this.mesh.add(this._text_renderer.mesh);
    }
  }
  del(child: UINodeRenderer) {
    this.mesh.remove(child.mesh)
  }
  add(child: UINodeRenderer) {
    this.mesh.add(child.mesh)
  }
  del_self() {
    this.mesh.removeFromParent();
  }
  on_resume(): void {
    const world_renderer = this.lf2.world.renderer as WorldRenderer;
    if (this.ui.root === this.ui) world_renderer.ui_container.add(this.mesh);
    const text_input = this.ui.find_component(TextInput)
    if (text_input) {
      const ele_input = this._input = document.createElement('input');
      ele_input.id = "text_input"
      const { maxLength, defaultValue, text } = text_input
      if (is_num(maxLength)) ele_input.maxLength = maxLength
      else ele_input.removeAttribute('maxLength')
      if (is_str(defaultValue)) ele_input.defaultValue = defaultValue
      else ele_input.removeAttribute('defaultValue')
      ele_input.value = text
      ele_input.onchange = () => text_input.text = ele_input.value
      ele_input.onfocus = () => text_input.node.focused = true
      ele_input.onblur = () => text_input.node.focused = false
      this.dom.appendChild(ele_input)
    }
  }

  on_pause(): void {
    const text_input = this.ui.find_component(TextInput)
    const world_renderer = this.lf2.world.renderer as WorldRenderer;
    if (this.ui.root === this.ui) world_renderer.ui_container.remove(this.mesh);
    if (text_input) this.release_dom()
  }
  on_show(): void { }
  on_hide(): void { }
  on_start() {
    this.update_center_and_size()
    const { x, y, z } = this.ui;
    this.mesh.position.set(x, -y, z)
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
  set x(v: number) { this.mesh.position.x = v; }
  get y(): number { return this.mesh.position.y }
  set y(v: number) { this.mesh.position.y = v; }
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
    const sec = dt / 1000;

    this._uv_anim_angle += sec * offsetAnimR
    this._uv_anim_vec.x = offsetAnimX ?? 0
    this._uv_anim_vec.y = offsetAnimY ?? 0

    if (this._uv_anim_vec.x || this._uv_anim_vec.y) {
      const { x, y } = this._uv_anim_vec.clone().rotateAround(new T.Vector2(0, 0), this._uv_anim_angle)
      t.offset.x += sec * x;
      t.offset.y += sec * y;
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

    if (this.world.lifetime !== this._last_sync_lifetime) {
      this._last_sync_lifetime = this.world.lifetime;
      this.sync();
    }

    for (const child of ui.children) {
      if (child.visible || (child.visible != child.renderer.visible))
        child.renderer.render(dt, df)
    }
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
        this._input.style.fontSize = this._dom.style.height;
        this._input.style.lineHeight = this._dom.style.height;
      }
    }
    this._img = ui.image
    this._txt = ui.text
    this._color = ui.color
  }
}
