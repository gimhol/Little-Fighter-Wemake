import type { UINode } from "../UINode";
import { ReachableGroup } from "./ReachableGroup";
import { UIComponent } from "./UIComponent";

/**
 * 主菜单入口的环境开关：
 * 「生存排行」在 B站 Toy 环境或配置了排行服务器（lfw.survival_rank_available）时可用，
 * 都不可用时隐藏并禁用入口按钮（双人入口跟随同一个开关）。
 */
export class MainMenuLogic extends UIComponent<{}> {
  static override readonly TAGS: string[] = ["MainMenuLogic"];
  protected _survival_btns: UINode[] | undefined;
  protected get survival_btns(): UINode[] {
    if (this._survival_btns !== undefined) return this._survival_btns;
    const ids = ["btn_survival", "btn_survival_2p"];
    this._survival_btns = ids
      .map(v => this.node.search_node(v))
      .filter((v): v is UINode => !!v);
    return this._survival_btns;
  }
  protected _danmu_btns: UINode[] | undefined;
  protected get danmu_btns(): UINode[] {
    if (this._danmu_btns !== undefined) return this._danmu_btns;
    const btn = this.node.search_node("btn_danmu_mode");
    this._danmu_btns = btn ? [btn] : [];
    return this._danmu_btns;
  }
  protected get reachable_group(): ReachableGroup | undefined {
    return this.node.search_component(ReachableGroup);
  }
  protected apply(): void {
    const available = this.lfw.survival_rank_available;
    for (const btn of this.survival_btns) {
      btn.set_visible(available);
      btn.set_disabled(!available);
    }
    const danmu_available = this.lfw.danmu_available;
    for (const btn of this.danmu_btns) {
      btn.set_visible(danmu_available);
      btn.set_disabled(!danmu_available);
    }
    // 生存入口不可用时，初始焦点交给菜单里第一个可用项（vs mode），
    // 否则 auto_focus 落在被隐藏的入口上，整个菜单都没有焦点
    if (!available && !this.node.focused_node) this.reachable_group?.focus_next();
  }
  override on_start(): void {
    super.on_start?.();
    this.apply();
  }
  override on_resume(): void {
    super.on_resume?.();
    this.apply();
  }
}
