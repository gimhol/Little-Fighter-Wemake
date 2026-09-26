/**
 * 部署网页版前端到 oss（lf.gim.ink/<版本号>/），版本号取 package.json 的 version。
 *
 * 以前这一步写在 package.json 里：`fdeploy -s oss --REMOTE_DIR 0.1.56 --LOCAL_PATH ./dist`，
 * 每次发版都要手改 REMOTE_DIR，容易漏。现在统一由本脚本算：
 *   npm run deploy          -> oss:0.1.56/
 *   npm run deploy:rn       -> oss:rn/0.1.56/
 *
 * 参数（透传给脚本，不传给 fdeploy）：
 *   --prefix <dir>  远端目录前缀（deploy:rn 用 rn）
 *   --local <dir>   本地目录，默认 ./dist
 *   --dry           只打印将要执行的命令，不上传
 *
 * 试运行请用 `npm run deploy:dry` 或直接 `node scripts/deploy-web.mjs --dry`：
 * `npm run deploy -- --dry` 里的 --dry 会被 npm 自己当成 --dry-run 吞掉，结果是真的上传。
 * 环境变量 DEPLOY_DRY=1 同样生效（CI 的 dry_run 走这个，不经过 npm 的参数解析）。
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function arg_value(key) {
  const idx = args.indexOf(key);
  return idx >= 0 ? args[idx + 1] : void 0;
}

const dry = args.includes('--dry') || process.env.DEPLOY_DRY === '1';
const prefix = (arg_value('--prefix') ?? '').replace(/^\/+|\/+$/g, '');
const local_path = arg_value('--local') ?? './dist';

const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
if (!version) {
  console.error('[deploy] package.json 里没有 version');
  process.exit(1);
}
const remote_dir = prefix ? `${prefix}/${version}` : version;
const fdeploy_args = ['-s', 'oss', '--REMOTE_DIR', remote_dir, '--LOCAL_PATH', local_path];

if (dry) {
  console.log(`[deploy] --dry：fdeploy ${fdeploy_args.join(' ')}`);
  process.exit(0);
}

const bin = join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'fdeploy.cmd' : 'fdeploy');
if (!existsSync(bin)) {
  console.error('[deploy] 找不到 fdeploy，先执行 npm i');
  process.exit(1);
}

console.log(`[deploy] v${version}：${local_path} -> oss:${remote_dir}/`);
const res = spawnSync(bin, fdeploy_args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(res.status ?? 1);
