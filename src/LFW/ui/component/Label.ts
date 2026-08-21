import type { IStyle } from "../../defines";
import { UIComponent } from "./UIComponent";
/** @deprecated node.set_text */
export class Label extends UIComponent {
  static override readonly TAGS: string[] = ["Label", "Text"];
  get text(): string { return this.node.text?.text ?? '' }
  set text(v: string) { this.set_text(v) }
  get style(): IStyle { return this.node.style }
  set style(v: IStyle) { this.node.style.data = v }
  override on_start(): void {
    this.style = this.node.style;
  }
  /** @deprecated node.set_text */
  set_text(v: string): this {
    this.node.set_text(v);
    return this;
  }
  /** @deprecated */
  preload(_texts: string[]): this {
    return this;
  }
}
