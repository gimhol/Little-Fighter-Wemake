import { floor } from '../../utils/math/base';
import { UIComponent } from "./UIComponent";

export class PlayingTimeText extends UIComponent {
  static override readonly TAGS: string[] = ["PlayingTimeText"];
  
  override on_show(): void {
    this.node.set_text(this.get_txt());
  }

  protected get_txt(): string {
    const duration = floor(this.world.stage.time * 16.6666);
    const s = floor(duration / 1000) % 60;
    const m = floor(duration / (60 * 1000)) % 60;
    const h = floor(duration / (60 * 60 * 1000)) % 60;
    let ret = "";
    if (h) ret += h + ":";
    if (m > 9 || !h) ret += m + ":";
    else ret += "0" + m + ":";
    if (s > 9) ret += s;
    else ret += "0" + s;
    return ret;
  }
}
