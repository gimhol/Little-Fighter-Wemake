import { Sine } from "../../animation/Sine";
import { UIComponent } from "./UIComponent";

/**
 * 显示玩家角色选择的角色名称
 *
 * 字号等静态样式由 UI 文件负责，这里只按 COM / 玩家切换颜色。
 *
 * @export
 * @class FighterName
 * @extends {UIComponent}
 */
export class FighterName extends UIComponent {
  static override readonly TAGS: string[] = ["FighterName"];
  private _decided?: boolean;
  private _com?: boolean;

  join(text: string, com: boolean, decided: boolean) {
    this._decided = decided;
    this._com = com;
    this.node.style.fill_style = com ? "pink" : "white";
    this.node.set_text(text);
    this.node.visible = true
  }
  quit() {
    this._com = void 0;
    this._decided = void 0;
    this.node.style.fill_style = "white";
    this.node.set_text(this.lfw.t(" "));
    this.node.visible = false
  }
  protected _opacity: Sine = new Sine(0.65, 1, 6);
  override update(dt: number): void {
    this._opacity.update(dt);
    this.node.opacity = this._decided ? 1 : this._opacity.value;
  }
}
