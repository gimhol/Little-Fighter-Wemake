import { CtrlDevice } from "../../defines/CtrlDevice";
import type { IUIPointerEvent } from "../IUIPointerEvent";
import { UIComponent } from "./UIComponent";

export class PlayerCtrlType extends UIComponent {
  static override readonly TAGS: string[] = ["PlayerCtrlType"];
  get player_id() { return this.info.args[0] || this.node.find_parent(v => v.values?.player_id)?.values?.player_id || ''; }
  get player() { return this.lfw.players.get(this.player_id)! }
  override on_resume(): void {
    this.player.callbacks.add(this)
    this.on_ctrl_changed(this.player.ctrl)
  }
  override on_pause(): void {
    this.player.callbacks.del(this)
  }
  override on_click(e: IUIPointerEvent) {
    this.node.focused = true;
    e.stop_immediate_propagation();
    const ctrl: CtrlDevice = (
      e.button === 2 ?
        (this.player.ctrl + 5) % 6 :
        (this.player.ctrl + 1) % 6
    ) as CtrlDevice;
    if (ctrl === CtrlDevice.TouchScreen) {
      for (const [, p] of this.lfw.players) {
        if (p === this.player)
          continue;
        if (p.ctrl !== CtrlDevice.TouchScreen)
          continue;
        p.set_ctrl(CtrlDevice.Keyboard, true).save()
      }
    }
    this.player.set_ctrl(ctrl, true).save()
  }
  on_ctrl_changed(c: CtrlDevice) {
    this.node.children.forEach((v, i) => {
      v.visible = i == c
    })
  }
}

