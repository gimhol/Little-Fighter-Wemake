/**
 * Firefox 扩展打包脚本
 * 
 * 用法:
 *   node scripts/package-extension-firefox.mjs              → 构建 + 打包 .xpi
 *   node scripts/package-extension-firefox.mjs --no-build   → 仅打包（跳过构建）
 * 
 * Firefox 扩展 (.xpi) 本质是 zip 文件。可直接在 about:debugging 加载或提交到 AMO。
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const EXT_DIST = join(ROOT, 'dist-extension');
const RELEASE_DIR = join(ROOT, 'release');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const VERSION = pkg.version;

const skipBuild = process.argv.includes('--no-build');

// Step 1: Build (optional)
if (!skipBuild) {
  console.log('[firefox] Building extension...');
  execSync('node scripts/build-extension.mjs', { cwd: ROOT, stdio: 'inherit' });
}

// Step 2: Firefox 兼容性修正
const manifestPath = join(EXT_DIST, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

// Firefox MV3 也使用 CSP 对象格式（与 Chrome 一致），无需转换

// Firefox 对 service_worker 支持有限，改用 event page (scripts)
if (manifest.background?.service_worker) {
  const sw = manifest.background.service_worker;
  manifest.background = { scripts: [sw] };
  console.log(`[firefox] ✅ 已切换 background.service_worker → scripts: ["${sw}"]`);
}

// 确保 browser_specific_settings 存在
if (!manifest.browser_specific_settings?.gecko?.id) {
  manifest.browser_specific_settings = { gecko: {} };
}
manifest.browser_specific_settings.gecko.id = manifest.browser_specific_settings.gecko.id || 'little-fighter-wemake@example.com';
// data_collection_permissions 需要 Firefox 140+
manifest.browser_specific_settings.gecko.strict_min_version = '140.0';
manifest.browser_specific_settings.gecko.data_collection_permissions = {
  required: ['none'],
};

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// Step 3: web-ext lint 验证，然后 Compress-Archive 打包
// 注意：web-ext build 会硬编码忽略 *.zip，导致 data.zip/prel.zip 丢失
// 所以用 web-ext 做 lint，用 Compress-Archive 做打包
mkdirSync(RELEASE_DIR, { recursive: true });

console.log('[firefox] Running web-ext lint...');
try {
  execSync(`npx web-ext lint --source-dir "${EXT_DIST}"`, { cwd: ROOT, stdio: 'inherit' });
} catch {
  console.warn('[firefox] ⚠️  lint 有警告（非致命），继续打包...');
}

const xpiPath = join(RELEASE_DIR, `lfw-firefox-v${VERSION}.xpi`);
if (existsSync(xpiPath)) rmSync(xpiPath);

console.log('[firefox] Creating .xpi...');
execSync(
  `powershell -Command "Compress-Archive -Path '${EXT_DIST}\\*' -DestinationPath '${xpiPath}' -Force"`,
  { cwd: ROOT, stdio: 'inherit' }
);
console.log(`[firefox] ✅ XPI: ${xpiPath}`);

console.log('');
console.log('[firefox] 🦊 Firefox 扩展打包完成！');
console.log('[firefox] → 调试: about:debugging#/runtime/this-firefox → 临时载入附加组件');
console.log(`[firefox] → 文件: ${xpiPath}`);
console.log('[firefox] → 提交到 AMO: https://addons.mozilla.org/developers/');
