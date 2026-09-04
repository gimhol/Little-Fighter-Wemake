import SparkMD5 from "spark-md5";
export function md5(...args: string[]): string {
  const s = new SparkMD5();
  for (const t of args) s.append(t);
  return s.end();
}

/** 计算二进制数据的 MD5（用于数据包文件校验，语义与打包工具 file_md5_str 一致） */
export function md5_buf(data: Uint8Array): string {
  const buf: ArrayBuffer = data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
    ? data.buffer as ArrayBuffer
    : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  return SparkMD5.ArrayBuffer.hash(buf);
}
