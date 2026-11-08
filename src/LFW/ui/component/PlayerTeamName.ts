import { Sine } from "../../animation/Sine";
import { UIComponent } from "./UIComponent";

/**
 * 显示玩家队伍名
 *
 * @export
 * @class PlayerTeamName
 * @extends {UIComponent}
 */
export class PlayerTeamName extends UIComponent {
  static override readonly TAGS: string[] = ["PlayerTeamName"];
  private _decided?: boolean;
  private _com?: boolean;

  /** 字号等静态样式在 UI 里，这里只按 COM / 玩家换颜色 */
  join(text: string, com: boolean, decided: boolean) {
    this._decided = decided;
    this._com = com;
    this.node.style.fill_style = com ? "pink" : "white";
    this.node.set_text(text, this.node.style);
    this.node.visible = true
  }
  quit() {
    this._decided = void 0;
    this._com = void 0;
    this.node.style.fill_style = "white";
    this.node.set_text(this.lfw.t(" "), this.node.style);
    this.node.visible = false;
  }
  protected _opacity: Sine = new Sine(0.65, 1, 3);
  override update(dt: number): void {
    this._opacity.update(dt);
    this.node.opacity = this._decided ? 1 : this._opacity.value;
  }
}
