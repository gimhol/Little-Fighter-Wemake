import { deduped } from './base/dedup';
import * as I from "./ditto";
import { get_import_fallbacks } from "./loader/get_import_fallbacks";
import type { IZipResult, ZipMgr } from "./ZipMgr";

/** 资源导入的统一返回结构 */
export interface ImportResult<T = any> {
  /** 实际数据（json 对象 / Blob URL / ImageBitmap / ArrayBuffer / XML 根元素） */
  data: T;
  /** 命中文件名/URL（zip 内 file.name；网络回退时为命中 URL） */
  file?: string;
  /** 来源标签（zip 的 origin；网络回退时为空） */
  origin?: string;
}

export class Resources {
  static readonly TAG = 'Resources'
  constructor(protected readonly zip_mgr: ZipMgr) { }

  /** 在已加载数据包中查找路径（命中数据包/文件名），未命中交给网络 Importer */
  protected find(paths: string[], exact: boolean): IZipResult[] {
    return this.zip_mgr.find(paths, exact)
  }

  async import_json<C = any>(path: string, exact: boolean = true): Promise<ImportResult<C>> {
    const key = `${Resources.TAG}.json.${path}.${exact}`;
    return deduped(key, async () => {
      const paths = exact ? [path] : get_import_fallbacks(path)[0];
      const { file, origin: tag } = this.find(paths, true).at(0) || {}
      if (file && tag) return { data: await file.json<C>(), file: file.name, origin: tag };
      const [data, hit] = await I.Ditto.Importer.import_as_json<C>(paths);
      return { data, file: hit };
    });
  }

  /** 加载资源：返回内存 Blob 的 object URL */
  async import_resource(path: string, exact: boolean): Promise<ImportResult<I.BlobUrl>> {
    const key = `${Resources.TAG}.resource.${path}.${exact}`;
    return deduped(key, async () => {
      const paths = exact ? [path] : get_import_fallbacks(path)[0];
      const { file, origin: tag } = this.find(paths, true).at(0) || {}
      if (file && tag) return { data: await file.blob_url(), file: file.name, origin: tag };
      const [data, hit] = await I.Ditto.Importer.import_as_blob_url(paths);
      return { data, file: hit };
    });
  }

  /** 以 ImageBitmap 形式加载图片（跳过 Blob URL，直接解码，GPU 零拷贝） */
  async import_image_bitmap(path: string, exact: boolean): Promise<ImportResult<ImageBitmap>> {
    const key = `${Resources.TAG}.image_bitmap.${path}.${exact}`;
    return deduped(key, async () => {
      const paths = exact ? [path] : get_import_fallbacks(path)[0];
      const { file, origin: tag } = this.find(paths, true).at(0) || {}
      if (file && tag) return { data: await file.image_bitmap(), file: file.name, origin: tag };
      // 网络回退：fetch → Blob → ImageBitmap
      const [blob_url] = await I.Ditto.Importer.import_as_blob_url(paths);
      const resp = await fetch(blob_url);
      const blob = await resp.blob();
      return { data: await createImageBitmap(blob), file: paths[0] };
    });
  }

  async import_array_buffer(path: string, exact: boolean): Promise<ImportResult<ArrayBuffer>> {
    const key = `${Resources.TAG}.array_buffer.${path}.${exact}`;
    return deduped(key, async () => {
      const paths = exact ? [path] : get_import_fallbacks(path)[0];
      const { file, origin: tag } = this.find(paths, true).at(0) || {}
      if (file && tag) return { data: await file.array_buffer(), file: file.name, origin: tag };
      const [data, hit] = await I.Ditto.Importer.import_as_array_buffer(paths);
      return { data, file: hit };
    });
  }

  async import_xml(path: string, exact: boolean = true): Promise<ImportResult<I.IXMLElement>> {
    const key = `${Resources.TAG}.xml.${path}.${exact}`;
    return deduped(key, async () => {
      const paths = exact ? [path] : get_import_fallbacks(path)[0];
      const { file, origin: tag } = this.find(paths, true).at(0) || {}
      let text: string;
      if (file && tag) {
        text = await file.text();
      } else {
        [text] = await I.Ditto.Importer.import_as_text(paths);
      }
      const root = I.Ditto.XML.parse(text);
      if (!root) throw new Error(`[${Resources.TAG}::import_xml] failed to parse: ${path}`);
      return { data: root, file: file?.name || paths[0], origin: tag };
    });
  }
}
