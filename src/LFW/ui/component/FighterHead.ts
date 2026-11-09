import { Defines } from "../../defines/defines";
import { PlayerInfo } from "../../PlayerInfo";
import { Picture } from './Picture';

/**
 * 角色头像
 *
 * @export
 * @class FighterHead
 * @extends {UIComponent}
 */
export class FighterHead extends Picture {
  static override readonly TAGS: string[] = ["FighterHead"];
  get player_id() { return this.info.args[0] || this.node.find_parent(v => v.values?.player_id)?.values?.player_id || ''; }
  get player(): PlayerInfo { return this.lfw.players.get(this.player_id)!; }
  get head() {
    const fighter_data = this.player?.fighter?.data;
    if (!fighter_data) return Defines.BuiltIn_Imgs.RFACE;
    const head = fighter_data.base.head;
    return head ?? Defines.BuiltIn_Imgs.RFACE;
  }
  override on_start(): void {
    super.on_start?.();
    this.width = 120;
    this.height = 120;
  }

  protected handle_changed() {
    this.set_src(this.head)
  }
}
