#!/usr/bin/env node
// 把 `dist/`（Web 版构建产物）当静态站点伺服 —— 给 `web_shots.mjs` 与人工浏览器比对用。
// 只用 node 内置模块（本仓库不允许为此引第三方服务器依赖）。
//
//   node native/tools/serve_dist.mjs [--port 5177] [--root dist]
//
// ⚠ 顺带做两件必要的事：
//   * `.zip` / `.wasm` 给对 MIME（`application/zip` 之类），否则浏览器侧 fetch/解包会挑食；
//   * `Range` 不实现（这些包都是整包拿的），但要**流式**发（33 MB 的 `data.zip` 一次性读进内存没必要）。
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const argv = process.argv.slice(2);
let port = 5177;
let root = "dist";
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--port") port = Number(argv[++i]);
  else if (argv[i] === "--root") root = argv[++i];
}
const ROOT = resolve(root);
if (!existsSync(ROOT)) {
  console.error(`serve_dist: root not found: ${ROOT}`);
  process.exit(2);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".zip": "application/zip",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0].split("#")[0]);
  let file = normalize(join(ROOT, url));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  // ⚠ 缺文件时**只能**对「无扩展名的路径」回退到 index.html（SPA 路由）。
  // 静态资源必须 404：TS 侧 `Importer.import_as` 是「并发试多个候选 URL，取第一个成功的」，
  // 若把 `./launch/bg.png` 之类错当路由返回 200 + text/html，它会被当成"命中" ⇒
  // `createImageBitmap(html)` 失败后回退到 `new Image()` + blob URL ⇒ 图片永远不 load ⇒ 装载页卡死。
  if (!existsSync(file) || statSync(file).isDirectory()) {
    if (extname(url) !== "") {
      res.writeHead(404).end("not found");
      return;
    }
    file = join(ROOT, "index.html");
  }
  if (!existsSync(file)) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, {
    "content-type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
    "content-length": String(statSync(file).size),
    "cache-control": "no-store",
  });
  createReadStream(file).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`serve_dist: http://127.0.0.1:${port}/  (root=${ROOT})`);
});
