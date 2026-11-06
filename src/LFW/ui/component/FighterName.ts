import { Sine } from "../../animation/Sine";
import type { IStyle } from "../../defines";
import { TextInfo } from "../../ditto/image/TextInfo";
import { UIComponent } from "./UIComponent";

/**
 * 显示玩家角色选择的角色名称
 *
 * @export
 * @class FighterName
 * @extends {UIComponent}
 */
export class FighterName extends UIComponent {
  static override readonly TAGS: string[] = ["FighterName"];
  private _decided?: boolean;
  private _com?: boolean;

  /** 优先用 UINode（json5 里声明的 style）；没有时才用代码内置样式 */
  protected make_style(com: boolean): IStyle {
    const node_style = this.node.style?.data;
    if (node_style && Object.keys(node_style).length)
      return { ...node_style };
    return {
      fill_style: com ? "pink" : "white",
      font: "14px Arial",
    }
  }

  join(text: string, com: boolean, decided: boolean) {
    this._decided = decided;
    this._com = com;
    this.node.text = new TextInfo({
      text,
      style: this.make_style(com),
    });
    this.node.visible = true
  }
  quit() {
    this._com = void 0;
    this._decided = void 0;
    const text = this.lfw.t(" ")
    this.node.text = new TextInfo({
      text,
      style: this.make_style(false),
    });
    this.node.visible = false
  }
  protected _opacity: Sine = new Sine(0.65, 1, 6);
  override update(dt: number): void {
    this._opacity.update(dt);
    this.node.opacity = this._decided ? 1 : this._opacity.value;
  }
}

