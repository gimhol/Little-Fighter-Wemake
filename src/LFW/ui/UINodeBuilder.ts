import type { LFW } from "../LFW";
import { is_num } from "../utils/type_check/is_num";
import type { ICookedUIInfo } from "../loader/ui/ICookedUIInfo";
import { UINode } from "./UINode";
import type { UILayer } from "./UILayer";
import type { UIComponent } from "./component/UIComponent";

/**
 * 把 cook 阶段的 UI 树转换为 {@link UINode} 树
 *
 * 属于“建树”和“初始化映射”的信息（模板合并后的 `items` / `component` / `count`
 * 以及各字段的赋值）都只在这里出现；UINode 本身不认识 cook 产物类型。
 *
 * @export
 * @class UINodeBuilder
 */
export class UINodeBuilder {
  /**
   * 递归构造节点树（含组件工厂、`count` 展开、flex 刷新）
   */
  static create(lfw: LFW, info: ICookedUIInfo, parent?: UINode, layer?: UILayer): UINode {
    const ret = new UINode(lfw, parent, layer);
    UINodeBuilder.fill(ret, info);

    const components: UIComponent[] = info.component
      ? lfw.factory.create_components(ret, info.component)
      : [];
    ret._attach_components(components);

    if (info.items) {
      for (const item_info of info.items) {
        const count = (is_num(item_info.count) && item_info.count > 0) ? item_info.count : 1;
        for (let i = 0; i < count; i++)
          ret.add_child(UINodeBuilder.create(lfw, item_info, ret));
      }
    }
    for (const component of components)
      component.on_add?.();
    ret.fire_singleton_links();
    ret.flush_flex();
    return ret;
  }

  /**
   * 把 cook 数据写入节点（初始化映射的唯一定义处）
   */
  protected static fill(node: UINode, info: ICookedUIInfo): void {
    node.id = info.id;
    node.name = info.name;
    node.image_desc = info.img ?? null;
    node.template_values = info.template_values;
    node.disabled = info.disabled == true;
    node.visible = info.visible != false;
    node.clip_children = info.clips == true;
    node.local_only = info.local_only;
    node.ignore_esc = info.ignore_esc == true;
    node.touchable = info.touchable;
    node.opacity = info.opacity ?? 1;
    node.center.set(...info.center);
    node.pos.set(...info.pos);
    if (info.size) node.size.set(...info.size);
    node.stretchable = !info.size;
    node.follow_screen = info.follow_screen === true;
    node.scale.set(...info.scale);
    node.flex.assign(info.flex);
    if (info.style) node.style.assign(info.style);
    if (info.i18n) node.set_i18n(info.i18n, info.txt_info);
    else node.text = info.txt_info ?? null;
    node.image = info.img_info ?? null;
    node.color = info.color ?? '';
    node.outlineColor = info.outlineColor;
    node.outlineWidth = info.outlineWidth;
    node.outlineAlpha = info.outlineAlpha;
    node.auto_focus = info.auto_focus ?? false;
    if (typeof info.background === 'string')
      node.background = info.background;
    if (typeof info.foreground === 'string')
      node.foreground = info.foreground;
    if (typeof info.backgroundAlpha === 'number')
      node.backgroundAlpha = info.backgroundAlpha;
    if (typeof info.foregroundAlpha === 'number')
      node.foregroundAlpha = info.foregroundAlpha;
    node.set_actions(info.actions);
    if (info.values) Object.assign(node.values, info.values);
  }
}
