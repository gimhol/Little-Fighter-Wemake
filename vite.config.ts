import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { defineConfig, type Plugin } from 'vite';
import checker from 'vite-plugin-checker';
import glsl from 'vite-plugin-glsl';
import { createHtmlPlugin } from 'vite-plugin-html';
import json from "./package.json";
import dayjs from "dayjs"

function getGitCommitId(): string {
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch {
    return "";
  }
}

function isGitDirty(): boolean {
  try {
    return execSync('git status --porcelain').toString().trim().length > 0;
  } catch {
    return false;
  }
}

const GIT_COMMIT_ID = getGitCommitId();
const GIT_COMMIT_DIRTY = isGitDirty();
const BUILD_STAMP = Date.now();

function version_file_plugin(): Plugin {
  return {
    name: 'lfj-version-file',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          version: json.version,
          tag: process.env.BUILD_TAG ?? '',
          commit: GIT_COMMIT_ID,
          dirty: GIT_COMMIT_DIRTY,
          stamp: BUILD_STAMP,
          time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        }, null, 2),
      });
    },
  };
}
// 开发期：把无头 UI 测试（?headless_ui=1 + window.ui_test_run()）的结果落盘，
// 复现：npm run dev → 打开页面 → await ui_test_run() → node scripts/ui-snapshot-diff.mjs temp/ui-run.json
function ui_snapshot_sink_plugin(): Plugin {
  return {
    name: 'lfj-ui-snapshot-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__ui-snapshot', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        const scenario = (new URL(req.url ?? '/', 'http://localhost').searchParams.get('scenario') ?? 'default')
          .replace(/[^\w.-]/g, '_');
        const file = `temp/ui-run.${scenario}.json`;
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          try {
            mkdirSync('temp', { recursive: true });
            writeFileSync(file, Buffer.concat(chunks));
            server.config.logger.info(`[ui-snapshot] 已写入 ${file}`);
            res.end('ok');
          } catch (e) {
            res.statusCode = 500;
            res.end(String(e));
          }
        });
      });
    },
  };
}

// bilibili-toy 构建：`vite build --mode bili-toy` → 产物输出到 dist-toy（不覆盖 web 的 dist），
// 并把默认数据包指向 https://lf.gim.ink/<version>/（版本号取构建时 package.json 的 version，非固定）
export default defineConfig(({ command, mode }) => {
  const is_toy_build = mode === 'bili-toy';
  // 开发服务器（vite dev / vite --mode bili-toy）始终走本地数据包，不注入远端 URL
  const is_dev_server = command === 'serve';
  return {
    base: './',
  plugins: [
    react(),
    checker({ typescript: true }),
    createHtmlPlugin({
      inject: {
        data: {
          title: `Legacy Flame War v${json.version}`,
          // 仅 bilibili-toy 构建注入 B站 Toy JS SDK script 标签（见 index.html）；
          // 其它环境（普通 web 构建/开发）不加载
          toySdk: is_toy_build
            ? '<script src="//s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js"></script>'
            : '',
        }
      }
    }),
    glsl(),
    version_file_plugin(),
    ui_snapshot_sink_plugin()
  ],
  define: {
    VERSION_NAME: JSON.stringify(json.version),
    GIT_COMMIT_ID: JSON.stringify(GIT_COMMIT_ID),
    GIT_COMMIT_DIRTY: JSON.stringify(GIT_COMMIT_DIRTY ? "dirty" : ""),
    BUILD_TIME: JSON.stringify(dayjs().format(`YYYY-MM-DD HH:mm:ss`)),
    BUILD_STAMP: JSON.stringify(BUILD_STAMP),
    VERSION_CHECK: is_dev_server || is_toy_build ? 'false' : 'true',
    RANK_API_URL: JSON.stringify(process.env.RANK_API_URL ?? 'https://lfj.gim.ink'),
    // 构建期注入的默认数据包地址：仅 bilibili-toy 的正式构建（vite build --mode bili-toy）注入远端 URL；
    // 其它构建及 dev 服务器为 undefined，init.ts 回退到同源相对路径（本地 zip）
    DATA_ZIP_URLS: is_toy_build && !is_dev_server
      ? JSON.stringify([
        `https://lf.gim.ink/${json.version}/prel.zip.json`,
        `https://lf.gim.ink/${json.version}/data.zip.json`,
      ])
      : 'undefined',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    watch: {
      ignored: [
        './.vscode/**', './temp/**', './art/**', './docs/**', './lf2s/**',
        './server/**', './scripts/**', './release/**'
      ]
    }
  },

  build: {
    outDir: is_toy_build ? 'dist-toy' : 'dist',
    cssCodeSplit: false,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          if (id.includes('/src/Component/') || id.includes('/src/Utils/') || id.includes('/src/Utils/hooks')) {
            return 'common';
          }
          if (id.includes('/src/Editor/') || id.includes('/src/EditorView/')) {
            return 'editor';
          }
          if (id.includes('/src/LFW/') || id.includes('/src/DittoImpl/') || id.includes('/src/Net/')) {
            return 'lfw-dom'
          }
          if (id.match('/src/pages/')) {
            return 'other-pages'
          }
        },
        chunkFileNames: 'assets/js/[name].[hash].js',
        entryFileNames: 'assets/js/[name].[hash].js',
        assetFileNames: 'assets/[ext]/[name].[hash].[ext]'
      }
    },
    assetsInlineLimit: 16384
  }
  };
});