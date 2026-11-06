import { Sine } from "../../animation/Sine";
import type { IPropsMeta, IStyle } from "../../defines";
import { TextInfo } from "../../ditto/image/TextInfo";
import { UIComponent } from "./UIComponent";
export interface IPlayerNameProps {
  prefix?: string;
  /** 未加入时隐藏“加 入?”占位文案（生存排行等页面用）；默认保持经典显示 */
  hide_join_q?: boolean;
}
/**
 * 显示玩家名称
 *
 * @export
 * @class PlayerName
 * @extends {UIComponent}
 */
export class PlayerName extends UIComponent<IPlayerNameProps> {
  static override readonly TAGS: string[] = ["PlayerName"];
  static override readonly PROPS: IPropsMeta<IPlayerNameProps> = {
    prefix: { type: String, nullable: true },
    hide_join_q: { type: Boolean, nullable: true },
  };
  private _decided?: boolean;
  private _com?: boolean;

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
    const { prefix } = this.props;
    this._decided = decided;
    this._com = com;
    this._decided = true;
    this.node.text = new TextInfo({
      text: prefix ? `${this.lfw.t(prefix)}${text}` : text,
      style: this.make_style(com),
    });
    this.node.visible = true
  }

  quit() {
    this._decided = void 0;
    this._com = void 0;
    const text = this.lfw.t("char_menu.join_q")
    this.node.text = new TextInfo({
      text,
      style: this.make_style(false),
    });
    if (this.props.hide_join_q) this.node.visible = false;
  }

  protected _opacity: Sine = new Sine(0.65, 0.35, 3);
  override update(dt: number): void {
    this._opacity.update(dt);
    this.node.opacity = this._decided ? 1 : this._opacity.value;
  }
}
