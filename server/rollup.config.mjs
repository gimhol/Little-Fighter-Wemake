import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { execSync } from 'node:child_process';
import { rmSync } from 'fs';
import typescript from 'rollup-plugin-typescript2';

function git_commit() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function git_dirty() {
  try {
    return execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0
  } catch {
    return false
  }
}

const DEFINES = {
  __GIT_COMMIT__: JSON.stringify(git_commit()),
  __GIT_DIRTY__: JSON.stringify(git_dirty()),
  __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
}

/** 把 __GIT_COMMIT__ 这类构建期常量换成字面量（声明见 src/globals.d.ts） */
function define_plugin(values) {
  const pattern = new RegExp(`\\b(?:${Object.keys(values).join('|')})\\b`, 'g')
  return {
    name: 'lfj-define',
    transform(code) {
      if (!code.includes('__')) return null
      return { code: code.replace(pattern, (name) => values[name]), map: null }
    },
  }
}

let targets = [
  { dir: './dist', tsconfig: "./tsconfig.json" },
]
const whats = [{
  format: 'cjs',
  suffix: 'cjs'
}]
const configs = [];

// "amd", "cjs", "system", "es", "iife" or "umd"

for (const { format, suffix = 'js' } of whats) {
  for (const { dir, tsconfig } of targets) {
    const dist_dir = `${dir}/${format}`
    try {
      rmSync(dist_dir, { recursive: true, focus: true })
    } catch (error) {
      //
    }
    const bundle_js_config = {
      input: 'src/index.ts',
      output: {
        file: `${dist_dir}/server.${suffix}`,
        format,
        sourcemap: true,
        name: "lfj-node-server"
      },
      plugins: [
        json(),
        typescript({ tsconfig }),
        define_plugin(DEFINES),
        commonjs(),
        nodeResolve({ preferBuiltins: true }),
        terser({
          compress: true,
          output: {
            indent_level: 0,
            comments: false
          }
        })
      ]
    }
    configs.push(bundle_js_config)
  }
}

export default configs