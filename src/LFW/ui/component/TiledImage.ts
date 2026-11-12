import type { IPropsMeta } from "../../defines/ISchema";
import { UIComponent } from "./UIComponent";

export interface ITiledImageProps {
  design_w?: number;
  design_h?: number;
  repeat_x?: number;
  repeat_y?: number;
}

export class TiledImage extends UIComponent<ITiledImageProps> {
  static override readonly TAGS: string[] = ["TiledImage", "TileImage"];
  static override readonly PROPS: IPropsMeta<ITiledImageProps> = {
    design_w: { type: Number, nullable: true },
    design_h: { type: Number, nullable: true },
    repeat_x: { type: Number, nullable: true },
    repeat_y: { type: Number, nullable: true },
  };
  override update(): void {
    const img = this.node.image_desc;
    const design_w = this.props.design_w;
    const design_h = this.props.design_h;
    const repeat_x = this.props.repeat_x;
    const repeat_y = this.props.repeat_y;
    if (!img || !design_w || !design_h || repeat_x == null || repeat_y == null) return;
    if (this.node.w <= 0 || this.node.h <= 0) return;
    const rx = this.node.w / design_w * repeat_x;
    const ry = this.node.h / design_h * repeat_y;
    if (img.repeatX !== rx) img.repeatX = rx;
    if (img.repeatY !== ry) img.repeatY = ry;
  }
}
