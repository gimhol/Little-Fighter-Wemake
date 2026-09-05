import { Defines } from "../../defines";
import { GameKey } from "../../defines/GameKey";
import { UIComponent } from "./UIComponent";

export class PlayerKeyText extends UIComponent {
  static override readonly TAGS: string[] = ["PlayerKeyText"];
  get player_id() { return this.info.args[0] || this.node.find_parent(v => v.data.values?.player_id)?.data.values?.player_id || ''; }
  get key_name() { return this.info.args[1] || this.node.find_parent(v => v.data.values?.key_name)?.data.values?.key_name || ''; }
  get player() { return this.lfw.players.get(this.player_id); }
  get key_code() {
    const { player } = this;
    if (!player) return 'None'
    const kc = player.keys[this.key_name as GameKey]?.toUpperCase();
    return Defines.SHORT_KEY_CODES[kc] || kc || 'None'
  }
  override on_resume() {
    this.player?.callbacks.add(this)
    this.on_key_changed();
  }
  override on_pause(): void {
    this.player?.callbacks.del(this)
  }
  on_key_changed() {
    this.node.set_text(this.key_code)
  }
}
