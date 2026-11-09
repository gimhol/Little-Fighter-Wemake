import type { IStyle } from "../../defines/IStyle";
import type { ImageInfo } from "../../ditto/image/ImageInfo";
import type { TextInfo } from "../../ditto/image/TextInfo";
import type { IComponentInfo } from "../../ui/IComponentInfo";
import type { IUIAction } from "../../ui/IUIAction";
import type { IUIImgInfo } from "../../ui/IUIImgInfo.dat";
import type { IUIInfo, TUIActionPlace } from "../../ui/IUIInfo.dat";

/**
 * cook 阶段（`cook_ui_info`）产出的 UI 数据
 *
 * 这是加载器侧的类型：模板合并、字段解析、图片加载都完成后得到的树。
 * 模型侧 `UINode` 不认识它；由 `UINodeBuilder` 把它映射成节点。
 *
 * @export
 * @interface ICookedUIInfo
 */
export interface ICookedUIInfo extends IUIInfo {
  id: string;
  name: string;
  pos: [number, number, number];
  scale: [number, number, number];
  center: [number, number, number];
  parent?: ICookedUIInfo;
  items?: ICookedUIInfo[];
  img_info?: ImageInfo;
  txt_info?: TextInfo;
  style?: IStyle | null;
  size?: [number, number, number];
  img?: IUIImgInfo;
  values: { [x in string]?: any };
  component: IComponentInfo[];
  background?: string;
  foreground?: string;
  count?: number;
  visible?: boolean;
  disabled?: boolean;
  clips?: boolean;
  local_only?: boolean;
  ignore_esc?: boolean;
  touchable?: boolean;
  backgroundAlpha?: number;
  foregroundAlpha?: number;
  outlineWidth?: number;
  outlineAlpha?: number;
  opacity?: number;
  actions?: { [x in TUIActionPlace]?: IUIAction[] };
}
