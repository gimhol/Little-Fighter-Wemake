import type { LFW } from "@/LFW";

export interface ILoadedImage {
  img: HTMLImageElement;
  /** 实际命中的文件路径（可能是 @2x/@3x/@4x 变体） */
  path: string;
  /**
   * 倍数图倍数（1 表示普通图）。
   *
   * 引擎里 `pic.x/y/w/h` 都是逻辑(1x)尺寸，高倍图的实际像素要乘以该倍数，
   * 见 `ImageMgr.get_img_scale` 与 `outline.frag` 的 `ow = tw / tsw`。
   */
  scale: number;
}

const cache = new Map<string, Promise<ILoadedImage>>();
const resolved = new Map<string, ILoadedImage>();

/** 与 `ImageMgr.get_img_scale` 同规则的倍数解析 */
export function get_img_scale(path: string): number {
  const n = /@(\d)[xX](\.(png|webp|jpg|jpeg|bmp))$/.exec(path)?.[1]
    ?? /@(\d)[xX]\//.exec(path)?.[1];
  return Math.max(1, Number(n) || 1);
}

function create_img(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片解码失败"));
    img.src = url;
  });
}

/** 从已加载的数据包里取图片（含 @Nx 后备），成功/失败都会缓存。 */
export function load_image(lfw: LFW, path: string): Promise<ILoadedImage> {
  const hit = cache.get(path);
  if (hit) return hit;
  const task = (async () => {
    const [res] = lfw.zips.find([path], false);
    if (!res) throw new Error("图片不存在：" + path);
    const ret: ILoadedImage = {
      img: await create_img(await res.file.blob_url()),
      path: res.file.name,
      scale: get_img_scale(res.file.name),
    };
    resolved.set(path, ret);
    return ret;
  })();
  cache.set(path, task);
  task.catch(() => cache.delete(path));
  return task;
}

/** 已成功加载过的图片信息 */
export function find_loaded_image(path: string): ILoadedImage | undefined {
  return resolved.get(path);
}

export function clear_image_cache(): void {
  cache.clear();
  resolved.clear();
}
