import axios from "axios";
import json5 from "json5";
import JSZIP from "jszip";
import type { IReadable, IZip, IZipObject } from "../LFW/ditto";
import { is_str } from "../LFW/utils/type_check";

export class ZipObject implements IZipObject {
  protected inner: JSZIP.JSZipObject;
  get name() {
    return this.inner.name;
  }

  constructor(inner: JSZIP.JSZipObject) {
    this.inner = inner;
  }
  async text(): Promise<string> {
    return this.inner.async("text");
  }
  async json(): Promise<any> {
    return this.text().then(json5.parse);
  }
  async blob(): Promise<Uint8Array> {
    return this.inner.async("uint8array");
  }
  async blob_url(): Promise<string> {
    return URL.createObjectURL(new Blob([await this.array_buffer()]));
  }
  async array_buffer(): Promise<ArrayBuffer> {
    return this.inner.async('arraybuffer')
  }
  async uint8_array(): Promise<Uint8Array> {
    return this.inner.async('uint8array')
  }
  async image_bitmap(): Promise<ImageBitmap> {
    const buf = await this.array_buffer();
    const ext = this.name.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      bmp: 'image/bmp',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    const mime = mimeMap[ext || ''] || 'image/png';
    return createImageBitmap(new Blob([buf], { type: mime }));
  }
}

export class __Zip implements IZip {
  static async read_file(file: IReadable): Promise<IZip> {
    const buf = await file.arrayBuffer().then((raw) => new Uint8Array(raw));
    const jszip = await JSZIP.loadAsync(buf);
    return new __Zip(file.name, jszip);
  }
  static async read_buf(name: string, buf: Uint8Array): Promise<IZip> {
    const jszip = await JSZIP.loadAsync(buf);
    return new __Zip(name, jszip);
  }
  static async download(
    url: string,
    on_progress: (progress: number, size: number) => void,
  ): Promise<IZip> {
    const buf = await axios
      .get<ArrayBuffer>(url, {
        responseType: "arraybuffer",
        params: { time: Date.now() },
        onDownloadProgress: (e_1) => {
          const progress_1 = e_1.total
            ? Math.round((100 * e_1.loaded) / e_1.total)
            : 100;
          on_progress(progress_1, e_1.total ?? e_1.loaded);
        },
      })
      .then((resp) => new Uint8Array(resp.data));
    const jszip = await JSZIP.loadAsync(buf);
    return new __Zip(url, jszip);
  }

  readonly name: string;
  private inner: JSZIP;
  private _files: { [key in string]?: ZipObject } | null = null;
  private _caches: { [key in string]?: ZipObject[] } = {};

  private constructor(name: string, inner: JSZIP) {
    this.inner = inner;
    this.name = name;
  }

  file(path: string): ZipObject | null;
  file(path: RegExp): ZipObject[];
  file(path: string | RegExp): ZipObject | null | ZipObject[] {
    const { files } = this;
    if (is_str(path)) return files[path] ?? null;
    const flags = [...path.flags].sort().join('');
    const k = path.source + '|' + flags;
    if (this._caches[k]) return this._caches[k];
    const ret: ZipObject[] = this._caches[k] = [];
    for (const key in files) {
      const file = files[key];
      if (!file || !path.test(key)) continue;
      ret.push(file)
    }
    return ret

  }
  set(path: string, data: string): void {
    this.inner.file(path, data);
  }
  blob(): Promise<Uint8Array> {
    return this.inner.generateAsync({ type: 'uint8array' });
  }
  get files(): { [key in string]?: ZipObject } {
    if (this._files) return this._files;
    this._files = {}
    for (const key in this.inner.files)
      this._files[key] = new ZipObject(this.inner.files[key])
    return this._files;
  }
}