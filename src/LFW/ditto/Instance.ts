import type { IVector2, IVector3 } from "../defines";
import type { LFW } from "../LFW";
import type { UINode } from '../ui/UINode';
import type { World } from "../World";
import type { ICache } from './cache/ICache';
import type { IFullScreen } from './fullscreen/IFullScreen';
import type { IImageMgr } from "./image/IImageMgr";
import type { IImporter } from './importer/IImporter';
import type { IReadable } from "./IReadable";
import type { IRender } from "./IRender";
import type { ITimeout } from "./ITimeout";
import type { IKeyboard } from './keyboard/IKeyboard';
import type { IPointings } from './pointings/IPointings';
import type { IUINodeRenderer } from "./render/IUINodeRenderer";
import type { IWorldRenderer } from "./render/IWorldRenderer";
import type { ISounds } from './sounds/ISounds';
import type { IUIInputHandle } from "./ui/IEventHandle";
import type { IXML } from './xml/IXML';
import type { IZip } from './zip/IZip';

export interface IDitto extends IDittoPack {
  setup(pack: IDittoPack): void;
  vec3(x?: number, y?: number, z?: number): IVector3;
  vec2(x?: number, y?: number): IVector2;
}

export interface IDittoPack {
  Timeout: ITimeout;
  Interval: ITimeout;
  Render: IRender;
  MD5: (...args: string[]) => string;
  Zip: {
    read_file(file: IReadable): Promise<IZip>;
    read_buf(name: string, buf: Uint8Array): Promise<IZip>;
    download(
      url: string,
      on_progress: (progress: number, size: number) => void
    ): Promise<IZip>;
  };
  Sounds: new (...args: any[]) => ISounds;
  Keyboard: new (lfw: LFW, ...args: any[]) => IKeyboard;
  Pointings: new (...args: any[]) => IPointings;
  FullScreen: new (...args: any[]) => IFullScreen;
  Importer: IImporter;
  Cache: ICache;
  Vector3: new (x?: number, y?: number, z?: number) => IVector3;
  Vector2: new (x?: number, y?: number) => IVector2;
  WorldRender: new (world: World) => IWorldRenderer;
  UINodeRenderer: new (uinode: UINode) => IUINodeRenderer;
  ImageMgr: new (lfw: LFW) => IImageMgr;
  UIInputHandle: new (lfw: LFW) => IUIInputHandle;
  XML: IXML;
  warn(...args: any[]): unknown;
  error(...args: any[]): unknown;
  Log(...args: any[]): unknown;
  debug(...args: any[]): unknown;
  DEV: boolean;
  alert(msg: string): unknown;
}

const _Ditto: Partial<IDitto> = {
  setup(pack: IDittoPack) {
    Object.assign(this, pack);
  },
  vec3(x?: number, y?: number, z?: number): IVector3 {
    const C = this.Vector3!
    return new C(x, y, z)
  },
  vec2(x?: number, y?: number): IVector2 {
    const C = this.Vector2!
    return new C(x, y)
  }
};
export const Ditto = _Ditto as IDitto