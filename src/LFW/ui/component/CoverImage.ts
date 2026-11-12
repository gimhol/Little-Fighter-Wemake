import type { IPropsMeta } from "../../defines/ISchema";
import { cover_scale } from "../cover_scale";
import { UIComponent } from "./UIComponent";

export interface ICoverImageProps {
  design_w?: number;
  design_h?: number;
  target?: string;
}

export class CoverImage extends UIComponent<ICoverImageProps> {
  static override readonly TAGS: string[] = ["CoverImage"];
  static override readonly PROPS: IPropsMeta<ICoverImageProps> = {
    design_w: { type: Number, nullable: true },
    design_h: { type: Number, nullable: true },
    target: { type: String, nullable: true },
  };
  override update(): void {
    const target = this.props.target === "root" ? this.node.root : this.node.parent;
    const design_w = this.props.design_w;
    const design_h = this.props.design_h;
    if (!target || !design_w || !design_h) return;
    if (target.w <= 0 || target.h <= 0) return;
    const scale = cover_scale(target.w, target.h, design_w, design_h);
    if (this.node.scale.x === scale && this.node.scale.y === scale) return;
    this.node.scale.set(scale, scale, this.node.scale.z);
  }
}
