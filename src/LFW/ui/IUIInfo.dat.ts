import type { IStyle } from "../defines/IStyle";
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
  opacity?: number | string;
  center?: number[] | string;
  scale?: number[] | string;
  size?: number[] | string;
  visible?: boolean | string;
  disabled?: boolean | string;
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
