import { Color, type ColorRepresentation, ShaderMaterial, Texture, Vector4 } from "../../_t";
import { MaterialFactory, MaterialKind } from "../factory/MaterialFactory";
import { Shaders } from "../shader";
import { BLACK, type IUIClipRect } from "./OutlineMaterial";

export class TextMaterial extends ShaderMaterial {
  static readonly KIND = MaterialKind.Text;
  static create() {
    const ret = new TextMaterial({
      vertexShader: Shaders.Vertex.Normal,
      fragmentShader: Shaders.Fragment.Text,
      transparent: true,
      uniforms: {
        tex: { value: void 0 },
        x: { value: 0 },
        y: { value: 0 },
        w: { value: 1 },
        h: { value: 1 },
        tw: { value: 1 },
        th: { value: 1 },
        tsw: { value: 1 },
        tsh: { value: 1 },
        outlineColor: { value: BLACK.clone() },
        outlineAlpha: { value: 0 },
        outlineWidth: { value: 0 },
        repeatX: { value: 1 },
        repeatY: { value: 1 },
        offsetX: { value: 0 },
        offsetY: { value: 0 },
        flipX: { value: 1 },
        flipY: { value: 1 },
        scaleX: { value: 1 },
        scaleY: { value: 1 },
        scaleZ: { value: 1 },
        opacity: { value: 1 },
        /** 混色 */
        mixColor: { value: BLACK.clone() },
        /** 混色强度,一般范围:[0,1], 当为0，不混色 */
        mixStength: { value: 0 },
        cover: { value: false },
        coverColor: { value: BLACK.clone() },
        coverStength: { value: 0 },
        gray: { value: 0 },
        keepout: { value: true },
        /** 是否启用裁剪（本节点祖先中 overflow:hidden 视口的矩形交集） */
        clipEnabled: { value: 0 },
        /** 裁剪矩形（世界坐标，x0,y0,x1,y1） */
        clipRect: { value: new Vector4() },
      }
    });
    return ret;
  }
  static reset(c: TextMaterial) {
    c.texture = void 0;
    c.uniforms.x.value = 0
    c.uniforms.y.value = 0
    c.uniforms.w.value = 1
    c.uniforms.h.value = 1
    c.uniforms.tw.value = 1
    c.uniforms.th.value = 1
    c.uniforms.tsw.value = 1
    c.uniforms.tsh.value = 1
    c.outlineColor = BLACK;
    c.outlineAlpha = 0;
    c.outlineWidth = 0;
    c.uniforms.repeatX.value = 1
    c.uniforms.repeatY.value = 1
    c.uniforms.offsetX.value = 0
    c.uniforms.offsetY.value = 0
    c.uniforms.flipX.value = 1
    c.uniforms.flipY.value = 1
    c.uniforms.scaleX.value = 1
    c.uniforms.scaleY.value = 1
    c.uniforms.scaleZ.value = 1
    c.uniforms.opacity.value = 1
    c.mixColor = BLACK;
    c.mixStrength = 0;
    c.uniforms.cover.value = false
    c.uniforms.coverColor.value.set(BLACK)
    c.uniforms.coverStength.value = 0
    c.uniforms.gray.value = 0
    c.uniforms.keepout.value = true
    c.uniforms.clipEnabled.value = 0
    c.uniforms.clipRect.value.set(0, 0, 0, 0)
  }

  // ===== 封装属性 =====

  get texture(): Texture | undefined { return this.uniforms.tex.value }
  set texture(v: Texture | undefined) { this.uniforms.tex.value = v }

  get mixColor(): Color { return this.uniforms.mixColor.value }
  set mixColor(v: ColorRepresentation) { this.uniforms.mixColor.value.set(v) }

  get mixStrength(): number { return this.uniforms.mixStength.value }
  set mixStrength(v: number) { this.uniforms.mixStength.value = v }

  get outlineColor(): Color { return this.uniforms.outlineColor.value }
  set outlineColor(v: ColorRepresentation) { this.uniforms.outlineColor.value.set(v) }

  get outlineAlpha(): number { return this.uniforms.outlineAlpha.value }
  set outlineAlpha(v: number) { this.uniforms.outlineAlpha.value = v }

  get outlineWidth(): number { return this.uniforms.outlineWidth.value }
  set outlineWidth(v: number) { this.uniforms.outlineWidth.value = v }

  get alpha(): number { return this.uniforms.opacity.value ?? 1 }
  set alpha(v: number) { this.uniforms.opacity.value = v }

  /** 设置裁剪矩形（overflow:hidden）；传 null 表示不裁剪 */
  set_clip_rect(clip: IUIClipRect | null): void {
    this.uniforms.clipEnabled.value = clip ? 1 : 0;
    if (clip) this.uniforms.clipRect.value.set(clip.x0, clip.y0, clip.x1, clip.y1);
  }
}
MaterialFactory.register(TextMaterial)