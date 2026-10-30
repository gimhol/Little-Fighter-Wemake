#!/usr/bin/env node
// 生成"平替"新地图的背景贴图（纯 Node，无第三方依赖：自带 RGBA PNG 编码）。
//
//   node scripts/gen-map-art.mjs            # 生成全部
//   node scripts/gen-map-art.mjs frost_hollow
//
// 产物写进 lf2s/origin/extra_data/bg/<map>/*.png，与手写的 <map>.bg.json5 配对。
//
// 坐标约定（与 `GodotWorldRenderer::build_background` 一致）：
//   图层占屏幕行 [450 - y - h, 450 - y]，`y` 是图层底边离屏幕底部的高度。
//   `base.far / near` 决定可走深度带：角色脚底行 = 450 - (y - z/2)，
//   即 z=-90（near）在行 405、z=-370（far）在行 250 ⇒ 地面图从行 200 画到 450。
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BG_ROOT = resolve(HERE, '..', 'lf2s', 'origin', 'extra_data', 'bg')

/** 地面图层：屏幕行 200..450 ⇒ 高 250、y=250 */
const GROUND_TOP = 200
const GROUND_Y = 450 - GROUND_TOP
/** 可走深度带在屏幕上的两条边（z=near / z=far） */
const NEAR_ROW = 405
const FAR_ROW = 250

/** 深度比例 0（far）→ 1（near）对应的屏幕行 */
const rowAt = (t) => FAR_ROW + (NEAR_ROW - FAR_ROW) * t
/** 深度比例 → 地面图层内的行号 */
const groundY = (t) => rowAt(t) - GROUND_TOP

// ---------------------------------------------------------------- 画布与编码

class Raster {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.px = new Uint8Array(w * h * 4)
  }

  blend(x, y, [r, g, b], a = 1) {
    x = Math.round(x); y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return
    const i = (y * this.w + x) * 4
    const da = this.px[i + 3] / 255
    const oa = a + da * (1 - a)
    if (oa <= 0) return
    for (let k = 0; k < 3; k++) {
      const src = k === 0 ? r : k === 1 ? g : b
      this.px[i + k] = Math.round((src * a + this.px[i + k] * da * (1 - a)) / oa)
    }
    this.px[i + 3] = Math.round(oa * 255)
  }

  /** 实心矩形（含端点），color 可以是数组或 (x,y)=>数组|undefined */
  rect(x0, y0, x1, y1, color, a = 1) {
    const xa = Math.max(0, Math.round(Math.min(x0, x1)))
    const xb = Math.min(this.w - 1, Math.round(Math.max(x0, x1)))
    const ya = Math.max(0, Math.round(Math.min(y0, y1)))
    const yb = Math.min(this.h - 1, Math.round(Math.max(y0, y1)))
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const c = typeof color === 'function' ? color(x, y) : color
        if (c) this.blend(x, y, c, a)
      }
    }
  }

  /** 竖直线性渐变（4×4 有序抖动，像素画质感）；stops: [[t, [r,g,b]], ...] */
  vgrad(y0, y1, stops, dither = true) {
    const a = Math.min(y0, y1)
    const b = Math.max(y0, y1)
    for (let y = Math.max(0, Math.round(a)); y <= Math.min(this.h - 1, Math.round(b)); y++) {
      const t = (y - a) / Math.max(1, b - a)
      for (let x = 0; x < this.w; x++) {
        const shift = dither ? (bayer4(x, y) / 16 - 0.5) * 1.6 : 0
        this.blend(x, y, sample(stops, clamp01(t + shift / 64)), 1)
      }
    }
  }

  /** 以 y=base 为底、按列高 hFn(x) 向上填充剪影 */
  silhouette(base, hFn, color) {
    for (let x = 0; x < this.w; x++) {
      const h = Math.max(0, Math.round(hFn(x)))
      for (let y = base - h; y <= base; y++) {
        if (y < 0) continue
        const c = typeof color === 'function' ? color(x, y, base - h) : color
        if (c) this.blend(x, y, c, 1)
      }
    }
  }

  disc(cx, cy, r, color, a = 1) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x - cx, y - cy)
        if (d <= r) this.blend(x, y, color, a * Math.min(1, (r - d) * 0.8 + 0.4))
      }
    }
  }
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

function sample(stops, t) {
  for (let i = 1; i < stops.length; i++) {
    if (t > stops[i][0]) continue
    const [t0, c0] = stops[i - 1]
    const [t1, c1] = stops[i]
    const k = t1 === t0 ? 0 : (t - t0) / (t1 - t0)
    return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * k))
  }
  return stops[stops.length - 1][1]
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const bayer4 = (x, y) => BAYER[((y & 3) << 2) | (x & 3)]

/** 确定性伪随机（mulberry32） */
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CRC = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return (buf) => {
    let c = -1
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    return (c ^ -1) >>> 0
  }
})()

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(CRC(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function encodePng(raster) {
  const { w, h, px } = raster
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    Buffer.from(px.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function save(mapId, name, raster) {
  const dir = join(BG_ROOT, mapId)
  mkdirSync(dir, { recursive: true })
  const file = join(dir, name)
  writeFileSync(file, encodePng(raster))
  console.log(`  ${mapId}/${name}  ${raster.w}x${raster.h}`)
}

// ---------------------------------------------------------------- 通用零件

/** 角色脚下的椭圆阴影（37x9，与 base.shadow_w/h 对齐） */
function shadowSprite() {
  const g = new Raster(37, 9)
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 37; x++) {
      const dx = (x - 18) / 18
      const dy = (y - 4) / 4
      const d = dx * dx + dy * dy
      if (d <= 1) g.blend(x, y, [0, 0, 0], 0.55 * (1 - d) ** 0.5)
    }
  }
  return g
}

/** 不规则巨石：多瓣轮廓 + 雪帽 + 落影 */
function boulder(g, cx, baseY, w, h, seed) {
  const rand = rng(seed)
  const lobes = [
    { cx: cx - w * 0.24, w: w * 0.62, h: h * 0.72 },
    { cx: cx + w * 0.2, w: w * 0.58, h: h * 0.95 },
    { cx: cx, w: w * 0.5, h: h * 1.05 },
  ]
  const tops = new Map()
  for (const lobe of lobes) {
    for (let dx = -lobe.w / 2; dx <= lobe.w / 2; dx++) {
      const k = 1 - Math.abs(dx) / (lobe.w / 2)
      const top = baseY - lobe.h * Math.pow(k, 0.62)
      const x = Math.round(lobe.cx + dx)
      const prev = tops.get(x)
      if (prev === undefined || top < prev) tops.set(x, top)
      for (let y = Math.round(top); y <= baseY; y++) {
        const shade = 0.62 + 0.38 * Math.min(1, (y - top) / Math.max(1, baseY - top))
        g.blend(x, y, [58 * shade, 70 * shade, 84 * shade].map(Math.round), 1)
      }
    }
  }
  // 雪帽：沿上轮廓铺一层
  for (const [x, top] of tops) {
    const capH = 3 + rand() * 4
    for (let y = Math.round(top); y < top + capH; y++) {
      g.blend(x, y, [232, 244, 252], 0.92)
    }
  }
  // 落影
  for (let dx = -w / 2; dx <= w / 2; dx++) {
    const k = 1 - Math.abs(dx) / (w / 2)
    for (let y = baseY + 1; y <= baseY + 4; y++) {
      g.blend(cx + dx, y, [110, 136, 160], 0.16 * k)
    }
  }
}

/** 随深度变粗的横向纹理：做出"向远处收敛"的透视感 */
function driftLines(g, x0, x1, palette, count, seed) {
  const rand = rng(seed)
  for (let i = 0; i < count; i++) {
    const t = rand()
    const y = groundY(t) + (rand() - 0.5) * 3
    const len = 40 + rand() * (60 + t * 220)
    const cx = x0 + rand() * Math.max(1, x1 - x0)
    const thick = t > 0.6 ? 2 : 1
    const c = rand() < 0.5 ? palette.light : palette.dark
    for (let dy = 0; dy < thick; dy++) {
      for (let dx = -len / 2; dx < len / 2; dx++) {
        const k = 1 - Math.abs(dx) / (len / 2)
        if (rand() < 0.25 + 0.55 * k) g.blend(cx + dx, y + dy, c, 0.16 + 0.3 * k)
      }
    }
  }
  // 颗粒：近处更密更大
  for (let i = 0; i < palette.grains; i++) {
    const t = Math.pow(rand(), 0.6)
    const x = x0 + rand() * Math.max(1, x1 - x0)
    const y = groundY(t) + (rand() - 0.5) * (2 + t * 6)
    g.blend(x, y, rand() < 0.5 ? palette.light : palette.dark, 0.1 + rand() * 0.22)
  }
}

/**
 * 透视铺装：横缝按深度排布、砖宽随深度变宽、明暗随深度增强。
 * 这是"地面"能不能读成地面（而不是一堵墙）的关键。
 */
function floorPlane(g, opts) {
  const { x0 = 0, x1 = g.w, rowCount = 13, cell, joint, seed, moss } = opts
  const rand = rng(seed)
  g.vgrad(0, g.h - 1, opts.gradient)
  for (let i = 0; i < rowCount; i++) {
    // 行高按幂次递增：越靠近镜头越大，这是"地面"最强的一条透视线索
    const t0 = Math.pow(i / rowCount, 2.1)
    const t1 = Math.pow((i + 1) / rowCount, 2.1)
    const y0 = groundY(t0)
    const y1 = groundY(t1)
    const cw = cell * (0.5 + 2.2 * t0)
    const offset = (i % 2 ? cw / 2 : 0) + Math.round(rand() * cw * 0.25)
    // 横缝
    for (let x = x0; x <= x1; x++) {
      g.blend(x, y0, joint, 0.1 + 0.34 * t0)
    }
    // 竖缝
    for (let x = x0 - cw; x <= x1 + cw; x += cw) {
      const jx = Math.round(x + offset)
      for (let y = Math.round(y0); y <= Math.round(y1); y++) {
        g.blend(jx, y, joint, 0.07 + 0.3 * t0)
      }
    }
    // 每块砖内部轻微明暗
    for (let x = x0; x <= x1; x += 1) {
      if (rand() > 0.06) continue
      g.blend(x, y0 + rand() * (y1 - y0), [255, 255, 255], 0.03 + 0.05 * t0)
    }
  }
  // 苔藓 / 污渍
  if (moss) {
    for (let i = 0; i < moss.count; i++) {
      const t = rand()
      const x = x0 + rand() * (x1 - x0)
      const y = groundY(t) + (rand() - 0.5) * 6
      const r = 2 + rand() * (3 + t * 7)
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r || rand() < 0.4) continue
          g.blend(x + dx, y + dy, moss.color, 0.08 + rand() * 0.18)
        }
      }
    }
  }
  // 远端雾带：让地面"融"进背景，别像一堵墙突然开始
  if (opts.fog) {
    const fogRows = 22
    for (let y = 0; y < fogRows; y++) {
      const a = 0.5 * (1 - y / fogRows) ** 1.4
      for (let x = x0; x <= x1; x++) g.blend(x, y, opts.fog, a)
    }
  }
}



// ---------------------------------------------------------------- 地图一：霜谷

function frostSky() {
  const g = new Raster(794, 450)
  g.vgrad(0, 449, [
    [0, [8, 12, 30]],
    [0.28, [16, 26, 54]],
    [0.5, [32, 52, 86]],
    [0.68, [66, 96, 128]],
    [0.82, [116, 148, 176]],
    [1, [156, 180, 202]],
  ])
  const rand = rng(7)
  for (let i = 0; i < 160; i++) {
    const x = Math.floor(rand() * 794)
    const y = Math.floor(rand() * 170)
    const b = 150 + Math.floor(rand() * 105)
    g.blend(x, y, [b, b, Math.min(255, b + 12)], 0.55 + rand() * 0.45)
    if (rand() < 0.18) g.blend(x + 1, y, [b, b, b], 0.4)
  }
  // 月亮 + 冷光晕
  g.disc(618, 78, 58, [176, 198, 226], 0.1)
  g.disc(618, 78, 44, [206, 222, 240], 0.14)
  g.disc(618, 78, 30, [236, 244, 252], 1)
  g.disc(606, 70, 7, [214, 226, 238], 0.5)
  g.disc(626, 88, 5, [214, 226, 238], 0.45)
  // 极光带
  for (let x = 0; x < 794; x++) {
    const base = 96 + Math.sin(x / 90) * 26 + Math.sin(x / 31) * 8
    for (let y = Math.round(base); y < Math.round(base + 30); y++) {
      const k = 1 - (y - base) / 30
      g.blend(x, y, [80, 210, 180], 0.05 * k)
    }
  }
  return g
}

function frostRidge(w, h, seed, peak, body, cap) {
  const g = new Raster(w, h)
  const rand = rng(seed)
  // 锯齿山脊：峰点 + 随机游走的中段，比纯正弦更像山
  const peaks = []
  let x = -40
  while (x < w + 40) {
    peaks.push({ x, h: h * peak * (0.35 + rand() * 0.65) })
    x += 90 + rand() * 190
  }
  const heightAt = (px) => {
    for (let i = 1; i < peaks.length; i++) {
      const a = peaks[i - 1]
      const b = peaks[i]
      if (px > b.x) continue
      const t = (px - a.x) / Math.max(1, b.x - a.x)
      // 用幂次让峰更尖（山形而非圆弧）
      const k = t < 0.5 ? Math.pow(t * 2, 0.75) / 2 : 1 - Math.pow((1 - t) * 2, 0.75) / 2
      return a.h + (b.h - a.h) * k + Math.sin(px / 9) * 2
    }
    return 0
  }
  g.silhouette(h - 1, heightAt, (px, y, top) => {
    const snow = y < top + 8 + (heightAt(px) / h) * 14
    return snow ? cap : body
  })
  // 山体阴影：背光侧压暗
  for (let px = 0; px < w; px++) {
    const top = h - 1 - Math.round(heightAt(px))
    for (let y = top; y < h; y++) {
      const k = (y - top) / Math.max(1, h - top)
      if (k > 0.15) g.blend(px, y, [10, 16, 26], 0.06 + k * 0.1)
    }
  }
  return g
}

function frostPines(w, h, seed) {
  const g = new Raster(w, h)
  const rand = rng(seed)
  const snow = [176, 204, 228]
  const needle = [16, 28, 38]
  const needle2 = [24, 40, 52]
  let x = 6
  while (x < w) {
    const th = 70 + Math.floor(rand() * 90)
    const base = h - 1 - Math.floor(rand() * 8)
    const width = 16 + rand() * 12
    for (let layer = 0; layer < 4; layer++) {
      const ly = base - th + (th / 4) * layer
      const half = width * (0.55 + layer * 0.28)
      const lh = th / 3
      for (let y = Math.round(ly); y < Math.round(ly + lh); y++) {
        const k = (y - ly) / lh
        const hw = half * k
        for (let dx = -hw; dx <= hw; dx++) {
          const c = rand() < 0.08 ? needle2 : needle
          g.blend(x + dx, y, c, 1)
        }
      }
      // 积雪边：每层上缘亮一条
      for (let dx = -half * 0.55; dx <= half * 0.55; dx++) {
        if (rand() < 0.35) continue
        g.blend(x + dx, Math.round(ly) + Math.round(Math.abs(dx) * 0.6), snow, 0.75)
      }
    }
    for (let y = base - 12; y <= base; y++) g.blend(x, y, [20, 26, 32], 1)
    x += 22 + Math.floor(rand() * 30)
  }
  return g
}

function frostGround() {
  const g = new Raster(2400, 250)
  // 雪地平面：后深前浅
  g.vgrad(0, 249, [
    [0, [104, 130, 154]],
    [0.35, [146, 174, 198]],
    [0.72, [192, 214, 232]],
    [1, [226, 240, 248]],
  ])
  // 与远景衔接的地平雾带
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 2400; x++) g.blend(x, y, [188, 208, 226], 0.14 * (1 - y / 16))
  }
  driftLines(g, 0, 2400, { light: [255, 255, 255], dark: [150, 176, 198], grains: 6200 }, 90, 41)
  const rand = rng(43)
  // 雪原上的起伏：几条亮/暗的坡线
  for (let i = 0; i < 9; i++) {
    const t = 0.1 + i * 0.1
    const y = groundY(t)
    const amp = 3 + i * 1.6
    for (let x = 0; x < 2400; x++) {
      const yy = y + Math.sin(x / (60 + i * 12) + i) * amp
      g.blend(x, yy, [255, 255, 255], 0.1 + i * 0.015)
      g.blend(x, yy + 1.5, [132, 158, 182], 0.08 + i * 0.012)
    }
  }
  // 岩体：几块带雪帽的巨石（不规则轮廓，别画成帐篷）
  for (const [cx, bw, bh, sd] of [[300, 220, 46, 5], [1020, 170, 34, 7], [2120, 250, 52, 9]]) {
    boulder(g, cx, groundY(0.32), bw, bh, sd)
  }
  return g
}

// ---------------------------------------------------------------- 地图二：琥珀码头

function docksSky() {
  const g = new Raster(794, 450)
  g.vgrad(0, 449, [
    [0, [10, 12, 26]],
    [0.3, [22, 26, 46]],
    [0.55, [54, 44, 62]],
    [0.75, [126, 82, 62]],
    [0.9, [196, 128, 72]],
    [1, [222, 162, 96]],
  ])
  const rand = rng(19)
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(rand() * 794)
    const y = Math.floor(rand() * 120)
    g.blend(x, y, [220, 226, 240], 0.3 + rand() * 0.5)
  }
  // 低垂的月
  g.disc(206, 96, 46, [230, 170, 110], 0.12)
  g.disc(206, 96, 24, [244, 206, 150], 0.95)
  // 城市辉光
  for (let x = 0; x < 794; x++) {
    const k = 1 - Math.abs(x - 470) / 470
    for (let y = 150; y < 200; y++) g.blend(x, y, [220, 150, 90], 0.06 * k * (y - 150) / 50)
  }
  return g
}

function docksSkyline(w, h, seed) {
  const g = new Raster(w, h)
  const rand = rng(seed)
  let x = -10
  while (x < w) {
    const bw = 26 + Math.floor(rand() * 54)
    const bh = 40 + Math.floor(rand() * (h * 0.72))
    const body = [24, 26, 40]
    g.rect(x, h - 1 - bh, x + bw, h - 1, body)
    // 亮窗
    for (let wy = h - bh + 6; wy < h - 6; wy += 8) {
      for (let wx = x + 4; wx < x + bw - 3; wx += 6) {
        if (rand() < 0.42) {
          const warm = rand() < 0.75
          g.blend(wx, wy, warm ? [240, 196, 120] : [150, 210, 230], 0.55 + rand() * 0.45)
          if (rand() < 0.5) g.blend(wx + 1, wy, warm ? [240, 196, 120] : [150, 210, 230], 0.4)
        }
      }
    }
    if (rand() < 0.3) g.rect(x + bw / 2 - 1, h - 1 - bh - 12, x + bw / 2, h - 1 - bh, body)
    x += bw + 4 + Math.floor(rand() * 16)
  }
  return g
}

function docksCranes(w, h, seed) {
  const g = new Raster(w, h)
  const rand = rng(seed)
  const steel = [18, 20, 30]
  // 集装箱堆（码头岸线）
  for (let x = 0; x < w; x += 46) {
    const stack = 1 + Math.floor(rand() * 3)
    for (let s = 0; s < stack; s++) {
      const hue = [[92, 54, 44], [44, 66, 78], [70, 62, 44], [58, 48, 66]][Math.floor(rand() * 4)]
      g.rect(x, h - 1 - (s + 1) * 14, x + 42, h - 1 - s * 14, hue)
      g.rect(x, h - 1 - (s + 1) * 14, x + 42, h - 1 - (s + 1) * 14 + 1, [hue[0] + 26, hue[1] + 26, hue[2] + 26])
    }
  }
  // 龙门吊剪影
  for (const cx of [140, 620, 1040]) {
    const legH = h * 0.55
    for (const dx of [-52, 52]) {
      g.rect(cx + dx, h - 1 - legH, cx + dx + 6, h - 1, steel)
    }
    g.rect(cx - 58, h - 1 - legH - 10, cx + 58, h - 1 - legH, steel)
    // 吊臂
    g.rect(cx - 120, h - 1 - legH - 22, cx + 150, h - 1 - legH - 14, steel)
    g.rect(cx + 96, h - 1 - legH - 14, cx + 102, h - 1 - legH + 40, steel)
    // 警示灯
    g.blend(cx + 150, h - 1 - legH - 24, [255, 120, 90], 0.9)
  }
  return g
}

function docksGround() {
  const g = new Raster(2400, 250)
  floorPlane(g, {
    gradient: [
      [0, [30, 32, 42]],
      [0.45, [50, 52, 64]],
      [1, [80, 82, 96]],
    ],
    rowCount: 11,
    cell: 108,
    joint: [18, 20, 28],
    seed: 89,
    fog: [46, 40, 52],
  })
  const rand = rng(83)
  // 积水与反光
  for (let i = 0; i < 26; i++) {
    const t = 0.2 + rand() * 0.75
    const cx = rand() * 2400
    const w = 60 + rand() * 180
    const y = groundY(t)
    for (let dx = -w / 2; dx < w / 2; dx++) {
      const k = 1 - Math.abs(dx) / (w / 2)
      const hh = 2 + k * 5
      for (let yy = Math.round(y - hh); yy <= Math.round(y + hh * 0.4); yy++) {
        g.blend(cx + dx, yy, [30, 40, 58], 0.25 * k)
      }
    }
    // 灯光在水面的细条倒影
    for (let k = 0; k < 30; k++) {
      const x = cx - w / 2 + rand() * w
      g.blend(x, y - rand() * 6, [226, 168, 104], 0.18 + rand() * 0.2)
    }
  }
  return g
}

// ---------------------------------------------------------------- 地图三：沉没神龛

function shrineSky() {
  const g = new Raster(794, 450)
  g.vgrad(0, 449, [
    [0, [24, 44, 54]],
    [0.35, [40, 74, 78]],
    [0.62, [96, 112, 92]],
    [0.82, [176, 148, 96]],
    [1, [206, 170, 108]],
  ])
  const rand = rng(29)
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rand() * 794)
    const y = Math.floor(rand() * 130)
    g.blend(x, y, [226, 236, 214], 0.2 + rand() * 0.4)
  }
  // 被雾气散开的落日
  g.disc(560, 150, 62, [246, 206, 140], 0.1)
  g.disc(560, 150, 30, [250, 220, 158], 0.55)
  return g
}

function shrineHills(w, h, seed) {
  const g = new Raster(w, h)
  const rand = rng(seed)
  const bumps = Array.from({ length: 5 }, () => ({ f: 0.002 + rand() * 0.008, p: rand() * 6.28 }))
  const height = (x) => {
    let v = 0.5
    for (const b of bumps) v += Math.sin(x * b.f + b.p) * 0.14
    return h * 0.75 * Math.max(0.15, Math.min(1, v))
  }
  g.silhouette(h - 1, height, [46, 66, 70])
  // 山顶神庙剪影
  for (const cx of [230, 690]) {
    const top = h - 1 - height(cx) - 16
    g.rect(cx - 14, top, cx + 14, top + 12, [52, 74, 76])
    g.rect(cx - 4, top - 8, cx + 4, top, [52, 74, 76])
  }
  return g
}

function shrineCanopy(w, h, seed) {
  const g = new Raster(w, h)
  const rand = rng(seed)
  const far = [22, 46, 40]
  const nearLeaf = [30, 60, 48]
  const rim = [64, 104, 66]
  // 远层：贴着图层底部的低矮树冠带（留出上面的天空）
  for (let x = 0; x < w; x++) {
    const base = h * 0.72 + Math.sin(x / 71) * 10 + Math.sin(x / 23) * 5
    for (let y = Math.round(base); y < h; y++) {
      g.blend(x, y, far, 0.9)
    }
  }
  // 近层：一个个独立树冠（冠与冠之间留缺口），顶缘带一圈亮叶
  let x = 20
  while (x < w) {
    const r = 34 + rand() * 30
    const cy = h * (0.24 + rand() * 0.3)
    for (let y = Math.round(cy - r); y <= cy + r; y++) {
      for (let dx = Math.round(-r); dx <= r; dx++) {
        const d = Math.hypot(dx, (y - cy) * 1.15) / r
        if (d > 1) continue
        if (d > 0.8 && rand() < 0.4) continue
        const isRim = y < cy - r * 0.35 && rand() < 0.5
        g.blend(x + dx, y, isRim ? rim : nearLeaf, isRim ? 0.85 : 0.97)
      }
    }
    x += r * (1.15 + rand() * 0.7)
  }
  // 垂藤
  for (let i = 0; i < 22; i++) {
    const vx = Math.floor(rand() * w)
    const len = 40 + rand() * (h * 0.55)
    for (let y = 0; y < len; y++) {
      g.blend(vx + Math.round(Math.sin(y / 12) * 2), y, [26, 50, 42], 0.75)
      if (rand() < 0.04) g.blend(vx + 1, y, [58, 92, 62], 0.5)
    }
  }
  return g
}

function shrineGround() {
  const g = new Raster(2400, 250)
  floorPlane(g, {
    gradient: [
      [0, [40, 52, 40]],
      [0.5, [58, 72, 50]],
      [1, [92, 104, 70]],
    ],
    rowCount: 12,
    cell: 62,
    joint: [30, 38, 28],
    seed: 97,
    moss: { count: 240, color: [70, 104, 58] },
    fog: [52, 74, 68],
  })
  const rand = rng(103)
  // 水痕
  for (let i = 0; i < 120; i++) {
    const t = rand()
    const x = rand() * 2400
    const y = groundY(t) + rand() * 6
    g.blend(x, y, [30, 44, 34], 0.12 + rand() * 0.2)
  }
  return g
}

// ---------------------------------------------------------------- 生成

const MAPS = {
  frost_hollow() {
    save('frost_hollow', 'sky.png', frostSky())
    save('frost_hollow', 'ridge_far.png', frostRidge(900, 200, 11, 0.9, [34, 50, 74], [150, 180, 210]))
    save('frost_hollow', 'ridge_near.png', frostRidge(1200, 190, 23, 0.75, [22, 36, 56], [116, 146, 176]))
    save('frost_hollow', 'pines.png', frostPines(1500, 190, 5))
    save('frost_hollow', 'ground.png', frostGround())
    save('frost_hollow', 's.png', shadowSprite())
  },
  amber_docks() {
    save('amber_docks', 'sky.png', docksSky())
    save('amber_docks', 'skyline.png', docksSkyline(900, 200, 31))
    save('amber_docks', 'cranes.png', docksCranes(1200, 190, 47))
    save('amber_docks', 'ground.png', docksGround())
    save('amber_docks', 's.png', shadowSprite())
  },
  sunken_shrine() {
    save('sunken_shrine', 'sky.png', shrineSky())
    save('sunken_shrine', 'hills.png', shrineHills(900, 200, 53))
    save('sunken_shrine', 'canopy.png', shrineCanopy(1500, 190, 61))
    save('sunken_shrine', 'ground.png', shrineGround())
    save('sunken_shrine', 's.png', shadowSprite())
  },
}

const only = process.argv.slice(2)
for (const [id, make] of Object.entries(MAPS)) {
  if (only.length && !only.includes(id)) continue
  console.log(`${id}:`)
  make()
}
console.log(`ok -> ${BG_ROOT}`)
