import type { LFW } from "@/LFW";
import { AnimationClip, Mesh, MeshBasicMaterial, Object3D } from "../_t";
import { ZipGLTFLoader } from "./GLTFZipLoader";

export interface IModelCacheEntry {
  root: Object3D;
  animations: AnimationClip[];
  /** 引用计数：>0 表示至少一个实体正在挂载使用 */
  refs: number;
}

/**
 * 全局共享的 3D 模型缓存（数据包 GLB/GLTF）。
 *
 * - 同一路径的模型只加载/解析一次，多实体复用同一 root；
 * - 并发请求共享同一个加载 Promise；
 * - 引用计数归零时（release）才真正回收 GPU 资源。
 */
export class ModelCache {
  static readonly instance = new ModelCache();

  protected entries = new Map<string, IModelCacheEntry>();
  protected loading = new Map<string, Promise<IModelCacheEntry>>();

  /** GLB 所在目录（用于解析相对资源） */
  static glb_dir_of(path: string): string {
    const idx = path.lastIndexOf('/')
    return idx >= 0 ? path.substring(0, idx) : ''
  }

  /** 已加载则返回条目（不计数） */
  peek(path: string): IModelCacheEntry | undefined {
    return this.entries.get(path)
  }

  /** 获取/加载模型；并发请求共享同一 Promise */
  async get(lfw: LFW, path: string, exact = true): Promise<IModelCacheEntry> {
    const hit = this.entries.get(path)
    if (hit) return hit
    let p = this.loading.get(path)
    if (!p) {
      p = this.load(lfw, path, exact)
      this.loading.set(path, p)
      p.catch(() => { }).finally(() => this.loading.delete(path))
    }
    return p
  }

  protected async load(lfw: LFW, path: string, exact: boolean): Promise<IModelCacheEntry> {
    const loader = new ZipGLTFLoader(lfw)
    const { data: buf } = await lfw.resources.import_array_buffer(path, exact)
    const gltf = await loader.parse_package(buf, ModelCache.glb_dir_of(path))
    const root = gltf.scene ?? new Object3D()
    // 材质保留 GLB 自身 side：镜像(scale.x=-1)时 three 会按负行列式自动翻转 frontFace，
    // FrontSide 材质左右两向都能正确渲染（无需强制双面）。
    const entry: IModelCacheEntry = {
      root,
      animations: gltf.animations ?? [],
      refs: 0,
    }
    this.entries.set(path, entry)
    return entry
  }

  /** 引用 +1（挂载时调用） */
  retain(path: string): void {
    const e = this.entries.get(path)
    if (e) e.refs++
  }

  /** 引用 -1；归零时回收 GPU 资源并从缓存移除 */
  release(path: string): void {
    const e = this.entries.get(path)
    if (!e) return
    if (--e.refs <= 0) {
      this.entries.delete(path)
      dispose_root(e.root)
    }
  }

  /** 失效条目（加载失败重试用） */
  invalidate(path: string): void {
    this.entries.delete(path)
  }
}

/** 递归回收几何/材质/贴图 */
export function dispose_root(root: Object3D): void {
  root.traverse(obj => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    mesh.geometry?.dispose()
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      const mat = m as MeshBasicMaterial
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'bumpMap', 'specularMap', 'envMap', 'lightMap']) {
        const tex = (mat as any)[key]
        if (tex?.isTexture) tex.dispose()
      }
      mat.dispose()
    }
  })
}
