import type { IStyle } from "../defines/IStyle";
import type { IFlexStyleData } from "./flex_style";
import type { IComponentInfo } from "./IComponentInfo";
import type { IUIAction } from "./IUIAction";
import type { IUIImgInfo } from "./IUIImgInfo.dat";
import type { UIActionEnum } from "./UIActionEnum";
export type ToStringable<T> = {
  [K in keyof T]: T[K] | string;
};
export type ToStringableDeep<T> =
  T extends Array<infer U>
  ? Array<ToStringableDeep<U>>
  : T extends Record<string, any>
  ? { [K in keyof T]: ToStringableDeep<T[K]> }
  : T | string;
export type TComponentInfo = IComponentInfo | string
export type TUIAction = IUIAction | UIActionEnum
export type TUIImgInfo = ToStringableDeep<IUIImgInfo> | string
export type TUIActionPlace = 'rclick' | 'mclick' | 'click' | 'resume' | 'pause' | 'start' | 'stop';

export interface IUIInfo {
  /**
   * 节点ID
   *
   * @type {string}
   * @memberof IUIInfo
   */
  id?: string;

  /**
   * 节点名
   *
   * @type {string}
   * @memberof IUIInfo
   */
  name?: string;

  pos?: number[] | string;
  /**
   * flex 布局声明（子项属性与容器属性共用）
   *
   * 支持对象，或 CSS 声明风格的字符串：`"display:flex; direction:column; gap:6"`。
   * 未声明 `display: flex` 时节点保持原有的绝对定位行为。
   *
   * XML 里也可以拆成属性写：
   * `<node id="menu" size="200,120" flex="display:flex; direction:column; gap:6; align:center">`
   * 或 `<node id="menu" size="200,120" display="flex" direction="column" gap="6" align="center">`
   *
   * @type {(IFlexStyleData | string)}
   * @memberof IUIInfo
   */
  flex?: IFlexStyleData | string;
  opacity?: number | string;
  center?: number[] | string;
  scale?: number[] | string;
  size?: number[] | string;
  visible?: boolean | string;
  disabled?: boolean | string;
  clips?: boolean | string;

  /**
   * 是否只响应本地玩家的指针事件
   *
   * 默认为 `false`（未显式设置时跟随父节点，根节点为 `false`）；设为 `true` 时，远程玩家的指针事件不会作用于此节点
   *
   * @type {(boolean | string)}
   * @memberof IUIInfo
   */
  local_only?: boolean | string;
  ignore_esc?: boolean | string;
  color?: string;
  background?: string;
  backgroundAlpha?: number | string;
  foreground?: string;
  foregroundAlpha?: number | string;
  outlineColor?: string;
  outlineWidth?: number | string;
  outlineAlpha?: number | string;
  img?: TUIImgInfo;
  i18n?: string;
  style?: IStyle | string | null;
  dev_component?: TComponentInfo[];
  component?: TComponentInfo[];
  actions?: { [x in TUIActionPlace]?: TUIAction | TUIAction[] };
  items?: (IUIInfo | string)[];
  auto_focus?: boolean;

  /**
   * 模板名
   *
   * @type {string}
   * @memberof IUIInfo
   */
  template?: string;

  /**
   * 循环创建次数，默认为1
   *
   * @type {number}
   * @memberof IUIInfo
   */
  count?: number | string;
  template_values?: { [x in string]?: any };
  values?: { [x in string]?: any };
  templates?: { [x in string]?: IUIInfo };
}
