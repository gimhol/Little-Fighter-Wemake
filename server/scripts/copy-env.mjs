/**
 * 构建后拷贝 .env 到 dist/cjs
 *
 * 仅当 server/.env 存在时执行拷贝（不存在则跳过），
 * 路径基于脚本自身位置解析，与运行时的当前目录无关（跨平台）。
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script_dir = dirname(fileURLToPath(import.meta.url));
const server_dir = join(script_dir, '..');

const src = join(server_dir, '.env');
const dst_dir = join(server_dir, 'dist', 'cjs');
const dst = join(dst_dir, '.env');

if (!existsSync(src)) {
  console.log('[copy-env] .env not found, skip');
  process.exit(0);
}

mkdirSync(dst_dir, { recursive: true });
copyFileSync(src, dst);
console.log(`[copy-env] copied ${src} -> ${dst}`);
