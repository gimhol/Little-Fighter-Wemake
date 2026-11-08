
import { TeamEnum } from '../../defines/TeamEnum';
import { Defines } from '../../defines/defines';
import { PlayerScore } from "./PlayerScore";
import { UIComponent } from "./UIComponent";

/**
 * Note: 
 *    你的这些组件是怎么想的... 
 *    以后最好避组件间免层层依赖的情况
 *      -Gim
 */
export class PlayerScorePlayerName extends UIComponent {
  static override readonly TAGS: string[] = ["PlayerScorePlayerName"];

  override on_show(): void {
    const fighter = this.node.lookup_component(PlayerScore)?.fighter;
    const text: string = fighter?.name ?? '-';
    const team = fighter?.team;
    const team_info = Defines.TeamInfoMap[team as TeamEnum] ?? Defines.TeamInfoMap[TeamEnum.Independent]
    // 字号、描边宽度/透明度在 UI 里，这里只按队伍换颜色
    this.node.outlineColor = team_info.txt_outline_color;
    const style = this.node.style;
    style.fill_style = team_info.txt_color;
    this.node.set_text(text, style);
  }
}
