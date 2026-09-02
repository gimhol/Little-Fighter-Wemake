import type { LFW } from "@/LFW";
import * as T from "../_t";

const GLB_MAGIC = 'glTF';
const CHUNK_TYPE_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_TYPE_BIN = 0x004e4942;  // 'BIN\0'

/** 解析 GLB 容器，取出 JSON 与内嵌 BIN 块；非 GLB 按 JSON 文本处理 */
function read_glb(data: ArrayBuffer): { json: any; bin?: ArrayBuffer } {
  const decoder = new TextDecoder()
  if (decoder.decode(new Uint8Array(data, 0, 4)) !== GLB_MAGIC) {
    return { json: JSON.parse(decoder.decode(data)) }
  }
  const view = new DataView(data)
  let offset = 12
  let json: any
  let bin: ArrayBuffer | undefined
  while (offset + 8 <= data.byteLength) {
    const chunk_length = view.getUint32(offset, true)
    const chunk_type = view.getUint32(offset + 4, true)
    const start = offset + 8
    if (chunk_type === CHUNK_TYPE_JSON) {
      json = JSON.parse(decoder.decode(new Uint8Array(data, start, chunk_length)))
    } else if (chunk_type === CHUNK_TYPE_BIN) {
      bin = data.slice(start, start + chunk_length)
    }
    offset = start + chunk_length
    if (offset % 4 !== 0) offset += 4 - (offset % 4)
  }
  if (json === undefined) throw new Error('[ZipGLTFLoader] GLB 缺少 JSON 块')
  return { json, bin }
}

function guess_image_mime(uri: string): string {
  const name = uri.split('?')[0].toLowerCase()
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.ktx2')) return 'image/ktx2'
  return 'application/octet-stream'
}

/**
 * 从 LFW 数据包（zip/网络）加载 GLB/GLTF 的 GLTFLoader。
 *
 * 注意：three r181 的 GLTFLoader 类上只有 load/parse/parseAsync 可覆写，
 * 外部资源（.bin/贴图）由内部 GLTFParser 通过 HTTP fetch 加载，无法直接拦截。
 * 因此这里改为：先解析 GLB 容器 / glTF JSON，把外部资源从数据包读出
 * 并改写为 blob: URL，再交给基类 parse() 解析。
 *
 * 用法：
 *   const loader = new ZipGLTFLoader(lfw)      // 无状态，可全局共享
 *   const gltf = await loader.parse_package(buf, 'builtin_data/model')
 */
export class ZipGLTFLoader extends T.GLTFLoader {
  protected lfw: LFW;

  constructor(lfw: LFW) {
    super()
    this.lfw = lfw
  }

  /** 把 GLB 内的相对/绝对资源路径解析为数据包路径（base_dir 为 GLB 所在目录） */
  protected resolve_url(base_dir: string, url: string): string {
    if (/^([a-z]+:)?\/\//i.test(url) || url.startsWith('data:')) return url
    const clean = url.replace(/^\.\//, '')
    if (!base_dir) return clean
    return `${base_dir}/${clean}`.replace(/\/+/g, '/')
  }

  override load(
    url: string,
    onLoad: (gltf: T.GLTF) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void {
    const idx = url.lastIndexOf('/')
    const base_dir = idx >= 0 ? url.substring(0, idx) : ''
    void this.lfw.import_array_buffer(url, true)
      .then(([buf]) => this.import_gltf(buf, base_dir))
      .then(gltf => onLoad(gltf))
      .catch(err => onError?.(err))
  }

  override parseAsync(data: string | ArrayBuffer, path?: string): Promise<T.GLTF> {
    return this.import_gltf(data)
  }

  /** 解析数据包中的 GLB/GLTF（base_dir 为 GLB 所在目录，用于解析相对资源） */
  parse_package(data: string | ArrayBuffer, base_dir = ""): Promise<T.GLTF> {
    return this.import_gltf(data, base_dir)
  }

  /** 解析 GLB/GLTF：重写外部资源为 blob: URL 后交给基类 parse */
  protected async import_gltf(data: string | ArrayBuffer, base_dir = ""): Promise<T.GLTF> {
    const { json, bin } = typeof data === 'string'
      ? { json: JSON.parse(data), bin: undefined }
      : read_glb(data)
    await this.rewrite_resources(json, bin, base_dir)
    return new Promise<T.GLTF>((resolve, reject) => {
      this.parse(json as any, '', resolve, reject)
    })
  }

  /** 把外部 .bin/贴图 URI 改写为可从数据包加载的 blob: URL */
  protected async rewrite_resources(json: any, bin: ArrayBuffer | undefined, base_dir: string): Promise<void> {
    const buffers: any[] = Array.isArray(json.buffers) ? json.buffers : []
    for (const buffer of buffers) {
      if (!buffer) continue
      const uri = buffer.uri
      if (uri == null) {
        if (bin) buffer.uri = this.blob_url(bin)   // GLB 内嵌 BIN 块
        continue
      }
      if (uri.startsWith('data:')) continue
      buffer.uri = await this.import_buffer_url(base_dir, uri)
    }
    const images: any[] = Array.isArray(json.images) ? json.images : []
    for (const image of images) {
      if (!image || image.bufferView !== undefined) continue
      const uri = image.uri
      if (!uri || uri.startsWith('data:')) continue
      image.uri = await this.import_image_url(base_dir, uri)
    }
  }

  protected async import_buffer_url(base_dir: string, uri: string): Promise<string> {
    const [buf] = await this.lfw.import_array_buffer(this.resolve_url(base_dir, uri), true)
    return this.blob_url(buf)
  }

  protected async import_image_url(base_dir: string, uri: string): Promise<string> {
    const [buf] = await this.lfw.import_array_buffer(this.resolve_url(base_dir, uri), true)
    return URL.createObjectURL(new Blob([buf], { type: guess_image_mime(uri) }))
  }

  protected blob_url(buf: ArrayBuffer): string {
    return URL.createObjectURL(new Blob([buf]))
  }
}
