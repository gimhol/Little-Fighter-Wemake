import { decodeUTF8 } from "../../utils/utf8";
import type { IBlob } from "../IBlob";

/**
 * 缓存数据
 *
 * @export
 * @interface ICacheData
 */

export interface ICacheData {
  /**
   * 缓存数据ID
   *
   * @type {number}
   * @memberof ICacheData
   */
  id: number;

  /**
   * 缓存数据名
   *
   * @type {string}
   * @memberof ICacheData
   */
  name: string;

  /**
   * 缓存数据版本
   *
   * @type {number}
   * @memberof ICacheData
   */
  version: number;

  /**
   * 缓存数据类型
   *
   * @type {string}
   * @memberof ICacheData
   */
  type: string;

  /**
   * 缓存数据 (Uint8Array)
   * 
   * 跨平台通用字段，注意：浏览器 IndexedDB 存大量 Uint8Array 会导致内存问题，
   * 浏览器端应优先使用 blob 字段存储
   *
   * @type {Uint8Array}
   * @memberof ICacheData
   */
  data?: Uint8Array | null;

  blob?: IBlob | null;

  /**
   * 缓存日期
   *
   * @type {number}
   * @memberof ICacheData
   */
  create_date: number;
}
export async function read_cache_string(cache: ICacheData): Promise<string | undefined> {
  let { data } = cache;
  const { blob } = cache;
  if (!data && blob) {
    const buf = await blob.arrayBuffer()
    data = new Uint8Array(buf)
  }
  if (!data) return void 0;
  return decodeUTF8(data);
}