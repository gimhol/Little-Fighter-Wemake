// 把两份（或更多）**整窗截图**归一到同一张「逻辑屏幕」网格上比较 —— 窗口/顶栏那一套改动的
// 机械证据（`native/README.md`「窗口外观」用的就是这一条）。
//
// 为什么需要它：`--screenshot` 抓的是**视口 = 整个窗口**（`stretch/mode=disabled` ⇒ 视口 = 窗口
// 像素，黑边也在图里），而宿主把逻辑 794×450 按 contain（等比缩放 + 居中）摆进窗口。所以两张不同
// 尺寸的截图**不能直接相减**：要各自裁到内容矩形（`window:` 那行的 `content=宽x高+左+上`）、再按
// 自己的 `scale=` 缩回 794×450，才能比较「同一帧在两种窗口尺寸下是不是同一张画」。
//
// 判据：游戏那一层 = 逻辑帧的**精确**等比缩放 + 居中 ⇒ 归一之后同一帧的差异只剩
// ①文字/纹理在不同过采样下的光栅化边缘（`--blur` 一糊就掉）、②顶栏那一层（它在**窗口像素**里，
// 归一到逻辑网格后两张图里必然不重合 —— 用 `--skip-top` 把它排除）。**整体位移/大小不一致**
// （曾经那个"镜像项把 contain 变换冲掉"的 bug）会整块留在图上、糊不掉。
//
// 用法（spec = `file.png` 或 `file.png:x,y,w,h` 内容矩形；`--scale N` = 归一到的倍数）：
//   node native/tools/shots_compare.mjs --scale 1 --blur 1 --skip-top 25 \
//        --out shots/window-norm-1191x675-vs-1920x1030.png --diff shots/window-norm-diff.png \
//        shots/window-1191x675.png shots/window-1920x1030.png:52,0,1817,1030
//
// 依赖只有 Node 自带的 zlib（PNG 自己解、自己写 —— 与仓库里"自带 inflate"那条口径一致）。

import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

const LOGICAL_W = 794;
const LOGICAL_H = 450;

// ---- PNG 读 ----
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePng(buf, name) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${name}: not a PNG`);
  let off = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = -1;
  let interlace = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
    off += 12 + len;
  }
  if (depth !== 8) throw new Error(`${name}: only 8-bit PNGs (got ${depth})`);
  if (interlace !== 0) throw new Error(`${name}: interlaced PNG unsupported`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`${name}: unsupported colour type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(stride * height);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const row = out.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? row[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      const x = src[i];
      if (filter === 0) row[i] = x;
      else if (filter === 1) row[i] = (x + a) & 0xff;
      else if (filter === 2) row[i] = (x + b) & 0xff;
      else if (filter === 3) row[i] = (x + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) row[i] = (x + paeth(a, b, c)) & 0xff;
      else throw new Error(`${name}: bad filter ${filter} on row ${y}`);
    }
    prev = row;
  }
  return { width, height, channels, data: out };
}

// ---- PNG 写（RGB8，filter 0）----
function encodePng(width, height, rgb, name) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const chunk = (type, body) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, "ascii");
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
    return Buffer.concat([head, body, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const out = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(name, out);
  return out.length;
}

// ---- 图像：浮点 RGB 缓冲（便于缩放 / 模糊）----
class Image {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Float32Array(w * h * 3);
  }

  static fromFile(file, crop) {
    const png = decodePng(readFileSync(file), file);
    let { width: w, height: h } = png;
    const ch = png.channels;
    const data = png.data;
    let x0 = 0;
    let y0 = 0;
    if (crop) {
      const [cx, cy, cw, chh] = crop;
      if (cx + cw > w || cy + chh > h) throw new Error(`${file}: crop outside image`);
      x0 = cx;
      y0 = cy;
      w = cw;
      h = chh;
    }
    const img = new Image(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const s = ((y + y0) * png.width + (x + x0)) * ch;
        const d = (y * w + x) * 3;
        if (ch >= 3) {
          img.px[d] = data[s];
          img.px[d + 1] = data[s + 1];
          img.px[d + 2] = data[s + 2];
        } else {
          img.px[d] = img.px[d + 1] = img.px[d + 2] = data[s];
        }
      }
    }
    return img;
  }

  /** 面积平均缩放到 w×h（缩小时就是 box 滤波）。 */
  resample(w, h) {
    const out = new Image(w, h);
    const sx = this.w / w;
    const sy = this.h / h;
    for (let y = 0; y < h; y++) {
      const y0 = y * sy;
      const y1 = (y + 1) * sy;
      const iy0 = Math.floor(y0);
      const iy1 = Math.min(this.h, Math.ceil(y1));
      for (let x = 0; x < w; x++) {
        const x0 = x * sx;
        const x1 = (x + 1) * sx;
        const ix0 = Math.floor(x0);
        const ix1 = Math.min(this.w, Math.ceil(x1));
        let r = 0;
        let g = 0;
        let b = 0;
        let wsum = 0;
        for (let j = iy0; j < iy1; j++) {
          const wy = Math.min(j + 1, y1) - Math.max(j, y0);
          if (wy <= 0) continue;
          for (let i = ix0; i < ix1; i++) {
            const wx = Math.min(i + 1, x1) - Math.max(i, x0);
            if (wx <= 0) continue;
            const ww = wx * wy;
            const s = (j * this.w + i) * 3;
            r += this.px[s] * ww;
            g += this.px[s + 1] * ww;
            b += this.px[s + 2] * ww;
            wsum += ww;
          }
        }
        const d = (y * w + x) * 3;
        out.px[d] = r / wsum;
        out.px[d + 1] = g / wsum;
        out.px[d + 2] = b / wsum;
      }
    }
    return out;
  }

  /** 可分高斯模糊（`sigma` 单位 = 当前网格的像素）。 */
  blur(sigma) {
    if (!(sigma > 0)) return this;
    const r = Math.max(1, Math.ceil(3 * sigma));
    const k = new Float32Array(2 * r + 1);
    let ks = 0;
    for (let i = -r; i <= r; i++) {
      k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
      ks += k[i + r];
    }
    for (let i = 0; i < k.length; i++) k[i] /= ks;
    const tmp = new Float32Array(this.px.length);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        let r0 = 0;
        let g0 = 0;
        let b0 = 0;
        for (let i = -r; i <= r; i++) {
          const xx = Math.min(this.w - 1, Math.max(0, x + i));
          const s = (y * this.w + xx) * 3;
          r0 += this.px[s] * k[i + r];
          g0 += this.px[s + 1] * k[i + r];
          b0 += this.px[s + 2] * k[i + r];
        }
        const d = (y * this.w + x) * 3;
        tmp[d] = r0;
        tmp[d + 1] = g0;
        tmp[d + 2] = b0;
      }
    }
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        let r0 = 0;
        let g0 = 0;
        let b0 = 0;
        for (let i = -r; i <= r; i++) {
          const yy = Math.min(this.h - 1, Math.max(0, y + i));
          const s = (yy * this.w + x) * 3;
          r0 += tmp[s] * k[i + r];
          g0 += tmp[s + 1] * k[i + r];
          b0 += tmp[s + 2] * k[i + r];
        }
        const d = (y * this.w + x) * 3;
        this.px[d] = r0;
        this.px[d + 1] = g0;
        this.px[d + 2] = b0;
      }
    }
    return this;
  }

  toBytes(gain) {
    return bytesOf(this.px, gain);
  }

  blitTo(dst, w, ox, oy) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const d = ((y + oy) * w + (x + ox)) * 3;
        const s = (y * this.w + x) * 3;
        dst[d] = this.px[s];
        dst[d + 1] = this.px[s + 1];
        dst[d + 2] = this.px[s + 2];
      }
    }
  }
}

function bytesOf(px, gain) {
  const out = new Uint8Array(px.length);
  for (let i = 0; i < out.length; i++) {
    const v = gain ? px[i] * gain : px[i];
    out[i] = Math.min(255, Math.max(0, Math.round(v)));
  }
  return out;
}

function absDiff(a, b) {
  const out = new Image(a.w, a.h);
  for (let i = 0; i < out.px.length; i += 3) {
    const d = Math.max(
      Math.abs(a.px[i] - b.px[i]),
      Math.abs(a.px[i + 1] - b.px[i + 1]),
      Math.abs(a.px[i + 2] - b.px[i + 2]),
    );
    out.px[i] = out.px[i + 1] = out.px[i + 2] = d;
  }
  return out;
}

function describe(diff, scale, skipTop) {
  const vals = [];
  for (let y = skipTop * scale; y < diff.h; y++) {
    for (let x = 0; x < diff.w; x++) vals.push(diff.px[(y * diff.w + x) * 3]);
  }
  vals.sort((p, q) => p - q);
  const n = vals.length;
  const at = (f) => vals[Math.min(n - 1, Math.floor(n * f))];
  const mean = vals.reduce((s, v) => s + v, 0) / n;
  const over = (t) => vals.filter((v) => v > t).length;
  return `mean=${mean.toFixed(3)} p99=${at(0.99)} p99.9=${at(0.999)} max=${vals[n - 1]} ` +
    `px>2=${over(2)} px>8=${over(8)} px>24=${over(24)} of ${n} px (skipped top ${skipTop} rows)`;
}

function parseSpec(arg) {
  const i = arg.lastIndexOf(".png:");
  if (i < 0) return { file: arg, crop: null };
  return { file: arg.slice(0, i + 4), crop: arg.slice(i + 5).split(",").map(Number) };
}

function main() {
  const argv = process.argv.slice(2);
  const opts = { scale: 1, blur: 0, skipTop: 0, out: "", diff: "" };
  const specs = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--scale") opts.scale = Number(argv[++i]);
    else if (a === "--blur") opts.blur = Number(argv[++i]);
    else if (a === "--skip-top") opts.skipTop = Number(argv[++i]);
    else if (a === "--out") opts.out = argv[++i];
    else if (a === "--diff") opts.diff = argv[++i];
    else specs.push(parseSpec(a));
  }
  if (specs.length < 2 || !opts.out) {
    console.error("usage: native/tools/shots_compare.mjs --out <stack.png> [--diff <diff.png>] " +
      "[--scale N] [--blur S] [--skip-top ROWS] <png[:x,y,w,h]> <png[:x,y,w,h]> [...]");
    return 2;
  }
  const w = LOGICAL_W * opts.scale;
  const h = LOGICAL_H * opts.scale;
  const imgs = specs.map((s) => {
    const raw = Image.fromFile(s.file, s.crop);
    const scale = raw.w / LOGICAL_W;
    console.log(`  ${s.file} ${raw.w}x${raw.h}${s.crop ? ` crop=${s.crop.join(",")}` : ""} ` +
      `-> ${w}x${h} (content scale=${scale.toFixed(5)})`);
    const grid = raw.resample(w, h);
    return opts.blur > 0 ? grid.blur(opts.blur * opts.scale) : grid;
  });
  const gap = Math.max(2, 3 * opts.scale);
  const stackH = h * imgs.length + gap * (imgs.length - 1);
  const stack = new Float32Array(w * stackH * 3);
  for (let i = 0; i < stack.length; i += 3) {
    stack[i] = 255;
    stack[i + 2] = 255;  // 品红分隔线
  }
  imgs.forEach((im, i) => im.blitTo(stack, w, 0, i * (h + gap)));
  const bytes = encodePng(w, stackH, bytesOf(stack, 0), opts.out);
  console.log(`  -> ${opts.out} (${bytes} bytes, ${imgs.length} tiles of ${w}x${h})`);
  for (let i = 1; i < imgs.length; i++) {
    const d = absDiff(imgs[0], imgs[i]);
    console.log(`  diff[0 vs ${i}] ${describe(d, opts.scale, opts.skipTop)}`);
    if (opts.diff && i === 1) {
      const name = imgs.length > 2 ? `${opts.diff}.${i}.png` : opts.diff;
      encodePng(w, h, d.toBytes(8), name);
      console.log(`  -> ${name} (diff amplified x8)`);
    }
  }
  return 0;
}

process.exit(main());
