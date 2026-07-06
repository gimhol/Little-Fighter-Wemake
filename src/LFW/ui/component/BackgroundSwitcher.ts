import { BGG, Defines, type IBgData } from "../../defines";
import { Label } from "./Label";

export class BackgroundSwitcher extends Label {
  static override readonly TAGS: string[] = ["BackgroundSwitcher"];
  private _background: IBgData = Defines.RANDOM_BG;
  get backgrounds(): IBgData[] {
    let set = new Set<IBgData>();
    set.add(Defines.RANDOM_BG)

    for (const bg of this.lfw.datas.backgrounds) {
      if (bg.base.group?.includes(BGG.Regular)) {
        set.add(bg)
      } else if (bg.base.group?.includes(BGG.Hidden)) {
        if (this.world.dataset.LF2_NET) set.add(bg)
      } else {
        if (this.world.dataset.GIM_INK) set.add(bg)
      }
    }
    return Array.from(set).filter(v => v.id !== Defines.VOID_BG.id);
  }
  get background(): IBgData {
    return this._background;
  }
  override on_start(): void {
    super.on_start();
  }
  override on_resume(): void {
    this.set_text(this._background.base.name || this._background.id)
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
    this.set_text(
      this._background.base.name || this._background.id
    )
  }
}
