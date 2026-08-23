import * as T from "../_t";
import { TextMesh } from "./meshs/TextMesh";
import type { BgLayerRender } from "./BgLayerRender";

const OUTLINE_COLOR = 0x00ffff;
const OUTLINE_WIDTH = 4;
const LABEL_FILL = '#00ffff';
const LABEL_STROKE = '#000000';
const POS_LABEL_OFFSET = 16;

export class BgLayerIndicator {
  readonly layer_render: BgLayerRender;
  protected outline: T.Line2 | null = null;
  protected label: TextMesh | null = null;
  protected pos_label: TextMesh | null = null;
  visible = false;

  constructor(layer_render: BgLayerRender) {
    this.layer_render = layer_render;
  }

  set_visible(v: boolean): void {
    if (this.visible === v) return;
    this.visible = v;
    if (v) this.rebuild();
    else this.clear();
  }

  clear(): void {
    this.outline?.removeFromParent();
    this.outline = null;
    this.label?.removeFromParent();
    this.label = null;
    this.pos_label?.removeFromParent();
    this.pos_label = null;
  }

  rebuild(): void {
    this.clear();
    if (!this.visible) return;

    const { mesh, width: w, height: h, layer } = this.layer_render;
    const loop_tag = layer.loop_index >= 0 ? `#${layer.loop_index}` : '';
    const abs_tag = layer.info.absolute ? ' *' : '';   // * = 相对相机静止（absolute）
    const name = `${layer.info.name ?? 'layer'} [${layer.data_index}]${loop_tag}${abs_tag}`;

    const geo = new T.LineGeometry();
    // z 偏移 10：在 far=1000000 的深度精度下仍明显高于图层平面（0.1 会被判平而剔除），
    // 同时远小于实体所在的 z≈0，因此实体仍能遮挡线框
    geo.setPositions([
      0, 0, 10, w, 0, 10,
      w, 0, 10, w, -h, 10,
      w, -h, 10, 0, -h, 10,
      0, -h, 10, 0, 0, 10,
    ]);
    const mat = new T.LineMaterial({
      color: OUTLINE_COLOR,
      linewidth: OUTLINE_WIDTH,
      depthTest: false,
      transparent: true,
      depthWrite: false,
    });
    const { w: rw, h: rh } = this.layer_render.bg_render.world_renderer.renderer_size;
    mat.resolution.set(rw, rh);
    const outline = new T.Line2(geo, mat);
    outline.name = `BgLayerIndicatorOutline:${name}`;
    outline.renderOrder = 100;
    outline.frustumCulled = false;
    mesh.add(outline);
    this.outline = outline;

    const label = TextMesh.get();
    label.name = `BgLayerIndicator:${name}`;
    label.fillStyle = LABEL_FILL;
    label.strokeStyle = LABEL_STROKE;
    void label.set_text(layer.bg.world.lfw, name);
    label.position.set(w / 2, -h / 2, 2);
    mesh.add(label);
    this.label = label;

    const pos_label = TextMesh.get();
    pos_label.name = `BgLayerIndicatorPos:${name}`;
    pos_label.fillStyle = LABEL_FILL;
    pos_label.strokeStyle = LABEL_STROKE;
    void pos_label.set_text(layer.bg.world.lfw, this._pos_text());
    pos_label.position.set(w / 2, -h / 2 - POS_LABEL_OFFSET, 2);
    mesh.add(pos_label);
    this.pos_label = pos_label;
  }

  update(): void {
    const pos_label = this.pos_label;
    if (!this.visible || !pos_label) return;
    const text = this._pos_text();
    if (pos_label.text !== text)
      void pos_label.set_text(this.layer_render.layer.bg.world.lfw, text);
  }

  private _pos_text(): string {
    const { x, y, z } = this.layer_render.mesh.position;
    return `(${Math.round(x)}, ${Math.round(y)}, ${Math.round(z)})`;
  }

  release(): void {
    this.clear();
  }
}
