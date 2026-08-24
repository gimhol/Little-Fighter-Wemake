/**
 * 将 docs/changelog/vX.Y.Z/{en,zh}.md 拼接合并到根目录的 CHANGELOG.EN.MD / CHANGELOG.MD。
 *
 * 每次运行都会“重新拼接”：以 docs/changelog 下的源文件为准重建整个版本列表，无需 --force。
 * 没有源目录的历史版本（如 v0.1.4 / v0.1.3 / v0.1.2）会保留目标文件中的原条目，避免丢失。
 *
 * 用法（推荐用 npm）:
 *   npm run changelog              # 扫描 docs/changelog 下所有版本并重新拼接（默认）
 *   npm run changelog -- --lang en # 只重新拼接英文
 *   npm run changelog -- --lang zh # 只重新拼接中文（zh/cn 均可）
 *
 * 等价于直接运行:
 *   node scripts/merge-changelog.mjs [--lang en|zh]
 *
 * 注意: 通过 npm 传参需用 `--` 分隔（如 `npm run changelog -- --lang zh`）；
 *   直接写 `npm run changelog --lang zh` 时，`--lang` 会被 npm 当作自身参数吞掉。
 *
 * 规则:
 *   - 源文件（docs/changelog/vX.Y.Z/*.md）中的一级标题 `# ...` 降级为二级标题 `## ...`
 *   - 按版本号“从新到旧”排列
 *   - 若源文件标题的版本号与目录名不一致（如 v0.1.9 目录里误放了 v0.1.5 的内容），
 *     则跳过该源文件并保留目标文件中的原条目
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CHANGELOG_SRC_DIR = join(ROOT, 'docs', 'changelog');
const TARGETS = {
  en: { src: ['en.md'], out: join(ROOT, 'CHANGELOG.EN.MD') },
  zh: { src: ['zh.md', 'cn.md'], out: join(ROOT, 'CHANGELOG.MD') },
};

/* ---------- 工具 ---------- */

function parseVersion(v) {
  const m = String(v).match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? m.slice(1).map(Number) : null;
}

function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * 源文件内容 -> 可合并的条目文本。
 * 规则: 一级标题（`# x`）降级为二级标题（`## x`），其余层级保持不变。
 */
export function toEntry(content) {
  const text = content.replace(/\r\n/g, '\n').trim();
  return text.replace(/^#(?!#)\s+/gm, '## ') + '\n';
}

const VERSION_HEADING_RE = /^#{1,6}\s+(?:\[)?(v?)(\d+\.\d+\.\d+)(?:\][^\]]*)?\s*$/;

/** 找出文件中所有版本标题行 */
function findVersionHeadings(lines) {
  const headings = [];
  lines.forEach((line, i) => {
    const m = line.match(VERSION_HEADING_RE);
    if (m) headings.push({ index: i, version: m[2] });
  });
  return headings;
}

/* ---------- 主流程 ---------- */

/**
 * 重新拼接单个目标文件:
 *  - 保留头部（第一个版本标题之前的内容）
 *  - 版本条目以 docs/changelog 下的源文件为准重新生成
 *  - 没有源目录的历史版本（如 v0.1.4 / v0.1.3 / v0.1.2）保留目标文件中的原条目，避免丢失
 *  - 按版本号“从新到旧”排列
 */
function rebuildTarget(cfg, srcVersions, lang) {
  const outPath = cfg.out;
  const lines = readFileSync(outPath, 'utf-8').replace(/\r\n/g, '\n').split('\n');
  const headings = findVersionHeadings(lines);

  // 提取头部与已有条目
  let header = '';
  const existing = new Map(); // version -> 条目文本
  if (headings.length === 0) {
    header = lines.join('\n').replace(/\s+$/, '');
  } else {
    header = lines.slice(0, headings[0].index).join('\n').replace(/\s+$/, '');
    for (let i = 0; i < headings.length; i++) {
      const start = headings[i].index;
      const end = i + 1 < headings.length ? headings[i + 1].index : lines.length;
      const block = lines.slice(start, end).join('\n').replace(/\s+$/, '');
      existing.set(headings[i].version, block);
    }
  }

  // 从源文件重新生成条目
  const entries = new Map(); // version -> 条目文本
  for (const version of srcVersions) {
    const key = version.replace(/^v/, '');
    const srcPath = cfg.src.map(f => join(CHANGELOG_SRC_DIR, version, f)).find(p => existsSync(p));
    if (!srcPath) {
      console.warn(`[跳过] 未找到 ${version} 的 ${lang} 源文件`);
      continue;
    }
    const content = readFileSync(srcPath, 'utf-8');
    if (!content.trim()) {
      console.warn(`[跳过] ${version} 的 ${lang} 源文件为空: ${srcPath}`);
      continue;
    }
    const entry = toEntry(content).replace(/\n+$/, '');
    // 校验源文件标题的版本号与目录名一致，防止错放文件（如 v0.1.9 目录里误放 v0.1.5 内容）
    const m = entry.split('\n')[0].match(VERSION_HEADING_RE);
    if (!m || m[2] !== key) {
      console.warn(`[跳过] ${version} 的 ${lang} 源文件标题版本(${m ? m[2] : '?'})与目录名不一致，保留已有条目`);
      continue;
    }
    entries.set(key, entry);
  }

  // 保留没有源目录的历史版本条目
  for (const [version, text] of existing) {
    if (!entries.has(version)) entries.set(version, text);
  }

  // 按版本从新到旧排列
  const body = [...entries.entries()]
    .sort((a, b) => compareVersions(parseVersion(b[0]), parseVersion(a[0])))
    .map(([, text]) => text)
    .join('\n\n');

  const out = (header ? `${header}\n\n` : '') + body + '\n';
  writeFileSync(outPath, out, 'utf-8');
  console.log(`[完成] 重新拼接 -> ${outPath}（共 ${entries.size} 个版本）`);
}

export function main() {
  const args = process.argv.slice(2);
  const langRaw = (args.find(a => a.startsWith('--lang')) ?? '').split('=')[1];
  const langArg = (langRaw || 'all').toLowerCase().replace('cn', 'zh');
  const langs = langArg === 'all' ? ['en', 'zh'] : [langArg];

  // 扫描 docs/changelog 下所有版本目录（从新到旧）
  const srcVersions = readdirSync(CHANGELOG_SRC_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^v?\d+\.\d+\.\d+$/.test(d.name))
    .map(d => (d.name.startsWith('v') ? d.name : `v${d.name}`))
    .sort((a, b) => compareVersions(parseVersion(b), parseVersion(a)));
  if (srcVersions.length === 0) {
    console.error(`[错误] ${CHANGELOG_SRC_DIR} 下没有找到任何版本目录`);
    process.exit(1);
  }
  console.log(`[信息] 扫描到 ${srcVersions.length} 个版本目录，开始重新拼接...`);

  for (const lang of langs) {
    const cfg = TARGETS[lang];
    if (!cfg) {
      console.error(`未知语言: ${lang}（仅支持 en / zh / all）`);
      process.exit(1);
    }
    rebuildTarget(cfg, srcVersions, lang);
  }
}

// 直接运行时才执行主流程（便于被测试脚本导入）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
