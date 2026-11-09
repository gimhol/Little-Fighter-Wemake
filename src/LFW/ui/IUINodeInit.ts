import type { ImageInfo } from "../ditto/image/ImageInfo";
import type { TextInfo } from "../ditto/image/TextInfo";
import type { IStyle } from "../defines/IStyle";
import type { IFlexStyleData } from "./flex_style";
import type { IUIAction } from "./IUIAction";
import type { TUIActionPlace } from "./IUIInfo.dat";
import type { IUIImgInfo } from "./IUIImgInfo.dat";

/**
 * UINode 的初始化数据（模型层契约）
 *
 * 这里只放**已经解析好的值**，不再有 `"10,20"` 这类字符串联合类型；
 * 解析、模板合并、图片加载都属于 cook 阶段（`cook_ui_info`），不是节点模型的事。
 *
 * `ICookedUIInfo` 必须能直接赋值给它——由 `LFW/loader/ui/ICookedUIInfo.ts` 末尾的编译期断言保证。
 *
 * @export
 * @interface IUINodeInit
 */
export interface IUINodeInit {
  id?: string;
  name?: string;

  pos?: [number, number, number];
  scale?: [number, number, number];
  center?: [number, number, number];
  size?: [number, number, number];
  flex?: IFlexStyleData | string;

  style?: IStyle | null;
  i18n?: string;
  /** cook 阶段测量好的文本 */
  txt_info?: TextInfo;
  /** 渲染器需要的图片描述（裁剪/平铺/九宫格参数） */
  img?: IUIImgInfo;
  /** cook 阶段加载好的图片 */
  img_info?: ImageInfo;
  color?: string;

  outlineColor?: string;
  outlineWidth?: number;
  outlineAlpha?: number;
  background?: string;
  backgroundAlpha?: number;
  foreground?: string;
  foregroundAlpha?: number;

  auto_focus?: boolean;
  disabled?: boolean;
  visible?: boolean;
  clips?: boolean;
  local_only?: boolean;
  ignore_esc?: boolean;
  touchable?: boolean;
  opacity?: number;

  actions?: { [x in TUIActionPlace]?: IUIAction[] };
  values?: { [x in string]?: any };
  template_values?: { [x in string]?: any };
}
