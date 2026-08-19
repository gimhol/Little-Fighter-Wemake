import type { UINode } from "@/LFW";
import type { IStyle } from "@/LFW/defines/IStyle";
import { Style } from "@/LFW/ui/Style";
import { round } from "@/LFW/utils";
import { TextMesh } from "./meshs/TextMesh";
import { UINodeRenderer } from "./UINodeRenderer";

// ========== UITextRenderer ==========

export class UITextRenderer {
  mesh: TextMesh;
  owner: UINodeRenderer;
  ui: UINode;

  /** 缓存上次渲染的文本与样式版本，避免无变化时重绘 */
  protected _last_text: string = '';
  protected _last_style_version: number = -1;

  constructor(owner: UINodeRenderer) {
    this.owner = owner;
    this.ui = owner.ui;

    // 使用池化 SmallTextMesh（#sym:SmallTextMesh）
    this.mesh = TextMesh.get();
    this.mesh.name = `UITextMesh`;

    // 初始化文本绘制
    this.update();
  }

  /** 归一化样式：补齐 UI 文字默认值（padding=2、HiDPI scale=2），保持旧 UITextRenderer 外观 */
  protected _normalize_style(style: IStyle | undefined): IStyle {
    const src = style instanceof Style ? style.data : (style ?? {});
    return {
      font: "normal 9px system-ui",
      padding_l: 2,
      padding_t: 2,
      padding_r: 2,
      padding_b: 2,
      scale: 2,
      ...src,
    };
  }

  /** 更新文字并刷新贴图 */
  update(): void {
    const { ui, mesh } = this;
    const txt = ui.text;

    // 通过 lf2.string() 解析 i18n 文本
    const text = txt?.text ? ui.lfw.string(txt.text) : '';

    // 文本变化或 style 版本递增时才重绘
    if (text !== this._last_text || ui.style.version !== this._last_style_version) {
      this._last_text = text;
      this._last_style_version = ui.style.version;
      mesh.set_style(this._normalize_style(txt?.style));
      mesh.set_text(ui.lfw, text).catch(e => console.warn(e));
    }

    const m = mesh.material;
    // alpha 跟随父级 UINodeRenderer（apply() 每帧同步到 opacity uniform）
    m.alpha = this.owner.mesh.material.alpha;
    // 响应 UINode 的 outline 属性，通过 shader 渲染描边
    // 注意：update() 只在文本变化时执行，此处必须存静态值；
    // 淡入淡出由 shader 的 outlineAlpha * opacity 每帧处理（opacity 由 apply() 同步）
    if (ui.outlineColor != null) m.outlineColor = ui.outlineColor;
    if (ui.outlineWidth != null) m.outlineWidth = ui.outlineWidth;
    if (ui.outlineAlpha != null) m.outlineAlpha = ui.outlineAlpha;
    else m.outlineAlpha = 1;

    // 根据 center 计算文字 mesh 的位置，若节点尺寸为 0 则用文字自身尺寸
    const nodeW = ui.w || mesh.text_w;
    const nodeH = ui.h || mesh.text_h;
    const { x: cx, y: cy } = ui.center;
    mesh.position.set(
      round(nodeW * (0.5 - cx)),
      round(nodeH * (cy - 0.5)),
      0
    );
  }

}
