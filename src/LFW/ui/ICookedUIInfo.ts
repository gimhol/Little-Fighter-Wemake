import type { IStyle } from "../defines/IStyle";
import type { ImageInfo } from "../ditto/image/ImageInfo";
import type { TextInfo } from "../ditto/image/TextInfo";
import type { IComponentInfo } from "./IComponentInfo";
import type { IUIAction } from "./IUIAction";
import type { IUIImgInfo } from "./IUIImgInfo.dat";
import type { IUIInfo, TUIActionPlace } from "./IUIInfo.dat";

export interface ICookedUIInfo extends IUIInfo {
  id: string;
  name: string;
  raw?: IUIInfo;
  pos: [number, number, number];
  scale: [number, number, number];
  center: [number, number, number];
  parent?: ICookedUIInfo;
  items?: ICookedUIInfo[];
  img_info?: ImageInfo;
  txt_info?: TextInfo;
  style?: IStyle | null;
  size: [number, number, number];
  img?: IUIImgInfo;
  values: { [x in string]?: any };
  component: IComponentInfo[];
  background?: string;
  foreground?: string;
  count?: number;
  visible?: boolean;
  disabled?: boolean;
  backgroundAlpha?: number;
  foregroundAlpha?: number;
  outlineWidth?: number;
  outlineAlpha?: number;
  opacity?: number;
  actions?: { [x in TUIActionPlace]?: IUIAction[] };
}