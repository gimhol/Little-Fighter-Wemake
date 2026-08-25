import { zip } from "compressing";
import { rm, rename, access } from "node:fs/promises";
import path from "node:path";
import { download } from "./download.mjs";
import { run } from "./run.mjs";

const args = process.argv.slice(2);

function argValue(key) {
  const idx = args.indexOf(`--${key}`);
  return idx !== -1 && args[idx + 1] !== undefined ? args[idx + 1] : undefined;
}

const action = args[0];
const ZIP_URL = argValue('url');
const DIR_PATH = argValue('dir');
const ZIP_PATH = argValue('zip');

function printUsage() {
  console.log('用法: node ./scripts/zipsync.mjs <pull|push> --url <url> --dir <dir> --zip <zip>');
  console.log('  pull  从远程下载压缩包并解压');
  console.log('  push  将本地目录打包并上传');
  console.log('必填参数:');
  console.log('  --url <url>   远程下载地址');
  console.log('  --dir <dir>   需要打包的目录');
  console.log('  --zip <zip>   临时压缩包路径');
}

/** 从远程下载压缩包并解压 */
async function pull() {
  const filepath = await download(ZIP_URL, path.dirname(ZIP_PATH));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${DIR_PATH}.${stamp}.bk`;
  await rename(DIR_PATH, backup).catch(() => { });
  await zip.uncompress(filepath, path.dirname(DIR_PATH));
  await rm(filepath);
  console.log(`目录更新完成，旧目录已备份为 ${backup}`);
}

/** 将本地目录打包并上传 */
async function push() {
  await access(ZIP_PATH).then(
    () => console.warn(`[警告] ${ZIP_PATH} 已存在，将被覆盖`),
    () => { }
  );
  await zip.compressDir(DIR_PATH, ZIP_PATH);
  await run(`fdeploy`, [`-s`, `oss`, `--REMOTE_DIR`, `convertings`, `--LOCAL_PATH`, ZIP_PATH]);
  await rm(ZIP_PATH);
  console.log('压缩包上传完成');
}

const missing = [];
if (!ZIP_URL) missing.push('--url');
if (!DIR_PATH) missing.push('--dir');
if (!ZIP_PATH) missing.push('--zip');

switch (action) {
  case 'pull':
  case 'push':
    if (missing.length > 0) {
      console.error(`缺少参数: ${missing.join(', ')}`);
      printUsage();
      process.exit(1);
    }
    if (action === 'pull') await pull();
    else await push();
    break;
  default:
    printUsage();
    process.exit(1);
}
