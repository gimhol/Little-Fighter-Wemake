import type { IKeyboardCallback } from '../../ditto/keyboard/IKeyboardCallback';
import type { IPointingsCallback } from '../../ditto/pointings/IPointingsCallback';
import type { IUICallback } from '../IUICallback';
import { PlayerKeyText } from "./PlayerKeyText";

export class PlayerKeyEdit extends PlayerKeyText {
  static override readonly TAGS: string[] = ["PlayerKeyEdit"];

  override on_start(): void {
    this.node.style.font = "17px Arial"
    this.node.parent?.callbacks.add(this.p)
  }
  override on_stop(): void {
    this.node.parent?.callbacks.del(this.p)
  }
  override on_foucs(): void {
    super.on_foucs?.();
    this.on_key_changed();
    this.lfw.pointings.callback.add(this.r);
    this.lfw.keyboard.callback.add(this.l);

  }
  override on_blur(): void {
    super.on_blur?.();
    this.on_key_changed();
    this.lfw.pointings.callback.del(this.r);
    this.lfw.keyboard.callback.del(this.l);
  }
  private _click_me = false;
  private p: IUICallback = {
    on_click: (e) => {
      this._click_me = true
      this.node.focused = !this.node.focused;
      e.stop_immediate_propagation();
    },
  }
  private l: IKeyboardCallback = {
    on_key_down: (e) => {
      if (!this.node.focused) return;
      if ("escape" !== e.key.toLowerCase()) {
        this.player?.set_key(this.key_name, e.key, true).save();
        const others = this.node.root.search_components(PlayerKeyEdit, v => v.player === this.player);
        const idx = others.indexOf(this);
        const next = others[idx + 1];
        if (next) next.node.focused = true
      }
      this.node.focused = false;
    }
  }
  private r: IPointingsCallback = {
    on_click: (e) => {
      if (this._click_me) {
        this._click_me = false;
        return
      }
      this.node.focused = false
    }
  };
  override on_key_changed() {
    this.node.set_text(this.key_code)
    if (this.node.focused)
      this.node.style.fill_style = "#5555FF"
    else if (this.key_code == "None")
      this.node.style.fill_style = 'gray'
    else
      this.node.style.fill_style = 'white'
  }
}


