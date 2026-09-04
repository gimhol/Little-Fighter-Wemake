import type { IDataInfo } from './defines/IDataInfo';
import type { IZip } from './ditto/zip/IZip';
import type { IZipObject } from './ditto/zip/IZipObject';
import { get_import_fallbacks } from './loader/get_import_fallbacks';

export interface IZipResult {
  origin: string;
  file: IZipObject;
  zip: IZip;
}

export interface ILoadedZip {
  readonly zip: IZip;
  readonly info: IDataInfo;
}

export class ZipMgr {
  private list: ILoadedZip[] = [];

  get length(): number {
    return this.list.length
  }

  get all(): readonly ILoadedZip[] {
    return this.list
  }

  get zips(): IZip[] {
    return this.list.map(v => v.zip)
  }

  get md5s(): string[] {
    return this.list.map(v => v.info.md5 ?? '')
  }

  get data_infos(): IDataInfo[] {
    return this.list.map(v => v.info)
  }

  add(zip: ILoadedZip): void {
    this.list.unshift(zip)
  }

  clear(): void {
    this.list.length = 0
  }

  /**
   * 在已加载数据包中查找路径
   *
   * @param paths  待查找路径
   * @param exact  false 时对每个路径做回退扩展（get_import_fallbacks）
   * @returns 全部命中（路径 × 数据包），按“后加载优先”排序
   */
  find(paths: string[], exact: boolean): IZipResult[] {
    if (!exact) {
      const temp = new Set(paths);
      for (const path of paths) {
        const [more] = get_import_fallbacks(path)
        for (const path of more) {
          temp.add(path)
        }
      }
      paths = Array.from(temp)
    }
    const ret: IZipResult[] = [];
    for (const { zip } of this.list) {
      for (const path of paths) {
        const file = zip.file(path)
        if (!file) continue;
        ret.push({ file, zip, origin: `[${zip.name}]${file.name}` })
      }
    }
    return ret
  }
}
