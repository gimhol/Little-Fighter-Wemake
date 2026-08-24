import fs from "fs/promises";
import { readFileSync, statSync } from "fs";

const sig = [
  [`/*** AUTO EXPORT START ***/`, `/*** AUTO EXPORT END ***/`],
  [`/************ [START] auto-exports ************/`, `/************ [END] auto-exports ************/`],
].filter(Boolean)

/**
 * 拓扑排序：根据 extends 关系确保基类在子类之前导出
 */
function topological_sort(files, dir) {
  const name_to_file = new Map();
  const deps = new Map(); // file → Set of files it depends on

  for (const file of files) {
    name_to_file.set(file.replace(/\.ts$/, ''), file);
    deps.set(file, new Set());
  }

  // 读取每个文件，查找 extends 关系
  for (const file of files) {
    const content = readFileSync(`${dir}/${file}`, 'utf-8');
    // 匹配: class Foo extends Bar 或 class Foo<T> extends Bar 或 class Foo<T extends X> extends Bar
    const extendsMatch = content.match(/(?:export\s+)?(?:abstract\s+)?class\s+\w+(?:\s*<[^>]*>)?\s+extends\s+(\w+)/);
    if (extendsMatch) {
      const baseName = extendsMatch[1];
      const baseFile = name_to_file.get(baseName);
      if (baseFile && baseFile !== file) {
        deps.get(file).add(baseFile);
      }
    }
  }

  // Kahn 拓扑排序
  const in_degree = new Map();
  const edges = new Map(); // reversed: base → dependents
  for (const file of files) {
    in_degree.set(file, 0);
    edges.set(file, []);
  }
  for (const [file, fileDeps] of deps) {
    in_degree.set(file, fileDeps.size);
    for (const dep of fileDeps) {
      edges.get(dep).push(file);
    }
  }

  const queue = files.filter(f => in_degree.get(f) === 0);
  const result = [];
  while (queue.length) {
    const node = queue.shift();
    result.push(node);
    for (const dep of edges.get(node)) {
      const d = in_degree.get(dep) - 1;
      in_degree.set(dep, d);
      if (d === 0) queue.push(dep);
    }
  }

  // 剩余无法拓扑排序的按字母序排在最后
  const remaining = files.filter(f => !result.includes(f));
  remaining.sort();
  result.push(...remaining);
  return result;
}

export async function auto_exports(dir) {
  const files = await fs.readdir(dir);
  files.forEach((v, i, a) => a[i] = v.replace(/\\/g, '/'))
  files.sort();
  const ts_files = [];
  for (const file of files) {
    if (file === `index.ts`) continue;
    if (file === `_.ts`) continue;
    if (file.endsWith(`.test.ts`)) continue;
    if (file.endsWith(`.d.ts`)) continue; // 跳过类型声明文件（如 globals.d.ts）
    const sub = `${dir}/${file}`
    const s = await fs.stat(sub)
    if (s.isFile() && file.endsWith('.ts')) {
      ts_files.push(file);
    } else if (s.isDirectory() && await auto_exports(sub) > 0) {
      ts_files.push(file);
    }
  }

  // 拓扑排序：基类在子类之前（仅 .ts 文件）
  const ts_only = ts_files.filter(f => f.endsWith('.ts'));
  const dirs_only = ts_files.filter(f => !f.endsWith('.ts')).sort();
  const sorted = [...topological_sort(ts_only, dir), ...dirs_only];

  const lines = [];
  for (const file of sorted) {
    if (file.endsWith('.ts')) {
      lines.push(`export * from "./${file.replace(/.ts$/, '')}";`)
    } else {
      lines.push(`export * from "./${file}";`)
    }
  }
  if (lines.length) {
    lines.unshift(sig[0][0])
    lines.push(sig[0][1])
    const s = await fs.stat(`${dir}/index.ts`).catch(() => null)
    if (!s) {
      await fs.writeFile(`${dir}/index.ts`, lines.join('\n'))
    } else if (s.isFile()) {
      const buf = await fs.readFile(`${dir}/index.ts`);
      const str = buf.toString().trim()
      if (sig.some(([a, b]) => str.startsWith(a) && str.endsWith(b))) {
        await fs.writeFile(`${dir}/index.ts`, lines.join('\n'))
      } else if (!str) {
        await fs.writeFile(`${dir}/index.ts`, lines.join('\n'))
      } else {
        throw `${dir}/index.ts is not empty`;
      }
    } else {
      throw `${dir}/index.ts is not file`;
    }
  } else {
    // 无导出内容时，清理纯 auto-export 的空 index.ts
    const s = await fs.stat(`${dir}/index.ts`).catch(() => null)
    if (s?.isFile()) {
      const buf = await fs.readFile(`${dir}/index.ts`);
      const str = buf.toString().trim()
      if (sig.some(([a, b]) => str.startsWith(a) && str.endsWith(b))) {
        await fs.rm(`${dir}/index.ts`)
      }
    }
  }
  return lines.length;
}
if (process.argv[2])
  auto_exports(process.argv[2])