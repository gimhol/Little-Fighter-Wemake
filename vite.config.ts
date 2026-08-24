import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { defineConfig } from 'vite';
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
export default defineConfig({
  base: './',
  plugins: [
    react(),
    checker({ typescript: true }),
    createHtmlPlugin({
      inject: {
        data: {
          title: `Little Fighter Wemake v${json.version}`
        }
      }
    }),
    glsl()
  ],
  define: {
    VERSION_NAME: JSON.stringify(json.version),
    GIT_COMMIT_ID: JSON.stringify(GIT_COMMIT_ID),
    GIT_COMMIT_DIRTY: JSON.stringify(GIT_COMMIT_DIRTY ? "dirty" : ""),
    BUILD_TIME: JSON.stringify(dayjs().format(`YYYY-MM-DD HH:mm:ss`)),
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
    cssCodeSplit: false,
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
            return 'lf2-dom'
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
})