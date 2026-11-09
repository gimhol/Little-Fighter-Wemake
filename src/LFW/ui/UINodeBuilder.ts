import type { LFW } from "../LFW";
import { is_num } from "../utils/type_check/is_num";
import type { ICookedUIInfo } from "../loader/ui/ICookedUIInfo";
import { UINode } from "./UINode";
import type { UILayer } from "./UILayer";
import type { UIComponent } from "./component/UIComponent";

/**
 * 把 cook 阶段的 UI 树转换为 {@link UINode} 树
 *
 * 属于“建树”的信息（模板合并后的 `items` / `component` / `count`）只在这里出现；
 * UINode 本身只吃扁平的初始化数据，不再认识 cook 产物类型。
 *
 * @export
 * @class UINodeBuilder
 */
export class UINodeBuilder {
  /**
   * 递归构造节点树（含组件工厂、`count` 展开、flex 刷新）
   */
  static create(lfw: LFW, info: ICookedUIInfo, parent?: UINode, layer?: UILayer): UINode {
    const ret = new UINode(lfw, info, parent, layer);
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
}
