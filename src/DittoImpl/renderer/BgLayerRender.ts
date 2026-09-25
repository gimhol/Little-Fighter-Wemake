import type { Layer } from "@/LFW/bg/Layer";
import * as T from "../_t";
import { MeshBasicMaterial, RepeatWrapping } from "../_t";
import { BgLayerIndicator } from "./BgLayerIndicator";
import type { BgRender } from "./BgRender";
import { get_static_plane_geometry } from "./GeometryKeeper";
import { MaterialKind as Kind, MaterialFactory } from "./factory";

const pos_mod = (v: number, period: number): number => ((v % period) + period) % period;


export class BgLayerRender {
  readonly mesh: T.Mesh;
  readonly layer: Layer;
  readonly bg_render: BgRender;
  readonly indicators: BgLayerIndicator;
  /** 目标（几何/mesh）宽度：dw ?? 源图尺寸；纯色层沿用 w ?? width */
  readonly width: number;
  /** 目标（几何/mesh）高度：dh ?? 源图尺寸；纯色层沿用 h ?? height */
  readonly height: number;
  /** 源图显示尺寸（px），无图时为 0 */
  protected readonly src_w: number;
  protected readonly src_h: number;
  /** 是否开启 UV 平铺循环（uv_loop） */
  protected readonly uv_loop: boolean;
  protected offsetX: number = 0;
  protected offsetY: number = 0;
  protected readonly src_texture: T.Texture | null;
  protected readonly _color: number | string | undefined;
  /** 每层独立纹理（uv_loop 平铺 / UV 偏移动画会改 repeat/offset，不能污染共享纹理） */
  protected anim_texture: T.Texture | null = null;
  /** 每层独立材质（uv_loop / UV 动画 / opacity<1 需要，不能改共享缓存材质） */
  protected anim_material: MeshBasicMaterial | null = null;
  protected anim_on: boolean = false;
  protected readonly shared_material: MeshBasicMaterial;
  constructor(bg_render: BgRender, layer: Layer) {
    this.layer = layer;
    this.bg_render = bg_render
    const { lfw: lf2 } = this.layer.bg.world
    const { info } = layer;
    const { x, y, z, file, id, name, color, dw, dh, uv_loop } = info;
    const pic = file ? lf2.images.find(file)?.pic : null
    const has_pic = !!pic
    const src_w = pic?.w ?? 0
    const src_h = pic?.h ?? 0
    this.src_w = src_w
    this.src_h = src_h
    this.uv_loop = !!uv_loop
    // 有图：目标尺寸 dw/dh（缺省 = 源图尺寸）；纯色/无图沿用 w/h/width/height
    const dst_w = has_pic ? (dw ?? src_w) : (info.w || info.width || 0)
    const dst_h = has_pic ? (dh ?? src_h) : (info.h || info.height || 0)
    this.width = dst_w;
    this.height = dst_h;
    this.src_texture = file ? (lf2.images.find(file)?.pic?.texture ?? null) : null;
    this._color = color;

    const k = `bg_l_${file ?? color}`
    const m = MaterialFactory.get(Kind.Basic, MeshBasicMaterial, k, (m) => {
      const texture = file ? lf2.images.find(file)?.pic?.texture : null
      if (texture) m.map = texture
      else if (color !== void 0) m.color.set(color)
      m.transparent = true;
      m.needsUpdate = true;
      m.opacity = 1;
    })
    this.shared_material = m;

    this.mesh = new T.Mesh(
      get_static_plane_geometry(dst_w, dst_h, dst_w / 2, -dst_h / 2),
      m
    );
    this.mesh.name = `bg layer ${name ?? id ?? 'unnamed'}`;
    this.mesh.position.set(x, y, z);
    this.offsetX = 0;
    this.offsetY = 0;
    this.indicators = new BgLayerIndicator(this);
  }

  set_indicator_visible(v: boolean): void {
    this.indicators.set_visible(v);
  }

  render(dt: number): void {
    const {
      visible,
      info: { absolute, offsetAnimX, offsetAnimY }
    } = this.layer;
    this.mesh.visible = visible;
    this.indicators.update();
    if (offsetAnimX !== void 0) this.offsetX += (dt / 1000) * offsetAnimX;
    if (offsetAnimY !== void 0) this.offsetY += (dt / 1000) * offsetAnimY;
    this.update_uv(offsetAnimX, offsetAnimY);
    if (absolute) return;
    const { bg, info: { x, width: layer_width, } } = this.layer;
    const { world } = bg;
    const { screen_w } = world.dataset;
    const { width: bg_width } = world;
    const cam_x = this.bg_render.world_renderer.camera.position.x;
    const _x = bg_width > screen_w ?
      x + (bg_width - layer_width) * cam_x / (bg_width - screen_w) :
      x + (bg_width - layer_width) * cam_x
    this.mesh.position.x = _x;
  }

  /**
   * 每帧同步本层的独立材质/纹理：
   * - 需要独立材质：uv_loop 平铺 / UV 偏移动画 / opacity < 1（共享缓存材质不可改 opacity）
   * - 仅平铺/动画需要克隆纹理；纯 opacity 层可复用共享纹理对象
   * - uv_loop：目标轴 > 源图尺寸 → repeat=目标/源图（UV 循环平铺）；否则 repeat=1（整图铺满/缩放）
   * - offsetAnim：在周期 = 单个图像在屏幕上的宽度(= min(源图,目标)) 上循环偏移
   */
  protected update_uv(offsetAnimX?: number, offsetAnimY?: number): void {
    const anim = !!(offsetAnimX || offsetAnimY);
    const tiling = this.uv_loop && this.src_w > 0 && this.src_h > 0;
    const opacity = this.layer.info.opacity ?? 1
    const want = anim || tiling || opacity < 1;
    if (want !== this.anim_on) {
      this.anim_on = want;
      if (want) this.activate_uv(anim || tiling, opacity);
      else this.deactivate_uv();
    } else if (want && !this.anim_material) {
      this.activate_uv(anim || tiling, opacity);
    }
    const mat = this.anim_material;
    if (!mat) return;
    mat.opacity = opacity;
    const tex = this.anim_texture;
    if (!tex) return;
    // UV 循环平铺：目标轴超出源图时按源图尺寸循环，未超出则整图缩放铺满（repeat=1）
    const rx = tiling ? Math.max(this.width / this.src_w, 1) : 1
    const ry = tiling ? Math.max(this.height / this.src_h, 1) : 1
    tex.repeat.set(rx, ry)
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    if (!anim) {
      tex.offset.set(0, 0)
      return
    }
    // 单个图像在屏幕上的宽度 = 平面宽/repeat = min(源图, 目标)
    const period_x = this.src_w > 0 && this.width > 0 ? Math.min(this.src_w, this.width) : this.width
    const period_y = this.src_h > 0 && this.height > 0 ? Math.min(this.src_h, this.height) : this.height
    if (period_x > 0) tex.offset.x = pos_mod(this.offsetX, period_x) / period_x
    if (period_y > 0) tex.offset.y = pos_mod(this.offsetY, period_y) / period_y
  }

  /** @param with_uv 是否需要独立纹理（平铺/偏移动画会改 repeat/offset） */
  protected activate_uv(with_uv: boolean, opacity: number): void {
    const src = this.src_texture;
    const material = new MeshBasicMaterial({
      transparent: true,
      opacity,
    });
    if (with_uv && src) {
      const texture = src.clone();
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.offset.set(0, 0);
      material.map = texture;
      this.anim_texture = texture;
    } else if (src) {
      material.map = src;
    } else if (this._color !== void 0) {
      material.color.set(this._color);
    }
    this.anim_material = material;
    this.mesh.material = material;
  }

  protected deactivate_uv(): void {
    this.anim_texture?.dispose();
    this.anim_material?.dispose();
    this.anim_texture = null;
    this.anim_material = null;
    this.mesh.material = this.shared_material;
  }

  release(): void {
    this.deactivate_uv();
  }
}