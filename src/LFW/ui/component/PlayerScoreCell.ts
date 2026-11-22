import { summary_mgr } from "../../entity/SummaryMgr";
import { round } from "../../utils/math/base";
import { Style } from "../Style";
import { PlayerScore } from "./PlayerScore";
import { UIComponent } from "./UIComponent";
export class PlayerScoreCell extends UIComponent {
  static override readonly TAGS: string[] = ["PlayerScoreCell"];
  protected _last_txt: string | undefined;
  protected _last_style_version: number = -1;
  get kind() {
    return this.info.args[0];
  }
  get player_score() {
    return this.node.lookup_component(PlayerScore);
  }

  override update(): void {
    const style = this.get_style();
    const txt = this.get_txt();
    if (txt === this._last_txt && style.version === this._last_style_version) return;
    this._last_txt = txt;
    this._last_style_version = style.version;
    this.node.set_text(txt)
  }

  protected get_style(): Style {
    const s = this.player_score;
    const c = this.player_score?.fighter;
    if (!s || !c) return this.node.style;
    if (this.kind === "status") {

      const style = this.node.style;
      if (c.hp > 0) style.fill_style = this.node.get_value("win_alive_color");
      else if (s.lose) style.fill_style = this.node.get_value("lose_color");
      else style.fill_style = this.node.get_value("win_dead_color");
      return style;
    }
    return this.node.style;
  }
  protected get_txt() {
    const s = this.player_score;
    const c = this.player_score?.fighter;
    if (!s || !c) return "-";
    const sum = summary_mgr.get(c.id);
    switch (this.kind) {
      case "kill":
        return "" + round(sum.kill_sum);
      case "attack":
        return "" + round(sum.damage_sum);
      case "hp_lost":
        return "" + round(sum.hp_lost);
      case "mp_usage":
        return "" + round(sum.mp_usage);
      case "picking":
        return "" + round(sum.picking_sum)
      case "status": {
        if (c.hp > 0) return this.node.get_value("win_alive_txt");
        else if (s.lose) return this.node.get_value("lose_txt");
        else return this.node.get_value("win_dead_txt");
      }
    }
    return "-";
  }
}
