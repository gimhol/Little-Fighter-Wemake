import { Defines, type IBgData } from "../../defines";
import { arrange_switcher_backgrounds } from "./background_switcher_order";
import { UIComponent } from "./UIComponent";

export class BackgroundSwitcher extends UIComponent {
  static override readonly TAGS: string[] = ["BackgroundSwitcher"];
  private _background: IBgData = Defines.RANDOM_BG;
  get backgrounds(): IBgData[] {
    return arrange_switcher_backgrounds(
      this.lfw.datas.backgrounds,
      this.world.dataset,
    );
  }
  get background(): IBgData {
    return this._background;
  }
  override on_resume(): void {
    this.node.set_text(this._background.base.name || this._background.id)
    this.lfw.callbacks.add(this)
  }
  override on_pause(): void {
    this.lfw.callbacks.del(this);
  }
  override on_show(): void {
    if (this._background === Defines.VOID_BG)
      this.on_broadcast(Defines.BuiltIn_Broadcast.SwitchBackground);
  }
  on_broadcast(v: string) {
    let dir = 1;
    switch (v) {
      case Defines.BuiltIn_Broadcast.SwitchBackground: dir = 1; break;
      case Defines.BuiltIn_Broadcast.SwitchBackgroundR: dir = -1; break;
      case Defines.BuiltIn_Broadcast.ResetBackground: dir = 0; break;
      default: return;
    }
    const { backgrounds } = this;
    if (!backgrounds.length) {
      this._background = Defines.VOID_BG;
      this.world.stage.change_bg(Defines.VOID_BG);
    } else if (dir) {
      const background_id = this.background.id;
      const curr_idx = backgrounds.findIndex((v) => v.id === background_id)
      const next_idx = (curr_idx + backgrounds.length + dir) % backgrounds.length;
      this._background = backgrounds[next_idx];
      this.world.stage.change_bg(this._background)
    } else {
      this._background = backgrounds[0];
      this.world.stage.change_bg(this._background)
    }
    this.node.set_text(
      this._background.base.name || this._background.id
    )
  }
}
