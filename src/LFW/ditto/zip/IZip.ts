import type { IZipObject } from "./IZipObject";

export interface IZip {
  readonly files: { [key in string]?: IZipObject }
  readonly name: string
  /** 该数据包文件原始字节的 MD5（创建时按源字节计算，与 info json 的 md5 同语义） */
  readonly md5: string
  file(path: string): IZipObject | null;
  file(path: RegExp): IZipObject[];
  file(path: string | RegExp): IZipObject | null | IZipObject[];
  set(path: string, data: string | Uint8Array | ArrayBuffer): void;
  blob(): Promise<Uint8Array>;
}
