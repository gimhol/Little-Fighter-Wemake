import { PlayerInfo } from "../../PlayerInfo";
import { TextInput } from "./TextInput";

export class PlayerNameInput extends TextInput {
  static override readonly TAGS: string[] = ["PlayerNameInput"];
  protected player: PlayerInfo | undefined;
  get player_id() { return this.node.get_value("player_id", true) }
  override on_resume(): void {
    this.text = this.player?.name ?? ''
  }
  override on_blur(): void {
    super.on_blur?.()
    this.player?.set_name(this.text, true).save();
  }
  override on_start(): void {
    this.player = this.lfw.players.get(this.player_id);
    this.player?.callbacks.add(this)
  }
  override on_stop(): void {
    this.player?.callbacks.del(this)
    this.player?.set_name(this.text, true).save();
  }
  on_name_changed(name: string) {
    this.set_text(name);
  }
}
