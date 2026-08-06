#!/usr/bin/env node
/**
 * analyze.mjs — LFW TS → C++ 移植难度分析脚本
 *
 * 扫描 src/LFW 下所有 .ts 文件，计算影响 C++ 移植难度的关键特征指标，
 * 输出:
 *   - nativify/data/metrics.json          每文件指标数据
 *   - nativify/reports/<相对路径>.md       每文件详细报告
 *   - nativify/INDEX.md                    全部文件难度索引表
 *   - nativify/SUMMARY.md                  难度分布统计与建议
 *
 * 仅依赖 Node 内置模块。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src', 'LFW');
const OUT = path.join(ROOT, 'nativify');
const REPORTS = path.join(OUT, 'reports');
const DATA = path.join(OUT, 'data');

// ---------------------------------------------------------------------------
// 遍历文件
// ---------------------------------------------------------------------------
function walk(dir, base = SRC, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, acc);
    else if (entry.name.endsWith('.ts')) acc.push(full);
  }
  return acc;
}

// ---------------------------------------------------------------------------
// 去注释（保留字符串与正则字面量）
// ---------------------------------------------------------------------------
function stripCommentsFull(code) {
  let out = '';
  let i = 0;
  const n = code.length;
  let inStr = null; // null | "'" | '"' | '`'
  while (i < n) {
    const ch = code[i];
    const next = code[i + 1];
    if (inStr) {
      out += ch;
      if (ch === '\\') { out += code[i + 1] ?? ''; i += 2; continue; }
      if (ch === inStr) inStr = null;
      i++;
      continue;
    }
    if (ch === '/' && next === '/') { while (i < n && code[i] !== '\n') i++; continue; }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; out += ch; i++; continue; }
    out += ch;
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 特征检测（基于去注释后的代码）
// ---------------------------------------------------------------------------
function detect(code) {
  const c = stripCommentsFull(code);
  const f = { any: 0, unknown: 0 };
  f.any = (c.match(/\bany\b/g) || []).length;
  f.unknown = (c.match(/\bunknown\b/g) || []).length;
  return {
    any: f.any,
    unknown: f.unknown,
    class: /\bclass\s+[A-Za-z_$]/.test(c),
    enum: /\benum\s+[A-Za-z_$]/.test(c),
    interface: /\binterface\s+[A-Za-z_$]/.test(c),
    type_alias: /\btype\s+[A-Za-z_$]/.test(c),
    function: /\bfunction\b/.test(c),
    arrow: /=>/.test(c),
    const_decl: /\bconst\b/.test(c),
    getters_setters: /\b(get|set)\s+[A-Za-z_$][\w$]*\s*[({]/.test(c),
    static_member: /\bstatic\b/.test(c),
    map_set: /\bnew\s+(Map|Set|WeakMap|WeakSet)\b/.test(c),
    string_map: /(Map|Set)\s*<[^>]*string/.test(c),
    json: /JSON\./.test(c),
    // 正则：new RegExp / .match(/ 等调用，或含元字符的正则字面量（避免误判除法）
    regex: /new\s+RegExp|\.(match|replace|search|split|exec)\s*\(/.test(c) ||
      /\/[^/\\\n]*[\\[\]()|*+?$^{}][^/\\\n]*\/[gimsuy]*/.test(c) ||
      /\/[^/\\\n]+\/[gimsuy]+/.test(c),
    date: /\bDate\b/.test(c),
    math: /Math\./.test(c),
    object_methods: /Object\.(keys|values|entries|assign|create|defineProperty|getOwnProperty|fromEntries|hasOwn)\b/.test(c),
    array_methods: /\.(forEach|map|filter|reduce|find|some|every|sort|splice|slice|push|pop|shift|unshift|flat|includes|indexOf)\s*\(/.test(c),
    callbacks: /\.(forEach|map|filter|reduce|find|some|every)\s*\([^)]*=>/.test(c) ||
      /\.(on|addEventListener|subscribe)\s*\(/.test(c) ||
      /\bnew\s+Callbacks\b/.test(c),
    optional_chaining: /\?\./.test(c),
    nullish: /\?\?/.test(c),
    instanceof: /\binstanceof\b/.test(c),
    dynamic_index: /\[[A-Za-z_$][\w$]*\]/.test(c),
    async: /\b(async|await|Promise)\b/.test(c),
    timers: /\b(setTimeout|setInterval|requestAnimationFrame|requestIdleCallback)\b/.test(c),
    dom: /\b(document|window|navigator|HTMLElement|CanvasRenderingContext2D|Image\b|addEventListener)\b/.test(c),
    fetch: /\b(fetch|XMLHttpRequest|WebSocket)\b/.test(c),
    binary: /\b(ArrayBuffer|Uint8Array|Uint16Array|Int8Array|Uint32Array|Int16Array|DataView|String\.fromCharCode|charCodeAt)\b/.test(c),
    template: /`/.test(c),
    spread: /\.\.\./.test(c),
    generic_any: /<[^>]*=\s*any>/.test(c),
    reflect_proxy: /\b(Reflect|Proxy|Symbol)\b/.test(c),
    try_catch: /\b(try|throw|catch)\b/.test(c),
    switch_stmt: /\bswitch\s*\(/.test(c),
    union_null: /\|\s*(null|undefined)/.test(c),
    nonnull: /!\s*[.;,)\]]/.test(c),
    number_parse: /\b(parseInt|parseFloat|Number\(|String\()/.test(c),
    random: /Math\.random/.test(c),
    now: /Date\.now/.test(c),
  };
}

// ---------------------------------------------------------------------------
// 分类
// ---------------------------------------------------------------------------
function classify(feat) {
  const runtimeCode =
    feat.class || feat.function || feat.arrow || feat.enum || feat.const_decl;
  if (!runtimeCode && (feat.interface || feat.type_alias)) return 'types';
  if (feat.class) {
    if (feat.function || feat.arrow || feat.const_decl) return 'mixed';
    return 'class';
  }
  if (feat.function || feat.arrow) return 'util';
  if (feat.const_decl) return 'const_data';
  if (feat.enum) return 'enum';
  return 'types';
}

// ---------------------------------------------------------------------------
// 难度评分 (1~5, 半步进)
// ---------------------------------------------------------------------------
function score(feat, lines, kind) {
  let s = 1;
  // 规模（有界，最大 +2.5）
  if (lines > 50) s += 0.5;
  if (lines > 150) s += 0.5;
  if (lines > 400) s += 0.5;
  if (lines > 800) s += 0.5;
  if (lines > 1500) s += 0.5;
  // 类型
  if (kind === 'class' || kind === 'mixed') s += 0.5;
  if (kind === 'types' || kind === 'enum' || kind === 'const_data') s -= 0.5;
  // 结构复杂度（类、状态、容器、回调）
  if (feat.getters_setters) s += 0.1;
  if (feat.static_member) s += 0.1;
  if (feat.map_set) s += 0.3;
  if (feat.string_map) s += 0.2;
  if (feat.callbacks) s += 0.3;
  if (feat.async) s += 0.3;
  if (feat.dynamic_index) s += 0.2;
  if (feat.instanceof) s += 0.2;
  // 运行时/宿主依赖
  if (feat.dom) s += 0.5;
  if (feat.fetch) s += 0.3;
  if (feat.json) s += 0.3;
  if (feat.regex) s += 0.2;
  if (feat.binary) s += 0.2;
  if (feat.object_methods) s += 0.2;
  if (feat.reflect_proxy) s += 0.5;
  if (feat.timers) s += 0.2;
  // 类型摩擦
  if (feat.any > 0) s += 0.2;
  if (feat.unknown > 0) s += 0.1;
  if (feat.generic_any) s += 0.2;
  if (feat.union_null) s += 0.1;
  if (feat.nonnull) s += 0.1;
  if (feat.spread) s += 0.1;
  s = Math.max(1, Math.min(5, s));
  return Math.round(s * 2) / 2;
}

// ---------------------------------------------------------------------------
// 标签
// ---------------------------------------------------------------------------
function label(s) {
  if (s <= 1) return '微不足道';
  if (s <= 1.5) return '极易';
  if (s <= 2) return '容易';
  if (s <= 2.5) return '较易';
  if (s <= 3) return '中等';
  if (s <= 3.5) return '中等偏难';
  if (s <= 4) return '困难';
  if (s <= 4.5) return '很困难';
  return '极难';
}

function stars(s) {
  const full = Math.floor(s);
  const half = s - full >= 0.5;
  return '★'.repeat(full) + (half ? '☆' : '') + '☆'.repeat(5 - full - (half ? 1 : 0));
}

const KIND_LABEL = {
  types: '纯类型声明 (interface/type)',
  enum: '枚举定义',
  const_data: '常量/静态数据',
  util: '纯函数工具',
  class: '类实现',
  mixed: '类+函数+数据混合',
};

// ---------------------------------------------------------------------------
// 特征列表（用于报告）
// ---------------------------------------------------------------------------
function featureList(feat) {
  const items = [];
  if (feat.any > 0) items.push(`\`any\` 类型使用 ${feat.any} 处`);
  if (feat.unknown > 0) items.push(`\`unknown\` 使用 ${feat.unknown} 处`);
  if (feat.class) items.push('class 定义');
  if (feat.enum) items.push('enum 定义');
  if (feat.interface) items.push('interface 定义');
  if (feat.type_alias) items.push('type 别名');
  if (feat.function) items.push('function 声明');
  if (feat.arrow) items.push('箭头函数/回调');
  if (feat.getters_setters) items.push('getter/setter');
  if (feat.static_member) items.push('static 成员');
  if (feat.map_set) items.push('Map/Set 容器');
  if (feat.string_map) items.push('string 键 Map');
  if (feat.json) items.push('JSON 序列化');
  if (feat.regex) items.push('正则/字符串匹配');
  if (feat.date) items.push('Date 时间');
  if (feat.math) items.push('Math 数学函数');
  if (feat.object_methods) items.push('Object.* 反射方法');
  if (feat.array_methods) items.push('数组高阶方法');
  if (feat.callbacks) items.push('回调注册/事件');
  if (feat.optional_chaining) items.push('可选链 ?.');
  if (feat.nullish) items.push('空值合并 ??');
  if (feat.instanceof) items.push('instanceof 类型判断');
  if (feat.dynamic_index) items.push('动态属性访问 obj[key]');
  if (feat.async) items.push('async/await/Promise');
  if (feat.timers) items.push('定时器');
  if (feat.dom) items.push('DOM/浏览器 API');
  if (feat.fetch) items.push('网络请求');
  if (feat.binary) items.push('二进制/字节数组');
  if (feat.template) items.push('模板字符串');
  if (feat.spread) items.push('展开运算符 ...');
  if (feat.generic_any) items.push('泛型默认 any');
  if (feat.reflect_proxy) items.push('Reflect/Proxy/Symbol');
  if (feat.try_catch) items.push('异常处理');
  if (feat.switch_stmt) items.push('switch 分支');
  if (feat.union_null) items.push('可空联合类型');
  if (feat.nonnull) items.push('非空断言 !');
  if (feat.number_parse) items.push('数字/字符串转换');
  if (feat.random) items.push('随机数');
  if (feat.now) items.push('时间戳');
  return items;
}

// ---------------------------------------------------------------------------
// 每文件 C++ 移植要点（按分类+特征生成）
// ---------------------------------------------------------------------------
function portNotes(kind, feat, rel, lines) {
  const notes = [];
  const src = '`src/LFW/' + rel + '`';
  switch (kind) {
    case 'types':
      notes.push(`${src} 仅包含 interface/type 声明，编译期即被擦除，无运行时开销。`);
      notes.push('C++ 侧可机械映射为 struct / class 定义，字段名与类型一一对应。');
      break;
    case 'enum':
      notes.push(`${src} 为 TS enum，运行时生成双向映射对象（在 C++ 中无此概念）。`);
      notes.push('C++ 侧建议用 `enum class` + 显式整型值，若需 name↔value 映射则额外提供查找表。');
      break;
    case 'const_data':
      notes.push(`${src} 主要是静态常量/数据表，移植为 constexpr / 静态数组即可。`);
      notes.push('注意检查是否含对象字面量嵌套与联合类型字段，需要对应定义 POD struct。');
      break;
    case 'util':
      notes.push(`${src} 为纯函数工具模块，无类状态，是移植性价比最高的部分。`);
      notes.push('重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。');
      break;
    case 'class':
    case 'mixed':
      notes.push(`${src} 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。`);
      notes.push('重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。');
      break;
  }
  if (feat.any > 0) notes.push(`存在 ${feat.any} 处 \`any\`，需逐一推断真实类型或引入 variant/泛型。`);
  if (feat.map_set) notes.push('Map/Set 需替换为 `std::unordered_map` / `std::unordered_set`，注意字符串键的性能与哈希。');
  if (feat.string_map) notes.push('string 键容器频繁使用，C++ 侧建议用 `std::string_view`/`const char*` 键或对象池优化。');
  if (feat.callbacks) notes.push('回调/事件模式需要 C++ 事件机制（std::function、信号槽、观察者）。');
  if (feat.dynamic_index) notes.push('动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。');
  if (feat.json) notes.push('JSON 处理需引入第三方库（nlohmann/json 等）或自定义解析。');
  if (feat.regex) notes.push('正则/字符串解析需用 `std::regex` 或手写解析器（注意 std::regex 性能）。');
  if (feat.async) notes.push('async/await 异步逻辑需重构为回调、协程或状态机。');
  if (feat.dom) notes.push('涉及 DOM/浏览器 API，C++ 侧需要对应的渲染/事件抽象层（如通过 FFI 或平台层注入）。');
  if (feat.fetch) notes.push('网络请求需用平台网络库（libcurl/asio 等）替代 fetch/XHR。');
  if (feat.binary) notes.push('二进制/字节处理需映射到 `std::vector<uint8_t>` 等原生类型。');
  if (feat.timers) notes.push('定时器需映射到平台帧循环或定时器服务。');
  if (feat.getters_setters) notes.push('getter/setter 语义需在 C++ 中通过访问器方法保持。');
  if (feat.static_member) notes.push('static 可变状态在 C++ 中需注意初始化顺序与线程安全。');
  if (feat.instanceof) notes.push('instanceof 运行时类型判断需改用 typeid / 虚函数 / 判别联合。');
  if (feat.reflect_proxy) notes.push('反射/代理特性在 C++ 中没有直接对应物，需要重新设计。');
  if (feat.spread) notes.push('展开运算符需展开为循环或可变参数模板。');
  if (feat.union_null) notes.push('可空联合类型建议用 `std::optional` / 指针表达。');
  if (feat.object_methods) notes.push('Object.* 反射方法需替换为显式代码或序列化框架。');
  return notes;
}

// ---------------------------------------------------------------------------
// 人工深度分析映射（源文件路径 -> deep-dive 文件名）
// ---------------------------------------------------------------------------
const DEEP_DIVES = {
  'entity/Entity.ts': 'entity-Entity.md',
  'World.ts': 'World.md',
  'LFW.ts': 'LFW.md',
  'ditto/Instance.ts': 'ditto-Instance.md',
  'ui/UINode.ts': 'ui-UINode.md',
  'ui/component/UIComponent.ts': 'ui-component-UIComponent.md',
  'bot/BotController.ts': 'bot-BotController.md',
  'controller/BaseController.ts': 'controller-BaseController.md',
  'collision/CollisionKeeper.ts': 'collision-CollisionKeeper.md',
  'stage/Stage.ts': 'stage-Stage.md',
  'loader/DatMgr.ts': 'loader-DatMgr.md',
  'utils/schema/validate_schema.ts': 'utils-schema-validate_schema.md',
  'dat_translator/make_fighter_data.ts': 'dat_translator-make_fighter_data.md',
  'ui/component/DemoModeLogic.ts': 'ui-component-DemoModeLogic.md',
};

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
fs.mkdirSync(REPORTS, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });

const files = walk(SRC).sort();
const metrics = [];

for (const full of files) {
  const rel = path.relative(SRC, full).replace(/\\/g, '/');
  const code = fs.readFileSync(full, 'utf8');
  const lines = code.split('\n').length;
  const bytes = Buffer.byteLength(code, 'utf8');
  const feat = detect(code);
  const kind = classify(feat);
  const scoreVal = score(feat, lines, kind);
  const imports = (code.match(/^\s*import\b/gm) || []).length;
  const exportsCount = (code.match(/^\s*export\b/gm) || []).length;
  metrics.push({
    path: rel,
    lines,
    bytes,
    imports,
    exports: exportsCount,
    kind,
    score: scoreVal,
    label: label(scoreVal),
    features: feat,
  });
}

fs.writeFileSync(path.join(DATA, 'metrics.json'), JSON.stringify(metrics, null, 2));

// ---------------------------------------------------------------------------
// 生成每文件报告
// ---------------------------------------------------------------------------
for (const m of metrics) {
  const rel = m.path;
  const reportRel = rel.replace(/\.ts$/, '') + '.md';
  const outPath = path.join(REPORTS, reportRel);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const feat = m.features;
  const featItems = featureList(feat);
  const notes = portNotes(m.kind, feat, rel, m.lines);

  const md = [
    `# ${rel}`,
    ``,
    `> 源文件: \`src/LFW/${rel}\``,
    ``,
    `## 基本信息`,
    ``,
    `| 项目 | 值 |`,
    `| --- | --- |`,
    `| 行数 | ${m.lines} |`,
    `| 大小 | ${m.bytes} bytes |`,
    `| import 数 | ${m.imports} |`,
    `| export 数 | ${m.exports} |`,
    `| 分类 | ${KIND_LABEL[m.kind]} |`,
    `| **移植难度** | **${stars(m.score)} ${m.score} / 5 —— ${m.label}** |`,
    ``,
    `## 检测到的语言特征`,
    ``,
    featItems.length
      ? featItems.map(x => `- ${x}`).join('\n')
      : '- （无特殊动态特征）',
    ``,
    `## C++ 移植要点`,
    ``,
    notes.map(x => `- ${x}`).join('\n'),
    ``,
  ];
  if (DEEP_DIVES[rel]) {
    md.push(
      ``,
      `## 📌 人工深度分析`,
      ``,
      `本文件为核心文件，已人工复核。详见：[deep-dive/${DEEP_DIVES[rel]}](../deep-dive/${DEEP_DIVES[rel]})`,
      ``,
    );
  }
  fs.writeFileSync(outPath, md.join('\n'));
}

// ---------------------------------------------------------------------------
// 汇总统计
// ---------------------------------------------------------------------------
const byKind = {};
const byScore = {};
const byDir = {};
for (const m of metrics) {
  byKind[m.kind] = (byKind[m.kind] || 0) + 1;
  byScore[m.score] = (byScore[m.score] || 0) + 1;
  const dir = m.path.includes('/') ? m.path.split('/')[0] : '(根)';
  byDir[dir] = (byDir[dir] || 0) + 1;
}

const totalLines = metrics.reduce((a, m) => a + m.lines, 0);
const totalBytes = metrics.reduce((a, m) => a + m.bytes, 0);

const summary = [
  `# LFW TS → C++ 移植难度分析 — 汇总`,
  ``,
  `> 生成时间: ${new Date().toISOString()} · 由 \`nativify/analyze.mjs\` 生成`,
  ``,
  `## 总体统计`,
  ``,
  `| 指标 | 值 |`,
  `| --- | --- |`,
  `| 文件数 | ${metrics.length} |`,
  `| 总行数 | ${totalLines} |`,
  `| 总大小 | ${(totalBytes / 1024).toFixed(1)} KB |`,
  `| 平均行数 | ${(totalLines / metrics.length).toFixed(1)} |`,
  `| 平均难度 | ${(metrics.reduce((a, m) => a + m.score, 0) / metrics.length).toFixed(2)} / 5 |`,
  ``,
  `## 按分类分布`,
  ``,
  `| 分类 | 文件数 |`,
  `| --- | --- |`,
  ...Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, n]) => `| ${KIND_LABEL[k] || k} | ${n} |`),
  ``,
  `## 按难度分布`,
  ``,
  `| 难度 | 文件数 |`,
  `| --- | --- |`,
  ...Object.entries(byScore).sort((a, b) => b[0] - a[0]).map(([k, n]) => `| ${k} (${label(Number(k))}) | ${n} |`),
  ``,
  `## 按目录分布`,
  ``,
  `| 目录 | 文件数 |`,
  `| --- | --- |`,
  ...Object.entries(byDir).sort((a, b) => b[1] - a[1]).map(([k, n]) => `| ${k} | ${n} |`),
  ``,
  `## 最困难的文件 (难度 ≥ 4)`,
  ``,
  `| 难度 | 文件 | 行数 | 分类 |`,
  `| --- | --- | --- | --- |`,
  ...metrics.filter(m => m.score >= 4).sort((a, b) => b.score - a.score || b.lines - a.lines).map(m =>
    `| ${m.score} | \`${m.path}\` | ${m.lines} | ${KIND_LABEL[m.kind]} |`),
  ``,
  `## 深度分析文件（人工复核）`,
  ``,
  `| 源文件 | 深度分析 |`,
  `| --- | --- |`,
  ...Object.entries(DEEP_DIVES).map(([src, dd]) => `| \`${src}\` | [${dd}](./deep-dive/${dd}) |`),
  ``,
  `## 总体建议`,
  ``,
  `1. **优先移植纯逻辑层**（\`utils\`、\`defines\`、\`math\`、\`string_parser\`），它们多为纯函数与类型声明，难度低、收益高。`,
  '2. **核心模拟层**（`entity`、`world`、`collision`、`state`）是移植主战场，需先设计数据模型与对象生命周期，建议先做 `defines` 数据结构的 C++ 化，再移植 `Entity` / `World`。',
  `3. **Ditto 接口层**是 JS 宿主（渲染、音频、输入、网络）与逻辑层的桥，C++ 侧需要定义抽象接口并让平台实现，先定接口再实现。`,
  `4. **UI 层**（\`ui\`）依赖大量 DOM/浏览器能力与回调式组件树，C++ 移植成本最高，建议优先考虑保留 JS 或做 FFI 桥接，而非整体重写。`,
  `5. **dat_translator** 是离线构建工具链（LF2 数据 → JSON），可在 C++ 侧复用同一套解析逻辑，但优先级低于运行时逻辑。`,
  ``,
].join('\n');
fs.writeFileSync(path.join(OUT, 'SUMMARY.md'), summary);

// ---------------------------------------------------------------------------
// 索引表
// ---------------------------------------------------------------------------
const index = [
  `# LFW TS → C++ 移植难度索引`,
  ``,
  `> 共 ${metrics.length} 个文件。难度 1=微不足道 … 5=极难。`,
  `> 📌 = 有深度分析（见 [deep-dive/](./deep-dive/)）`,
  ``,
  `| 难度 | 文件 | 行数 | 分类 | 深度分析 |`,
  `| --- | --- | --- | --- | --- |`,
  ...metrics
    .slice()
    .sort((a, b) => b.score - a.score || b.lines - a.lines)
    .map(m =>
      `| ${m.score} | [\`${m.path}\`](./reports/${m.path.replace(/\.ts$/, '')}.md) | ${m.lines} | ${KIND_LABEL[m.kind]} | ${DEEP_DIVES[m.path] ? `[📌](./deep-dive/${DEEP_DIVES[m.path]})` : ''} |`),
  ``,
].join('\n');
fs.writeFileSync(path.join(OUT, 'INDEX.md'), index);

console.log(`分析完成: ${metrics.length} 个文件`);
console.log(`总行数: ${totalLines}, 总大小: ${(totalBytes / 1024).toFixed(1)} KB`);
console.log(`报告目录: ${REPORTS}`);
