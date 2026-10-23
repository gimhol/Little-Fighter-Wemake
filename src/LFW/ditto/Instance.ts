import type { IVector2, IVector3 } from "../defines";
import type { LFW } from "../LFW";
import type { UINode } from '../ui/UINode';
import type { World } from "../World";
import type { ICache } from './cache/ICache';
import type { IFullScreen } from './fullscreen/IFullScreen';
import type { IBlob } from "./IBlob";
import type { IImageMgr } from "./image/IImageMgr";
import type { IImporter } from './importer/IImporter';
import type { IClock } from "./IClock";
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
import type { IDownloadedZip } from './zip/IDownloadedZip';
import type { IZip } from './zip/IZip';
import type { IZipDownloadOpts } from './zip/IZipDownloadOpts';

export interface IJSON5 {
  parse<T = any>(text: string): T;
  stringify(value: any): string;
}

export interface IDitto extends IDittoPack {
  setup(pack: IDittoPack): void;
  vec3(x?: number, y?: number, z?: number): IVector3;
  vec2(x?: number, y?: number): IVector2;
}

export interface IDittoPack {
  Timeout: ITimeout;
  Interval: ITimeout;
  Render: IRender;
  Clock: IClock;
  MD5: (...args: string[]) => string;
  JSON5: IJSON5;
  Zip: {
    read_file(file: IReadable): Promise<IZip>;
    read_buf(name: string, buf: Uint8Array): Promise<IZip>;
    read_blob(name: string, blob: IBlob, md5?: string): Promise<IZip>;
    get_stored(url: string, md5?: string): Promise<IBlob | null>;
    forget_stored(type: string, version: number): Promise<void>;
    download(
      url: string,
      on_progress: (progress: number, size: number) => void,
      opts?: IZipDownloadOpts,
    ): Promise<IDownloadedZip>;
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
  /** 是否运行在桌面壳（Wails/Electron）中 */
  IsDesktop: boolean;
  alert(msg: string): unknown;
  print(args: string): unknown;
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