// 生成 3 个原创可玩角色（像素精灵图 + 角色数据）。
//
//   node scripts/gen-fighters.mjs          # 全部生成
//   node scripts/gen-fighters.mjs rocky    # 只生成指定角色
//
// 产物：
//   lf2s/origin/extra_data/characters/<id>/sprite/{0,1,face,s}.png
//   lf2s/origin/extra_data/characters/<id>/<id>.obj.json5
//   lf2s/origin/extra_data/characters/<id>/<id>.index.json5
//   lf2s/origin/extra_data/characters/<id>/README.md
//
// 角色数据以 lf2s/origin/prel_data/data/gim.obj.json5 为模板（作者自有数据），
// 只替换 id / 名称 / 图片 / 数值，并追加专属招式；
// 精灵图全部由本脚本程序化绘制，不使用任何既有素材。
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSON5 from 'json5'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const CHAR_ROOT = join(ROOT, 'lf2s', 'origin', 'extra_data', 'characters')
const TEMPLATE = join(ROOT, 'lf2s', 'origin', 'prel_data', 'data', 'gim.obj.json5')
const MOVES_DIR = join(ROOT, 'lf2s', 'origin', 'extra_data', 'moves')

/** 单元格 79x79、步距 80 —— 与模板帧数据里的 pic 坐标一一对应 */
const CELL = 79
const PITCH = 80
const SHEET_W = 800
const SHEET_H = 560
const FACE = 120
/** 弹丸贴图：每帧一个方格 */
const BALL_CELL = 48
const SMALL_W = 40
const SMALL_H = 45
/** 脚底在单元格内的行号 */
const FOOT_Y = 75.5
/** 站立时的基准 X */
const CX = 39

// ---------------------------------------------------------------- PNG 编码

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'latin1')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

function encode_png(w, h, px) {
  const stride = w * 4
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0
    Buffer.from(px.buffer, px.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1)
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

// ---------------------------------------------------------------- 画布

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const rad = (deg) => (deg * Math.PI) / 180

class Raster {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.px = new Uint8Array(w * h * 4)
  }

  /** 直接覆盖像素（像素画不需要抗锯齿） */
  set(x, y, c, a = 1) {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return
    const i = (y * this.w + x) * 4
    this.px[i] = c[0]
    this.px[i + 1] = c[1]
    this.px[i + 2] = c[2]
    this.px[i + 3] = Math.round(clamp(a, 0, 1) * 255)
  }

  blend(x, y, c, a = 1) {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return
    const i = (y * this.w + x) * 4
    const da = this.px[i + 3] / 255
    const oa = a + da * (1 - a)
    if (oa <= 0) return
    for (let k = 0; k < 3; k++)
      this.px[i + k] = Math.round((c[k] * a + this.px[i + k] * da * (1 - a)) / oa)
    this.px[i + 3] = Math.round(oa * 255)
  }

  opaque(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false
    return this.px[(y * this.w + x) * 4 + 3] > 0
  }

  /** 圆头线段的填充；color 可以是 (x,y,signedOffset) => 颜色 */
  capsule(ax, ay, bx, by, r, color, a = 1) {
    if (r <= 0) return
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    const len2 = dx * dx + dy * dy
    const nx = -dy / len
    const ny = dx / len
    const x0 = Math.floor(Math.min(ax, bx) - r - 1)
    const x1 = Math.ceil(Math.max(ax, bx) + r + 1)
    const y0 = Math.floor(Math.min(ay, by) - r - 1)
    const y1 = Math.ceil(Math.max(ay, by) + r + 1)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = len2 ? clamp(((x - ax) * dx + (y - ay) * dy) / len2, 0, 1) : 0
        const px = ax + dx * t
        const py = ay + dy * t
        const d = Math.hypot(x - px, y - py)
        if (d > r) continue
        const s = ((x - ax) * nx + (y - ay) * ny) / r
        this.blend(x, y, typeof color === 'function' ? color(x, y, s, t) : color, a)
      }
    }
  }

  disc(cx, cy, r, color, a = 1) {
    const x0 = Math.floor(cx - r - 1)
    const x1 = Math.ceil(cx + r + 1)
    const y0 = Math.floor(cy - r - 1)
    const y1 = Math.ceil(cy + r + 1)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy)
        if (d > r) continue
        const s = clamp((x - cx) / r + ((y - cy) / r) * 0.35, -1, 1)
        this.blend(x, y, typeof color === 'function' ? color(x, y, s) : color, a)
      }
    }
  }

  /** 简单多边形填充（扫描线） */
  poly(points, color, a = 1) {
    let minY = Infinity
    let maxY = -Infinity
    for (const [, y] of points) {
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs = []
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i]
        const [x1, y1] = points[(i + 1) % points.length]
        if (y0 === y1) continue
        if ((y >= Math.min(y0, y1) && y < Math.max(y0, y1))) {
          xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0))
        }
      }
      xs.sort((p, q) => p - q)
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.ceil(xs[i]); x <= Math.floor(xs[i + 1]); x++)
          this.blend(x, y, typeof color === 'function' ? color(x, y) : color, a)
      }
    }
  }

  /** 沿轮廓加深色描边（向内 1px） */
  outline(color) {
    const src = this.px.slice()
    const w = this.w
    const h = this.h
    const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!op(x, y)) continue
        if (!op(x - 1, y) || !op(x + 1, y) || !op(x, y - 1) || !op(x, y + 1)) {
          const i = (y * w + x) * 4
          this.px[i] = color[0]
          this.px[i + 1] = color[1]
          this.px[i + 2] = color[2]
          this.px[i + 3] = 255
        }
      }
    }
  }

  /** 把 src 贴到 (ox,oy) */
  blit(src, ox, oy) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4
        if (!src.px[i + 3]) continue
        this.set(ox + x, oy + y, [src.px[i], src.px[i + 1], src.px[i + 2]], src.px[i + 3] / 255)
      }
    }
  }
}

// ---------------------------------------------------------------- 角色配置

const OUTLINE = [22, 16, 22]
const ramp = (base, light, shade) => ({ base, light, shade })
const shade_ramp = (c, k = 0.28) => {
  const light = c.map((v) => Math.round(clamp(v + 255 * k * 0.55, 0, 255)))
  const shade = c.map((v) => Math.round(clamp(v * (1 - k * 1.5), 0, 255)))
  return ramp(c, light, shade)
}

const CHARS = [
  {
    id: 'rocky',
    name: 'Rocky',
    title: '铁拳·洛奇',
    desc: '重拳型斗士。血厚、拳重、起手慢，靠一记重拳翻盘。',
    palette: {
      skin: shade_ramp([236, 188, 142], 0.22),
      hair: shade_ramp([196, 78, 44], 0.3),
      cloth: shade_ramp([196, 58, 52], 0.3),
      trim: shade_ramp([240, 206, 122], 0.24),
      boot: shade_ramp([126, 84, 58], 0.26),
      glove: shade_ramp([242, 238, 226], 0.22),
      accent: [250, 176, 66],
    },
    hair: 'spiky',
    build: {
      scale: 1,
      legLen: 22,
      thigh: 11,
      shin: 11,
      torso: 13.5,
      headR: 11,
      shoulder: 7.4,
      hipW: 5.4,
      upperArm: 9.4,
      foreArm: 8.4,
      armR: 3.6,
      legR: 4.0,
    },
    stats: { hp_max: 640, mp_max: 500, walk: 3.6, run: 7.2, ce: 2, atk: 1.18, knock: 1.16 },
    jump: { height: -15.4, distance: 8, distancez: 3.4 },
    tune: { punch: 1.2, super: 1.28 },
    specials: [
      {
        key: 'Da', enter: '72', mp: 45,
        i18n: 'moves.rocky_crush_punch', zh: '崩山重拳', en: 'Crush Punch',
        keys: 'D + v + A', demo: 'dDa', dx: -90,
      },
      {
        key: 'Ua', enter: '400', mp: 35,
        i18n: 'moves.rocky_quake_wave', zh: '震地波', en: 'Quake Wave',
        keys: 'D + ^ + A', demo: 'dUa', dx: -110,
        frames: [
          { id: '400', from: '70', wait: 6, next: '401' },
          { id: '401', from: '72', wait: 10, next: 'auto', itr: [], opoint: [{ oid: 'rocky_shock', x: 58, y: 42, dvx: 8 }] },
        ],
        projectile: {
          id: 'rocky_shock', name: 'RockyQuake', frames: 4, dvx: 9.5,
          injury: 42, hit_dvx: 4.5, fall: 30, bdefend: 60,
          art: 'quake',
          colors: { core: [255, 214, 132], body: [232, 132, 48], edge: [150, 68, 26] },
        },
      },
      {
        key: 'Fa', enter: '410', mp: 40,
        i18n: 'moves.rocky_iron_charge', zh: '铁壁冲', en: 'Iron Charge',
        keys: 'D + > + A', demo: 'dRa', dx: -140,
        frames: [
          { id: '410', from: '90', wait: 5, next: '411', invulnerable: 10 },
          { id: '411', from: '91', wait: 8, next: 'auto', invulnerable: 14,
            itr: [{ kind: 0, kind_name: 'ItrKind.Normal', x: 22, y: 36, w: 56, h: 26, injury: 78, hit_flag: 61, arest: 26, dvx: 7, dvy: 2, fall: 100, bdefend: 120, l: 24, z: -12 }] },
        ],
      },
    ],
  },
  {
    id: 'rin',
    name: 'Rin',
    feminine: true,
    title: '疾影·凛',
    desc: '速度型格斗家。体力偏低，但移动与突进连招极快。',
    palette: {
      skin: shade_ramp([244, 202, 166], 0.2),
      hair: shade_ramp([74, 196, 190], 0.3),
      cloth: shade_ramp([62, 122, 196], 0.3),
      trim: shade_ramp([226, 240, 246], 0.2),
      boot: shade_ramp([84, 92, 134], 0.26),
      glove: shade_ramp([112, 214, 206], 0.24),
      accent: [126, 238, 226],
    },
    hair: 'ponytail',
    build: {
      scale: 1,
      legLen: 24,
      thigh: 12,
      shin: 12,
      torso: 13,
      headR: 10.2,
      shoulder: 6,
      hipW: 4.4,
      upperArm: 8.6,
      foreArm: 7.8,
      armR: 3.1,
      legR: 3.5,
    },
    stats: { hp_max: 440, mp_max: 620, walk: 4.8, run: 9.6, ce: 1, atk: 0.92, knock: 0.94 },
    jump: { height: -17.6, distance: 10, distancez: 4.2 },
    tune: { run: 1.32, dash: 1.3 },
    specials: [
      {
        key: 'Da', enter: '91', mp: 45,
        i18n: 'moves.rin_shadow_rush', zh: '疾影冲', en: 'Shadow Rush',
        keys: 'D + v + A', demo: 'dDa', dx: -120,
      },
      {
        key: 'Ua', enter: '420', mp: 35,
        i18n: 'moves.rin_triple_kick', zh: '三连踢', en: 'Triple Kick',
        keys: 'D + ^ + A', demo: 'dUa', dx: -80,
        frames: [
          { id: '420', from: '60', wait: 3, next: '421', itr: [] },
          { id: '421', from: '61', wait: 4, next: '422',
            itr: [{ kind: 0, kind_name: 'ItrKind.Normal', x: 46, y: 34, w: 32, h: 18, injury: 26, hit_flag: 61, dvx: 2, bdefend: 20, l: 24, z: -12 }] },
          { id: '422', from: '65', wait: 4, next: '423',
            itr: [{ kind: 0, kind_name: 'ItrKind.Normal', x: 46, y: 34, w: 32, h: 18, injury: 28, hit_flag: 61, dvx: 3, bdefend: 24, l: 24, z: -12 }] },
          { id: '423', from: '66', wait: 6, next: 'auto',
            itr: [{ kind: 0, kind_name: 'ItrKind.Normal', x: 44, y: 32, w: 36, h: 22, injury: 34, hit_flag: 61, arest: 22, dvx: 5, dvy: 4, fall: 60, bdefend: 60, l: 24, z: -12 }] },
        ],
      },
      {
        key: 'Fa', enter: '430', mp: 30,
        i18n: 'moves.rin_wind_blade', zh: '风刃', en: 'Wind Blade',
        keys: 'D + > + A', demo: 'dRa', dx: -110,
        frames: [
          { id: '430', from: '70', wait: 4, next: '431', itr: [] },
          { id: '431', from: '72', wait: 8, next: 'auto', itr: [], opoint: [{ oid: 'rin_gale', x: 56, y: 40, dvx: 10 }] },
        ],
        projectile: {
          id: 'rin_gale', name: 'RinGale', frames: 4, dvx: 13,
          injury: 34, hit_dvx: 3.5, fall: 20, bdefend: 40,
          art: 'gale',
          colors: { core: [226, 255, 250], body: [92, 226, 214], edge: [30, 132, 150] },
        },
      },
    ],
  },
  {
    id: 'sera',
    name: 'Sera',
    feminine: true,
    title: '灵刃·赛拉',
    desc: '均衡型剑舞者。攻击距离更长，攻守兼备。',
    palette: {
      skin: shade_ramp([238, 198, 168], 0.2),
      hair: shade_ramp([238, 206, 122], 0.3),
      cloth: shade_ramp([92, 96, 178], 0.3),
      trim: shade_ramp([242, 226, 180], 0.22),
      boot: shade_ramp([104, 84, 132], 0.26),
      glove: shade_ramp([214, 214, 238], 0.22),
      accent: [186, 186, 250],
    },
    hair: 'long',
    build: {
      scale: 1,
      legLen: 23,
      thigh: 11.5,
      shin: 11.5,
      torso: 13.2,
      headR: 10.6,
      shoulder: 6.8,
      hipW: 5,
      upperArm: 9,
      foreArm: 8.2,
      armR: 3.4,
      legR: 3.8,
    },
    stats: { hp_max: 540, mp_max: 560, walk: 4.2, run: 8.4, ce: 1, atk: 1.02, knock: 1.0 },
    jump: { height: -16.4, distance: 9, distancez: 3.8 },
    tune: { run: 1.18, reach: 1.3 },
    specials: [
      {
        key: 'Da', enter: '86', mp: 40,
        i18n: 'moves.sera_double_moon', zh: '双月斩', en: 'Double Moon Slash',
        keys: 'D + v + A', demo: 'dDa', dx: -90,
      },
      {
        key: 'Ua', enter: '440', mp: 35,
        i18n: 'moves.sera_rising_slash', zh: '升龙斩', en: 'Rising Slash',
        keys: 'D + ^ + A', demo: 'dUa', dx: -70,
        frames: [
          { id: '440', from: '65', wait: 4, next: '441', itr: [] },
          { id: '441', from: '66', wait: 7, next: 'auto',
            itr: [{ kind: 0, kind_name: 'ItrKind.Normal', x: 30, y: 6, w: 40, h: 52, injury: 52, hit_flag: 61, arest: 24, dvx: 2, dvy: 8, fall: 110, bdefend: 90, l: 24, z: -12 }] },
        ],
      },
      {
        key: 'Fa', enter: '450', mp: 40,
        i18n: 'moves.sera_spirit_wave', zh: '灵刃波', en: 'Spirit Wave',
        keys: 'D + > + A', demo: 'dRa', dx: -120,
        frames: [
          { id: '450', from: '70', wait: 5, next: '451', itr: [] },
          { id: '451', from: '72', wait: 9, next: 'auto', itr: [], opoint: [{ oid: 'sera_wave', x: 58, y: 38, dvx: 9 }] },
        ],
        projectile: {
          id: 'sera_wave', name: 'SeraWave', frames: 4, dvx: 11.5,
          injury: 46, hit_dvx: 5, fall: 40, bdefend: 70,
          art: 'wave',
          colors: { core: [255, 252, 214], body: [246, 222, 138], edge: [176, 138, 52] },
        },
      },
    ],
  },
]

// ---------------------------------------------------------------- 姿态

const DOWN = (a) => [Math.sin(rad(a)), Math.cos(rad(a))]
const UP = (a) => [Math.sin(rad(a)), -Math.cos(rad(a))]

/** 姿势：角度均为“0 = 朝下，正 = 朝角色面向(+x)” */
function P(o = {}) {
  return {
    dx: 0,
    dy: 0,
    crouch: 0,
    rot: 0,
    pivot: null,
    piv_dy: 0,
    lean: 0,
    head: 0,
    arms: [
      [4, 8],
      [4, 8],
    ],
    legs: [
      [2, -2],
      [-2, -2],
    ],
    eyes: 'open',
    hair: 0,
    ...o,
  }
}

const lerp = (a, b, t) => a + (b - a) * t
const mix_pose = (a, b, t) => ({
  ...a,
  dx: lerp(a.dx, b.dx, t),
  dy: lerp(a.dy, b.dy, t),
  crouch: lerp(a.crouch, b.crouch, t),
  lean: lerp(a.lean, b.lean, t),
  head: lerp(a.head, b.head, t),
  arms: [
    [lerp(a.arms[0][0], b.arms[0][0], t), lerp(a.arms[0][1], b.arms[0][1], t)],
    [lerp(a.arms[1][0], b.arms[1][0], t), lerp(a.arms[1][1], b.arms[1][1], t)],
  ],
  legs: [
    [lerp(a.legs[0][0], b.legs[0][0], t), lerp(a.legs[0][1], b.legs[0][1], t)],
    [lerp(a.legs[1][0], b.legs[1][0], t), lerp(a.legs[1][1], b.legs[1][1], t)],
  ],
})

const WALK_KEYS = [
  { legs: [[20, -8], [-16, -14]], arms: [[-4, 66], [26, 82]], crouch: 0 },
  { legs: [[8, -6], [-6, -26]], arms: [[6, 70], [16, 86]], crouch: -1 },
  { legs: [[-6, -10], [8, -18]], arms: [[14, 74], [8, 88]], crouch: 0 },
  { legs: [[-16, -14], [20, -8]], arms: [[26, 82], [-4, 66]], crouch: 0 },
  { legs: [[-6, -26], [8, -6]], arms: [[16, 86], [6, 70]], crouch: -1 },
  { legs: [[8, -18], [-6, -10]], arms: [[8, 88], [14, 74]], crouch: 0 },
]

const RUN_KEYS = [
  { legs: [[40, -20], [-30, -40]], arms: [[-34, 60], [36, 74]], lean: 16, crouch: -1 },
  { legs: [[14, -60], [-4, -26]], arms: [[-16, 64], [22, 78]], lean: 20, crouch: -3 },
  { legs: [[-30, -40], [40, -20]], arms: [[36, 74], [-34, 60]], lean: 16, crouch: -1 },
  { legs: [[-4, -26], [14, -60]], arms: [[22, 78], [-16, 64]], lean: 20, crouch: -3 },
]

function walk_pose(i, carry = false) {
  const k = WALK_KEYS[i % 6]
  return P({
    legs: k.legs,
    arms: carry
      ? [
          [64, 26],
          [58, 30],
        ]
      : k.arms,
    crouch: k.crouch,
    lean: carry ? 8 : 3,
    head: -1,
  })
}

function run_pose(i, carry = false) {
  const k = RUN_KEYS[i % 4]
  return P({
    legs: k.legs,
    arms: carry
      ? [
          [70, 24],
          [64, 28],
        ]
      : k.arms,
    lean: carry ? 10 : k.lean,
    crouch: k.crouch,
    hair: i % 2,
  })
}

const STANCE = [[28, -14], [-24, -16]]
const GUARD = [[18, 102], [54, 82]]

const POSES = {
  idle0: P({ legs: STANCE, arms: GUARD }),
  idle1: P({ crouch: -1, lean: 1, head: -1, legs: STANCE, arms: [[26, 98], [40, 92]] }),
  idle2: P({ crouch: 0, lean: 2, head: 0, legs: STANCE, arms: [[29, 95], [43, 89]] }),
  idle3: P({ crouch: 1, lean: 0, head: 1, legs: STANCE, arms: [[30, 94], [44, 88]] }),

  brake: P({ lean: -8, crouch: 2, legs: [[-22, -10], [14, -6]], arms: [[-16, 80], [56, 66]] }),
  crouch: P({ crouch: 8, lean: 14, legs: [[34, -60], [-14, -46]], arms: [[34, 74], [66, 66]] }),
  jump_up: P({ crouch: 6, lean: 10, legs: [[28, -48], [-14, -36]], arms: [[-18, 52], [46, 62]] }),
  jump_apex: P({ dy: -6, lean: 2, legs: [[26, -70], [-26, -50]], arms: [[-26, 30], [62, 28]] }),
  jump_fall: P({ dy: -4, lean: -4, legs: [[16, -30], [-24, -20]], arms: [[-36, 24], [44, 26]] }),
  dash0: P({ lean: 24, crouch: 3, legs: [[-22, -14], [34, -12]], arms: [[-44, 40], [50, 60]] }),
  dash1: P({ lean: 30, crouch: 4, legs: [[-32, -18], [44, -14]], arms: [[-54, 46], [58, 54]] }),

  punch_wind: P({ lean: 4, legs: [[-16, -10], [18, -8]], arms: [[-16, 74], [8, 116]], head: -2 }),
  punch_hit: P({ lean: 12, dx: 2, legs: [[-20, -8], [24, -4]], arms: [[-26, 88], [94, 0]], eyes: 'angry' }),
  super_wind: P({ crouch: 4, lean: -10, legs: [[-22, -16], [14, -10]], arms: [[-40, 96], [4, 128]], eyes: 'angry' }),
  super_charge: P({ crouch: 2, lean: -4, legs: [[-18, -12], [18, -8]], arms: [[-32, 106], [28, 120]], eyes: 'angry' }),
  super_hit: P({ lean: 18, dx: 3, legs: [[-26, -10], [32, -4]], arms: [[-38, 84], [99, -4]], eyes: 'angry' }),

  jumpatk_wind: P({ dy: -6, lean: -6, legs: [[30, -54], [-18, -26]], arms: [[-28, 84], [30, 108]] }),
  jumpatk_hit: P({ dy: -6, lean: 8, legs: [[34, -44], [-22, -30]], arms: [[-34, 74], [92, 8]], eyes: 'angry' }),

  runatk0: P({ lean: 20, crouch: -1, legs: [[38, -26], [-26, -34]], arms: [[-40, 66], [30, 92]] }),
  runatk1: P({ lean: 22, dx: 1, legs: [[22, -18], [-14, -20]], arms: [[-30, 72], [90, 4]], eyes: 'angry' }),
  runatk2: P({ lean: 14, legs: [[-18, -22], [30, -12]], arms: [[-20, 76], [62, 32]] }),

  dashatk0: P({ lean: 26, legs: [[-28, -16], [38, -10]], arms: [[-46, 44], [40, 74]] }),
  dashatk1: P({ lean: 32, dx: 3, legs: [[-34, -12], [48, -6]], arms: [[-54, 50], [97, 2]], eyes: 'angry' }),

  dashdef: P({ lean: 14, crouch: 3, legs: [[-20, -18], [26, -12]], arms: [[-4, 112], [42, 104]] }),
  defend: P({ lean: -4, crouch: 2, legs: STANCE, arms: [[4, 122], [36, 116]] }),
  defend2: P({ lean: -2, crouch: 2, legs: STANCE, arms: [[6, 120], [38, 114]] }),
  broken0: P({ lean: -14, crouch: 4, legs: [[-24, -14], [18, -10]], arms: [[-30, 66], [58, 62]], eyes: 'hurt' }),
  broken1: P({ lean: -18, dx: -2, crouch: 5, legs: [[-28, -12], [16, -8]], arms: [[-36, 54], [64, 52]], eyes: 'hurt' }),

  pick: P({ crouch: 9, lean: 20, legs: [[32, -58], [-10, -42]], arms: [[46, 74], [76, 54]] }),
  catch0: P({ lean: 8, legs: [[-14, -10], [16, -8]], arms: [[38, 66], [82, 40]] }),
  hold: P({ lean: 4, legs: [[-14, -10], [16, -8]], arms: [[46, 104], [62, 100]] }),
  caught: P({ rot: -90, piv_dy: -10, dx: 25, dy: 0, lean: 6, legs: [[-14, -22], [18, -26]], arms: [[-26, 18], [-6, 26]], eyes: 'hurt' }),

  throw_wind: P({ lean: -8, legs: [[-16, -12], [18, -10]], arms: [[-16, 122], [24, 132]] }),
  throw_release: P({ lean: 10, arms: [[-18, 74], [64, 40]], legs: [[-18, -10], [22, -8]] }),
  throw_follow: P({ lean: 16, arms: [[-4, 88], [80, 28]], legs: [[-20, -8], [26, -6]], eyes: 'angry' }),
  throw_hold: P({ lean: 4, arms: [[32, 108], [60, 96]], legs: STANCE }),
  throw_man: P({ lean: 14, arms: [[-6, 68], [90, 6]], legs: [[-22, -8], [28, -6]], eyes: 'angry' }),
  drink0: P({ lean: -2, arms: [[22, 108], [44, 112]] }),
  drink1: P({ lean: -8, head: -8, arms: [[26, 132], [46, 136]], eyes: 'closed' }),
  drink2: P({ lean: -6, head: -4, arms: [[24, 122], [44, 126]], eyes: 'closed' }),

  row0: P({ lean: 14, crouch: 3, legs: [[-30, -18], [34, -10]], arms: [[-44, 66], [56, 44]] }),
  row1: P({ lean: 16, crouch: 4, legs: [[-34, -14], [38, -8]], arms: [[-20, 84], [68, 60]] }),
  row2: P({ lean: 12, crouch: 2, legs: [[-24, -20], [28, -14]], arms: [[-52, 56], [46, 34]] }),
  row3: P({ lean: 18, crouch: 4, legs: [[-36, -12], [40, -6]], arms: [[-12, 90], [74, 68]] }),
  row4: P({ lean: 10, crouch: 2, legs: [[-20, -22], [24, -16]], arms: [[-46, 60], [42, 38]] }),

  tired: P({ lean: 16, crouch: 8, legs: [[20, -34], [-16, -26]], arms: [[16, 62], [28, 60]], eyes: 'closed' }),

  hurt0a: P({ lean: -8, dx: -2, legs: [[-18, -12], [14, -8]], arms: [[-14, 48], [26, 54]], eyes: 'hurt' }),
  hurt0b: P({ lean: -8, dx: -1, legs: [[-14, -10], [12, -8]], arms: [[-18, 60], [26, 66]], eyes: 'hurt' }),
  hurt1a: P({ lean: -20, dx: -3, crouch: 2, legs: [[-26, -14], [20, -10]], arms: [[-34, 48], [42, 54]], eyes: 'hurt' }),
  hurt1b: P({ lean: -12, dx: -1, legs: [[-16, -12], [14, -8]], arms: [[-22, 56], [30, 60]], eyes: 'hurt' }),
  hurt2a: P({ lean: 12, crouch: 6, legs: [[12, -28], [-8, -20]], arms: [[24, 84], [38, 88]], eyes: 'hurt' }),
  hurt2b: P({ lean: 6, crouch: 3, legs: [[6, -16], [-4, -12]], arms: [[16, 74], [28, 78]], eyes: 'hurt' }),

  dizzy0: P({ lean: -6, head: -8, arms: [[-4, 44], [20, 50]], legs: [[-8, -6], [8, -6]], eyes: 'closed' }),
  dizzy1: P({ lean: 6, head: 8, arms: [[6, 40], [26, 46]], legs: [[-6, -4], [6, -4]], eyes: 'closed' }),
  dizzy2: P({ lean: 8, head: 6, arms: [[10, 36], [30, 42]], legs: [[-4, -4], [4, -4]], eyes: 'closed' }),
  dizzy3: P({ lean: -2, head: -2, arms: [[0, 42], [22, 48]], legs: [[-6, -6], [6, -6]], eyes: 'closed' }),

  fall0: P({ rot: -18, lean: -16, legs: [[-26, -20], [30, -26]], arms: [[-52, 40], [-20, 46]], eyes: 'hurt' }),
  fall1: P({ rot: -44, piv_dy: -4, lean: -12, legs: [[-34, -28], [38, -30]], arms: [[-62, 30], [-30, 40]], eyes: 'hurt' }),
  fall2: P({ rot: -68, piv_dy: -7, lean: -8, legs: [[-30, -34], [34, -36]], arms: [[-66, 20], [-38, 30]], eyes: 'hurt' }),
  fall3: P({ rot: -84, piv_dy: -9, dx: 21, dy: -2, lean: -6, legs: [[-18, -30], [26, -34]], arms: [[-56, 14], [-34, 22]], eyes: 'hurt' }),
  fall4: P({ rot: -88, piv_dy: -10, dx: 23, dy: 1, lean: -2, legs: [[-10, -22], [18, -26]], arms: [[-48, 10], [-28, 16]], eyes: 'hurt' }),
  fall5: P({ rot: -90, piv_dy: -10, dx: 25, dy: 2, lean: 0, legs: [[-6, -16], [12, -20]], arms: [[-42, 8], [-24, 12]], eyes: 'hurt' }),

  lying_back: P({ rot: -90, piv_dy: -10, dx: 25, dy: 2, lean: 0, legs: [[-4, -12], [8, -14]], arms: [[-36, 6], [-20, 10]], eyes: 'closed' }),
  lying_front: P({ rot: -90, piv_dy: -10, dx: 25, dy: 2, lean: -4, legs: [[6, -18], [-6, -10]], arms: [[-40, 10], [-16, 14]], eyes: 'closed' }),

  ice: P({ lean: -2, arms: [[-8, 40], [22, 36]], legs: [[-8, -6], [8, -6]], eyes: 'closed' }),
  fire0: P({ lean: -8, arms: [[-16, 52], [30, 58]], legs: [[-12, -8], [14, -10]], eyes: 'hurt' }),
  fire1: P({ lean: 8, arms: [[-8, 46], [36, 50]], legs: [[-14, -10], [10, -8]], eyes: 'hurt' }),

  // 持械动作（手持 LF2 武器时使用）
  wpn_wind: P({ lean: -6, legs: [[-14, -10], [16, -8]], arms: [[-14, 96], [6, 118]] }),
  wpn_swing1: P({ lean: 10, arms: [[-8, 76], [66, 22]] }),
  wpn_swing2: P({ lean: 14, arms: [[-6, 64], [92, 8]] }),
  wpn_swing3: P({ lean: 12, arms: [[-4, 54], [78, 42]] }),
  wpn_recover: P({ lean: 4, arms: [[-10, 78], [42, 62]] }),
  wpn_wind2: P({ lean: -10, arms: [[-18, 106], [0, 124]] }),
  wpn_swing4: P({ lean: 18, dx: 2, arms: [[-2, 52], [98, 14]] }),
  jump_wpn0: P({ dy: -6, lean: -4, legs: [[30, -50], [-18, -28]], arms: [[-16, 88], [0, 104]] }),
  jump_wpn1: P({ dy: -6, lean: 10, legs: [[34, -42], [-22, -26]], arms: [[-8, 74], [78, 22]] }),
  run_wpn0: P({ lean: 20, legs: [[36, -24], [-24, -30]], arms: [[-20, 76], [2, 94]] }),
  run_wpn1: P({ lean: 22, legs: [[22, -16], [-12, -18]], arms: [[-12, 66], [72, 24]] }),
  run_wpn2: P({ lean: 14, legs: [[-18, -20], [28, -12]], arms: [[-8, 62], [54, 42]] }),
  dash_wpn0: P({ lean: 26, legs: [[-26, -16], [38, -10]], arms: [[-30, 66], [0, 92]] }),
  dash_wpn1: P({ lean: 30, dx: 3, legs: [[-32, -12], [48, -6]], arms: [[-24, 56], [90, 18]] }),
}

const ID_POSE = {
  0: 'idle0', 1: 'idle1', 2: 'idle2', 3: 'idle3',
  19: 'brake',
  20: 'wpn_wind', 21: 'wpn_swing1', 22: 'wpn_swing2', 23: 'wpn_recover',
  25: 'wpn_wind2', 26: 'wpn_swing1', 27: 'wpn_swing4', 28: 'wpn_recover',
  30: 'jump_wpn0', 31: 'jump_wpn1',
  35: 'run_wpn0', 36: 'run_wpn1', 37: 'run_wpn2',
  40: 'dash_wpn0', 41: 'dash_wpn1',
  45: 'throw_wind', 46: 'throw_release', 47: 'throw_follow',
  50: 'throw_wind', 51: 'throw_follow',
  52: 'throw_wind', 53: 'throw_release', 54: 'throw_follow',
  55: 'drink0', 56: 'drink1', 57: 'drink2', 58: 'drink1',
  60: 'punch_wind', 61: 'punch_hit', 65: 'punch_wind', 66: 'punch_hit',
  70: 'super_wind', 71: 'super_charge', 72: 'super_hit',
  80: 'jumpatk_wind', 81: 'jumpatk_hit',
  85: 'runatk0', 86: 'runatk1', 87: 'runatk2',
  90: 'dashatk0', 91: 'dashatk1', 95: 'dashdef',
  100: 'row0', 101: 'row1', 102: 'row2', 103: 'row3', 104: 'row4',
  105: 'row0', 106: 'row1', 107: 'row2', 108: 'row3', 109: 'row4',
  110: 'defend', 111: 'defend2',
  112: 'broken0', 113: 'broken1', 114: 'broken0',
  115: 'pick', 116: 'pick', 117: 'pick',
  120: 'catch0', 121: 'hold', 122: 'hold', 123: 'hold',
  180: 'fall0', 181: 'fall1', 182: 'fall2', 183: 'fall3', 184: 'fall4', 185: 'fall5',
  186: 'fall0', 187: 'fall1', 188: 'fall2', 189: 'fall3', 190: 'fall4', 191: 'fall5',
  200: 'ice', 201: 'ice', 202: 'ice',
  203: 'fire0', 204: 'fire1', 205: 'fire0', 206: 'fire1',
  207: 'tired',
  210: 'jump_up', 211: 'jump_apex', 212: 'jump_fall',
  213: 'dash0', 214: 'dash1', 215: 'crouch', 216: 'dash1', 217: 'dash1', 218: 'brake', 219: 'crouch',
  220: 'hurt0a', 221: 'hurt0b', 222: 'hurt1a', 223: 'hurt1b', 224: 'hurt2a', 225: 'hurt2b',
  226: 'dizzy0', 227: 'dizzy1', 228: 'dizzy2', 229: 'dizzy3',
  230: 'lying_back', 231: 'lying_front',
  232: 'throw_hold', 233: 'throw_man', 234: 'throw_man',
  399: 'idle0',
}

function frame_pose(frame) {
  const id = frame.id
  if (/^\d+$/.test(id)) {
    const n = Number(id)
    if (ID_POSE[n]) {
      const p = POSES[ID_POSE[n]]
      if (p) {
        // 同名称帧做细微错帧，避免完全静止
        if (ID_POSE[n] === 'ice') return mix_pose(POSES.ice, POSES.dizzy1, (n - 200) * 0.35)
        if (ID_POSE[n] === 'finished') return p
        return p
      }
    }
    if (n >= 130 && n <= 144) return POSES.caught
    return POSES.idle0
  }
  if (id.startsWith('walking_')) return walk_pose(Number(id.split('_').pop()))
  if (id.startsWith('running_')) return run_pose(Number(id.split('_').pop()))
  if (id.startsWith('heavy_obj_walk_')) return walk_pose(Number(id.split('_').pop()), true)
  if (id.startsWith('heavy_obj_run_')) return run_pose(Number(id.split('_').pop()), true)
  return POSES.idle0
}

// ---------------------------------------------------------------- 绘制人物

const pick = (rampObj, s) => (s < -0.34 ? rampObj.light : s > 0.36 ? rampObj.shade : rampObj.base)

function draw_limb(g, ax, ay, bx, by, r, rampObj) {
  g.capsule(ax, ay, bx, by, r + 0.9, OUTLINE)
  g.capsule(ax, ay, bx, by, r, (x, y, s) => pick(rampObj, s))
}

const darken = (c, k) => c.map((v) => Math.round(clamp(v * k, 0, 255)))

function draw_figure(g, char, pose, ox, oy) {
  const B = char.build
  const pal = char.palette
  const s = B.scale
  const row = s // 统一缩放因子
  const hipX = CX + pose.dx
  const hipY = FOOT_Y - B.legLen * row + pose.crouch + pose.dy

  const up = UP(pose.lean)
  const perp = [Math.cos(rad(pose.lean)), Math.sin(rad(pose.lean))]
  const neck = [hipX + up[0] * B.torso * row, hipY + up[1] * B.torso * row]
  const headUp = UP(pose.lean + pose.head)
  const headC = [neck[0] + headUp[0] * (B.headR + 3) * row, neck[1] + headUp[1] * (B.headR + 3) * row]

  // 肩：在垂直躯干方向上前后来开，正视裁剪下两条手臂都能被看到
  const shoulders = [
    [neck[0] - perp[0] * B.shoulder * 0.55, neck[1] - perp[1] * B.shoulder * 0.55 + 1],
    [neck[0] + perp[0] * B.shoulder * 0.55, neck[1] + perp[1] * B.shoulder * 0.55 + 2],
  ]
  const hips = [
    [hipX - perp[0] * (B.hipW * 0.5), hipY - perp[1] * (B.hipW * 0.5)],
    [hipX + perp[0] * (B.hipW * 0.5), hipY + perp[1] * (B.hipW * 0.5)],
  ]

  const armPts = pose.arms.map(([ua, la], i) => {
    const a0 = ua + pose.lean
    const e = [shoulders[i][0] + DOWN(a0)[0] * B.upperArm * row, shoulders[i][1] + DOWN(a0)[1] * B.upperArm * row]
    const a1 = a0 + la
    const h = [e[0] + DOWN(a1)[0] * B.foreArm * row, e[1] + DOWN(a1)[1] * B.foreArm * row]
    return { shoulder: shoulders[i], elbow: e, hand: h, angle: a1 }
  })
  const legPts = pose.legs.map(([th, sh], i) => {
    const k = [hips[i][0] + DOWN(th)[0] * B.thigh * row, hips[i][1] + DOWN(th)[1] * B.thigh * row]
    const f = [k[0] + DOWN(th + sh)[0] * B.shin * row, k[1] + DOWN(th + sh)[1] * B.shin * row]
    return { hip: hips[i], knee: k, foot: f, angle: th + sh }
  })

  // 整体旋转（倒地、被击飞等）
  const piv = pose.pivot ?? [hipX, FOOT_Y + pose.piv_dy]
  const rot = rad(pose.rot)
  const cr = Math.cos(rot)
  const sr = Math.sin(rot)
  const T = (p) => {
    const dx = p[0] - piv[0]
    const dy = p[1] - piv[1]
    return [piv[0] + dx * cr - dy * sr + ox, piv[1] + dx * sr + dy * cr + oy]
  }

  const hipT = T([hipX, hipY])
  const neckT = T(neck)
  const headT = T(headC)
  const legsT = legPts.map((l) => ({ hip: T(l.hip), knee: T(l.knee), foot: T(l.foot), angle: l.angle + pose.rot }))
  const armsT = armPts.map((a) => ({ shoulder: T(a.shoulder), elbow: T(a.elbow), hand: T(a.hand), angle: a.angle + pose.rot }))
  const [backLeg, frontLeg] = legsT
  const [backArm, frontArm] = armsT

  const leg = (l, back) => {
    const cloth = back ? { base: darken(pal.cloth.base, 0.72), light: pal.cloth.base, shade: darken(pal.cloth.shade, 0.8) } : pal.cloth
    const boot = back ? { base: darken(pal.boot.base, 0.75), light: pal.boot.base, shade: darken(pal.boot.shade, 0.8) } : pal.boot
    draw_limb(g, l.hip[0], l.hip[1], l.knee[0], l.knee[1], B.legR * row, cloth)
    draw_limb(g, l.knee[0], l.knee[1], l.foot[0], l.foot[1], B.legR * 0.88 * row, boot)
    // 脚掌：垂直于小腿、朝角色面向伸出
    const fa = rad(l.angle)
    const fx = Math.cos(fa)
    const fy = -Math.sin(fa)
    g.capsule(
      l.foot[0] - fx * 1.6,
      l.foot[1] - fy * 1.6,
      l.foot[0] + fx * 3.2,
      l.foot[1] + fy * 3.2 + 0.8,
      B.legR * 0.72 * row,
      (x, y, sd) => pick(boot, sd),
    )
  }

  const arm = (a, back) => {
    const sleeve = back
      ? { base: darken(pal.cloth.base, 0.74), light: pal.cloth.base, shade: darken(pal.cloth.shade, 0.8) }
      : pal.cloth
    const skin = back ? { base: darken(pal.skin.base, 0.82), light: pal.skin.base, shade: darken(pal.skin.shade, 0.85) } : pal.skin
    const glove = back ? { base: darken(pal.glove.base, 0.78), light: pal.glove.base, shade: darken(pal.glove.shade, 0.85) } : pal.glove
    draw_limb(g, a.shoulder[0], a.shoulder[1], a.elbow[0], a.elbow[1], B.armR * row, sleeve)
    draw_limb(g, a.elbow[0], a.elbow[1], a.hand[0], a.hand[1], B.armR * 0.9 * row, skin)
    g.disc(a.hand[0], a.hand[1], B.armR * 1.02 * row, (x, y, sd) => pick(glove, sd))
  }

  leg(backLeg, true)
  arm(backArm, true)

  // 长发/披风：在身体后面铺一层
  if (char.hair === 'long') {
    const sway = (pose.hair - 0.5) * 2.4
    g.poly(
      [
        [neckT[0] - 3.2, neckT[1] + 2],
        [hipT[0] - 5.4 - sway, hipT[1] + 10],
        [hipT[0] - 1.2 - sway, hipT[1] + 14],
        [hipT[0] + 4.6, hipT[1] + 2],
      ],
      (x, y) => (x < (neckT[0] + hipT[0]) / 2 ? pal.cloth.shade : pal.cloth.base),
    )
  }

  // 躯干：肩宽 → 腰窄的梯形
  const shTop = [neck[0] + up[0] * 2, neck[1] + up[1] * 2]
  const shoulderW = B.shoulder
  const waistW = B.hipW * 0.9
  let torso = [
    [shTop[0] - perp[0] * shoulderW, shTop[1] - perp[1] * shoulderW],
    [shTop[0] + perp[0] * shoulderW, shTop[1] + perp[1] * shoulderW],
    [hipT[0] + perp[0] * waistW, hipT[1] + perp[1] * waistW],
    [hipT[0] - perp[0] * waistW, hipT[1] - perp[1] * waistW],
  ].map(T)
  g.poly(torso, (x, y) => {
    const midX = (neckT[0] + hipT[0]) / 2
    const t = clamp((y - neckT[1]) / Math.max(1, hipT[1] - neckT[1]), 0, 1)
    if (x > midX + shoulderW * 0.35) return pal.cloth.shade
    if (x < midX - shoulderW * 0.1) return t < 0.5 ? pal.cloth.light : pal.cloth.base
    return pal.cloth.base
  })
  // 领口 / 腰带
  g.poly(
    [
      [shTop[0] - perp[0] * shoulderW * 0.55, shTop[1] - perp[1] * shoulderW * 0.55 + 1],
      [shTop[0] + perp[0] * shoulderW * 0.55, shTop[1] + perp[1] * shoulderW * 0.55 + 1],
      [shTop[0] + perp[0] * shoulderW * 0.4, shTop[1] + perp[1] * shoulderW * 0.4 + 3],
      [shTop[0] - perp[0] * shoulderW * 0.4, shTop[1] - perp[1] * shoulderW * 0.4 + 3],
    ].map(T),
    pal.trim.base,
  )
  g.poly(
    [
      [hipT[0] - perp[0] * waistW * 1.05, hipT[1] - perp[1] * waistW * 1.05 - 1],
      [hipT[0] + perp[0] * waistW * 1.05, hipT[1] + perp[1] * waistW * 1.05 - 1],
      [hipT[0] + perp[0] * waistW * 1.05, hipT[1] + perp[1] * waistW * 1.05 + 2],
      [hipT[0] - perp[0] * waistW * 1.05, hipT[1] - perp[1] * waistW * 1.05 + 2],
    ].map(T),
    pal.trim.base,
  )

  leg(frontLeg, false)

  const hr = B.headR * row
  const hx = headT[0]
  const hy = headT[1]
  // 脖子
  g.capsule(neckT[0], neckT[1] + 1, hx, hy + hr * 0.5, 2.6 * row, (x, y, sd) => pick(pal.skin, sd))
  draw_head(g, char, hx, hy, hr, pose, pose.rot)

  arm(frontArm, false)

  draw_hair_front(g, char, hx, hy, hr, pose, pose.rot)
}

function draw_head(g, char, hx, hy, hr, pose, rot = 0) {
  const pal = char.palette
  const cr = Math.cos(rad(rot))
  const sr = Math.sin(rad(rot))
  const rotv = (dx, dy) => [dx * cr - dy * sr, dx * sr + dy * cr]

  g.disc(hx, hy, hr + 0.8, OUTLINE)
  g.disc(hx, hy, hr, (x, y, s) => pick(pal.skin, s))
  // 耳朵（在脑后）
  const ear = rotv(-hr * 0.8, hr * 0.1)
  g.disc(hx + ear[0], hy + ear[1], hr * 0.26, (x, y, sd) => pick(pal.skin, sd + 0.5))

  // 五官（局部坐标：+x 为面向）
  const ex0 = hr * 0.42
  const ey0 = hr * 0.12
  const eye = rotv(ex0, ey0)
  const acc = rotv(1.7, -0.8)
  const ex = Math.round(hx + eye[0])
  const ey = Math.round(hy + eye[1])
  if (pose.eyes === 'closed') {
    for (const [dx, dy] of [[-1.2, -0.6], [0, 0], [1.1, 0.5]]) {
      const p = rotv(dx, dy)
      g.set(ex + p[0], ey + p[1], OUTLINE)
    }
  } else if (pose.eyes === 'hurt') {
    for (const [dx, dy] of [[-1.2, -1], [0, 0.2], [1.1, -0.9]]) {
      const p = rotv(dx, dy)
      g.set(ex + p[0], ey + p[1], OUTLINE)
    }
  } else {
    for (const [dx, dy] of [[0, -0.7], [1.3, -0.7], [0, 0.5], [1.3, 0.5]]) {
      const p = rotv(dx, dy)
      g.set(ex + p[0], ey + p[1], OUTLINE)
    }
    g.set(ex + acc[0], ey + acc[1], pal.accent)
  }
  if (pose.eyes === 'angry') {
    for (const [dx, dy] of [[-1, -2.4], [0.2, -2.1], [1.4, -1.8]]) {
      const p = rotv(dx, dy)
      g.set(ex + p[0], ey + p[1], OUTLINE)
    }
  }
  // 嘴
  const mouth = rotv(hr * 0.42, hr * 0.58)
  const mx = Math.round(hx + mouth[0])
  const my = Math.round(hy + mouth[1])
  const m1 = rotv(1, 0)
  g.set(mx, my, OUTLINE)
  g.set(mx + m1[0], my + m1[1], OUTLINE)
}

function draw_hair_front(g, char, hx, hy, hr, pose, rot = 0) {
  const pal = char.palette
  const hair = pal.hair
  const cr = Math.cos(rad(rot))
  const sr = Math.sin(rad(rot))
  const rotv = (dx, dy) => [dx * cr - dy * sr, dx * sr + dy * cr]
  const local = (x, y) => {
    const dx = x - hx
    const dy = y - hy
    return [(dx * cr + dy * sr) / hr, (-dx * sr + dy * cr) / hr]
  }
  const fringe_at = (dx) => -0.2 + Math.max(0, -dx) * 0.95 + 0.1 * Math.sin(dx * 9 + 1.2)
  const hairPick = (x, y) => {
    const [dx, dy] = local(x, y)
    return pick(hair, dx + dy * 0.3)
  }

  // 后脑 + 发帽
  for (let y = Math.floor(hy - hr - 2); y <= Math.ceil(hy + hr + 2); y++) {
    for (let x = Math.floor(hx - hr - 2); x <= Math.ceil(hx + hr + 2); x++) {
      const [dx, dy] = local(x, y)
      if (dx * dx + dy * dy > 1.08) continue
      if (dy > fringe_at(dx)) continue
      g.set(x, y, hairPick(x, y))
    }
  }
  // 发际线
  for (let i = -Math.ceil(hr); i <= Math.ceil(hr); i++) {
    const dx = i / hr
    const p = rotv(dx * hr, fringe_at(dx) * hr)
    const x = Math.round(hx + p[0])
    const y = Math.round(hy + p[1])
    if (g.opaque(x, y)) g.set(x, y, OUTLINE)
  }

  if (char.hair === 'spiky') {
    // 三簇短尖
    for (const [dx, len] of [
      [-0.62, 1.28],
      [-0.15, 1.4],
      [0.32, 1.24],
    ]) {
      const a = rotv(dx * hr * 0.9, -hr * 0.82)
      const b = rotv(dx * hr * 1.02, -hr * len)
      g.capsule(hx + a[0], hy + a[1], hx + b[0], hy + b[1], hr * 0.24, hairPick)
    }
  } else if (char.hair === 'ponytail') {
    const sway = (pose.hair - 0.5) * 3.2
    const a = rotv(-hr * 0.85, -hr * 0.42)
    g.disc(hx + a[0], hy + a[1], hr * 0.28, pal.accent)
    const b = rotv(-hr * 0.95, -hr * 0.35)
    const c = rotv(-hr * 1.5, hr * 0.4)
    const d = rotv(-hr * 1.62 + sway, hr * 1.45)
    g.capsule(hx + b[0], hy + b[1], hx + c[0], hy + c[1], hr * 0.34, hairPick)
    g.capsule(hx + c[0], hy + c[1], hx + d[0], hy + d[1], hr * 0.27, hairPick)
  } else {
    const sway = (pose.hair - 0.5) * 2
    const a = rotv(-hr * 0.9, hr * 0.1)
    const b = rotv(-hr * 1.05 + sway, hr * 1.55)
    g.capsule(hx + a[0], hy + a[1], hx + b[0], hy + b[1], hr * 0.42, hairPick)
  }
}

// ---------------------------------------------------------------- 精灵表

function render_sheet(char, frames, tex) {
  const g = new Raster(SHEET_W, SHEET_H)
  const tmp = new Raster(CELL, CELL)
  // 多个帧可能共用同一个图片槽位（LF2 的复用），最后绘制的帧生效
  const drawn = new Set()
  for (const frame of frames) {
    const pic = frame.pic
    if (!pic || String(pic.tex) !== String(tex)) continue
    const ox = Math.round(pic.x / PITCH) * PITCH
    const oy = Math.round(pic.y / PITCH) * PITCH
    const slot = ox + ',' + oy
    if (drawn.has(slot)) continue
    drawn.add(slot)
    tmp.px.fill(0)
    draw_figure(tmp, char, frame_pose(frame), 0, 0)
    tmp.outline(OUTLINE)
    g.blit(tmp, ox, oy)
  }
  return g
}

/** 头像/缩略图共用的胸像绘制 */
function draw_bust(g, char, cx, cy, headR, w, h) {
  const pal = char.palette
  const skin = pal.skin
  const hair = pal.hair
  const hairPick = (x, y) => {
    const s = (x - cx) / headR + ((y - cy) / headR) * 0.25
    return pick(hair, s)
  }

  // ---- 后面的头发（长发/马尾）
  if (char.hair === 'long') {
    g.poly(
      [
        [cx - headR * 1.15, cy - headR * 0.3],
        [cx - headR * 1.45, h - 2],
        [cx + headR * 1.45, h - 2],
        [cx + headR * 1.15, cy - headR * 0.3],
      ],
      (x) => hairPick(x, cy),
    )
  } else if (char.hair === 'ponytail') {
    g.capsule(cx - headR * 0.95, cy - headR * 0.35, cx - headR * 1.75, cy + headR * 1.5, headR * 0.38, hairPick)
  }

  // ---- 肩 / 胸
  const shTop = cy + headR * 1.06
  g.poly(
    [
      [cx - w * 0.45, h],
      [cx + w * 0.45, h],
      [cx + headR * 1.28, shTop + headR * 0.28],
      [cx - headR * 1.28, shTop + headR * 0.28],
    ],
    (x) => (x > cx + headR * 0.35 ? pal.cloth.shade : pal.cloth.base),
  )
  // 领口
  g.poly(
    [
      [cx - headR * 0.95, shTop + headR * 0.16],
      [cx + headR * 0.95, shTop + headR * 0.16],
      [cx + headR * 0.62, shTop + headR * 0.46],
      [cx - headR * 0.62, shTop + headR * 0.46],
    ],
    pal.trim.base,
  )
  // ---- 脖子
  g.capsule(cx, cy + headR * 0.62, cx, shTop + headR * 0.2, headR * 0.3, (x, y, sd) => pick(skin, sd + 0.4))

  // ---- 脸
  g.disc(cx, cy, headR + 0.8, OUTLINE)
  g.disc(cx, cy, headR, (x, y, sd) => pick(skin, sd))
  // 下巴（弱化立体，避免像胡子）
  g.disc(cx, cy + headR * 0.26, headR * 0.62, (x, y, sd) => pick(skin, sd * 0.45))
  // 耳朵
  for (const sx of [-1, 1]) {
    g.disc(cx + sx * headR * 0.95, cy + headR * 0.12, headR * 0.16, (x, y, sd) => pick(skin, sd + 0.5))
  }

  // ---- 头发（帽 + 刘海）
  for (let y = Math.floor(cy - headR - headR * 0.5); y <= Math.ceil(cy + headR); y++) {
    for (let x = Math.floor(cx - headR - headR * 0.5); x <= Math.ceil(cx + headR + headR * 0.5); x++) {
      const dx = (x - cx) / headR
      const dy = (y - cy) / headR
      if (dx * dx + dy * dy > 1.12) continue
      const fringe = -0.18 + Math.max(0, -dx) * 0.75 + 0.06 * Math.sin(dx * 7 + 1.1) + (dx > 0.55 ? 0.18 : 0)
      if (dy > fringe) continue
      g.set(x, y, hairPick(x, y))
    }
  }
  // 发际线
  for (let x = Math.floor(cx - headR); x <= Math.ceil(cx + headR); x++) {
    const dx = (x - cx) / headR
    const fringe = -0.18 + Math.max(0, -dx) * 0.75 + 0.06 * Math.sin(dx * 7 + 1.1) + (dx > 0.55 ? 0.18 : 0)
    const y = Math.round(cy + fringe * headR)
    if (g.opaque(x, y)) g.set(x, y, OUTLINE)
  }
  // 发型细节
  if (char.hair === 'spiky') {
    for (const [dx, up, r] of [
      [-1.05, 0.9, 0.26],
      [-0.55, 1.25, 0.3],
      [0.0, 1.4, 0.32],
      [0.55, 1.2, 0.28],
      [1.0, 0.85, 0.24],
    ]) {
      g.capsule(cx + dx * headR, cy - headR * 0.72, cx + dx * headR * 0.85, cy - headR * up, headR * r, hairPick)
    }
  } else if (char.hair === 'ponytail') {
    g.disc(cx - headR * 0.95, cy - headR * 0.42, headR * 0.16, pal.accent)
  } else {
    // 长发：两鬓垂下
    for (const sx of [-1, 1]) {
      g.capsule(cx + sx * headR * 0.92, cy - headR * 0.1, cx + sx * headR * 1.12, cy + headR * 1.5, headR * 0.3, hairPick)
    }
  }
  // 高光
  g.capsule(cx - headR * 0.55, cy - headR * 0.78, cx + headR * 0.1, cy - headR * 0.9, headR * 0.12, hair.light)

  // ---- 五官
  const eyeY = cy + headR * 0.16
  const eyeDX = headR * 0.42
  const eyeW = Math.max(1, headR * 0.16)
  const eyeH = Math.max(1, headR * 0.2)
  for (const sx of [-1, 1]) {
    const x = Math.round(cx + sx * eyeDX)
    const y = Math.round(eyeY)
    // 眼白
    for (let i = -eyeW; i <= eyeW; i++) {
      for (let j = -eyeH * 0.6; j <= eyeH * 0.6; j++) g.set(x + i, y + j, [248, 246, 240])
    }
    // 瞳孔
    for (let i = -eyeW * 0.45; i <= eyeW * 0.45; i++) {
      for (let j = -eyeH * 0.55; j <= eyeH * 0.55; j++) g.set(x + i, y + j, OUTLINE)
    }
    g.set(x - sx * eyeW * 0.3, y - eyeH * 0.3, pal.accent)
    // 眉
    for (let i = -eyeW * 1.2; i <= eyeW * 1.2; i++) {
      const yy = y - eyeH * 1.6 - i * sx * 0.25
      g.set(x + i, yy, hair.shade)
    }
    // 睫毛（女性角色）
    if (char.feminine) {
      for (let i = 0; i <= eyeW * 1.6; i++) g.set(x + sx * i, y - eyeH * 0.75 - i * 0.15, OUTLINE)
      g.set(x + sx * eyeW * 1.7, y - eyeH * 0.95, OUTLINE)
    }
  }
  // 鼻
  g.set(cx + 1, cy + headR * 0.42, skin.shade)
  g.set(cx + 2, cy + headR * 0.5, skin.shade)
  // 嘴
  for (let i = -eyeW * 0.9; i <= eyeW * 0.9; i++) {
    g.set(cx + i, cy + headR * 0.66 + Math.abs(i) * 0.12, OUTLINE)
  }
}

function render_face(char) {
  const g = new Raster(FACE, FACE)
  draw_bust(g, char, FACE * 0.5, FACE * 0.4, FACE * 0.25, FACE, FACE)
  g.outline(OUTLINE)
  return g
}

/** 弹丸贴图：4 帧横向排列，全部程序化绘制 */
function draw_ball_frame(g, p, cx, cy, t) {
  const { core, body, edge } = p.colors
  const pulse = 1 + Math.sin(t * Math.PI * 2) * 0.08
  const r = BALL_CELL * 0.3 * pulse

  const glow = (rr, col, a) => {
    for (let y = Math.floor(cy - rr); y <= Math.ceil(cy + rr); y++) {
      for (let x = Math.floor(cx - rr); x <= Math.ceil(cx + rr); x++) {
        const d = Math.hypot(x - cx, y - cy)
        if (d > rr) continue
        g.blend(x, y, col, a * (1 - (d / rr) ** 2))
      }
    }
  }
  glow(r * 1.6, body, 0.22)

  if (p.art === 'quake') {
    // 岩块：随机感的多边形，随时间轻微旋转
    const rot = t * Math.PI * 0.5
    const pts = []
    const n = 7
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2
      const rr = r * (0.72 + 0.32 * Math.abs(Math.sin(i * 2.7 + 1)))
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9])
    }
    g.poly(pts, (x, y, sd) => pick({ base: body, light: core, shade: edge }, sd))
    g.poly(pts.map(([x, y]) => [cx + (x - cx) * 0.55 + 1, cy + (y - cy) * 0.55 - 1]), core)
    // 冲击尘环
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t
      g.set(cx - r * 1.15 + Math.cos(a) * r * 0.6, cy + 2 + Math.sin(a) * r * 0.4, edge)
    }
  } else {
    // 月牙刃：外圆减去前移的内圆
    const off = r * 0.55
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r - 2); x <= Math.ceil(cx + r + 2); x++) {
        const d1 = Math.hypot(x - cx, y - cy)
        const d2 = Math.hypot(x - (cx + off), y - cy)
        if (d1 > r || d2 < r * 0.72) continue
        const k = 1 - (d1 / r) * 0.55
        const col = k > 0.72 ? core : k > 0.42 ? body : edge
        g.set(x, y, col)
      }
    }
    // 拖尾
    for (let i = 1; i <= 3; i++) {
      const tx = cx - r * (0.7 + i * 0.42)
      const th = r * (0.42 - i * 0.09)
      if (th <= 0) break
      for (let y = Math.floor(cy - th); y <= Math.ceil(cy + th); y++) {
        for (let x = Math.floor(tx - th); x <= Math.ceil(tx + th); x++) {
          const d = Math.hypot(x - tx, y - cy) / th
          if (d > 1) continue
          g.blend(x, y, body, 0.5 / i * (1 - d * d))
        }
      }
    }
    // 高光
    g.set(cx + r * 0.15, cy - r * 0.5, core)
    g.set(cx + r * 0.05, cy + r * 0.5, core)
  }
}

function render_projectile(p) {
  const g = new Raster(BALL_CELL * p.frames, BALL_CELL)
  for (let i = 0; i < p.frames; i++) {
    draw_ball_frame(g, p, i * BALL_CELL + BALL_CELL / 2, BALL_CELL / 2, i / p.frames)
  }
  return g
}

function render_small(char) {
  const g = new Raster(SMALL_W, SMALL_H)
  draw_bust(g, char, SMALL_W * 0.5, SMALL_H * 0.41, SMALL_W * 0.26, SMALL_W, SMALL_H)
  g.outline(OUTLINE)
  return g
}

// ---------------------------------------------------------------- 角色数据

function clone(o) {
  return JSON.parse(JSON.stringify(o))
}

function make_data(template, char) {
  const d = clone(template)
  const dir = `characters/${char.id}/sprite`
  d.id = char.id
  d.base.name = char.name
  d.base.files = {
    0: { id: '0', path: `${dir}/0.png` },
    1: { id: '1', path: `${dir}/1.png` },
  }
  d.base.head = `${dir}/face.png`
  d.base.small = `${dir}/s.png`
  d.base.group = ['1000']
  d.base.ce = char.stats.ce
  d.base.hp_max = char.stats.hp_max
  d.base.mp_max = char.stats.mp_max
  d.base.jump_height = char.jump.height
  d.base.jump_distance = char.jump.distance
  d.base.jump_distancez = char.jump.distancez
  d.base.dash_height = -11
  d.base.dash_distance = 15 + (char.stats.run - 8)
  d.base.dash_distancez = 3.75
  d.base.rowing_height = -2
  d.base.rowing_distance = 5

  // 移动速度
  for (const id of Object.keys(d.frames)) {
    const f = d.frames[id]
    if (id.startsWith('walking_')) f.dvx = char.stats.walk
    else if (id.startsWith('running_')) f.dvx = char.stats.run
    else if (id.startsWith('heavy_obj_walk_')) f.dvx = Number((char.stats.walk * 0.75).toFixed(2))
    else if (id.startsWith('heavy_obj_run_')) f.dvx = Number((char.stats.run * 0.62).toFixed(2))
  }

  // 伤害 / 击退 / 攻击距离
  for (const id of Object.keys(d.frames)) {
    const f = d.frames[id]
    if (!f.itr) continue
    let k = 1
    if (f.name === 'punch' && char.tune.punch) k = char.tune.punch
    if (f.name === 'super_punch' && char.tune.super) k = char.tune.super
    if ((f.name === 'run_attack' || f.name === 'dash_attack') && char.tune.run) k = char.tune.run
    if (f.name === 'dash_attack' && char.tune.dash) k = char.tune.dash
    for (const itr of f.itr) {
      if (itr.kind !== 0) continue
      if (k !== 1) {
        itr.injury = Math.round(itr.injury * k)
        if (itr.dvx) itr.dvx = Number((itr.dvx * (0.9 + 0.1 * char.stats.knock)).toFixed(2))
      }
      if (char.tune.reach) itr.w = Math.round(itr.w * char.tune.reach)
    }
  }

  // 专属招式：防御 + 方向 + 攻击
  const standing = d.frames['0']
  standing.seqs = {}
  for (const sp of char.specials) {
    standing.seqs[sp.key] = { id: sp.enter, mp: sp.mp }
    for (const spec of sp.frames ?? []) {
      d.frames[spec.id] = make_special_frame(d.frames, spec)
    }
  }
  return d
}

const BUILTIN_FRAME_IDS = new Set(['auto', 'gone', ''])

/** 校验帧引用、图片槽位，避免生成出“进战斗就报错”的数据 */
function validate_data(char, data) {
  const ids = new Set(Object.keys(data.frames))
  const errors = []
  const check_id = (id, where) => {
    if (typeof id !== 'string') return
    if (BUILTIN_FRAME_IDS.has(id)) return
    if (!ids.has(id)) errors.push(`${where}: 未知帧 "${id}"`)
  }
  const check_next = (nf, where) => {
    if (!nf) return
    for (const n of Array.isArray(nf) ? nf : [nf]) {
      if (!n) continue
      if (Array.isArray(n.id)) n.id.forEach((i) => check_id(i, where))
      else check_id(n.id, where)
    }
  }
  for (const [fid, f] of Object.entries(data.frames)) {
    if (!f.pic) errors.push(`${fid}: 缺少 pic`)
    else {
      if (!data.base.files[f.pic.tex]) errors.push(`${fid}: 图片 "${f.pic.tex}" 不存在`)
      if (f.pic.x % PITCH || f.pic.y % PITCH) errors.push(`${fid}: 图片坐标不在格点上`)
      if (f.pic.w > CELL || f.pic.h > CELL) errors.push(`${fid}: 图片尺寸超出单元格`)
    }
    check_next(f.next, `${fid}.next`)
    for (const key of ['hit', 'hold', 'key_down', 'seqs', 'pre_hitkeys', 'post_hitkeys']) {
      const map = f[key]
      if (!map) continue
      for (const [k, nf] of Object.entries(map)) check_next(nf, `${fid}.${key}.${k}`)
    }
  }
  const walk_index = (v, where) => {
    if (v == null) return
    if (typeof v === 'string') return check_id(v, where)
    if (Array.isArray(v)) return v.forEach((i) => walk_index(i, where))
    for (const [k, i] of Object.entries(v)) walk_index(i, `${where}.${k}`)
  }
  for (const [k, v] of Object.entries(data.indexes ?? {})) walk_index(v, `indexes.${k}`)
  for (const sp of char.specials) {
    if (!ids.has(sp.enter)) errors.push(`专属招式帧 "${sp.enter}" 不存在`)
    for (const spec of sp.frames ?? [])
      if (!ids.has(spec.from)) errors.push(`招式帧 ${spec.id} 的模板帧 "${spec.from}" 不存在`)
  }
  if (errors.length) throw new Error(`[${char.id}] 数据校验失败:\n  ` + errors.join('\n  '))
}

const FRAME_KEYS_TO_DROP = [
  'hit', 'hold', 'key_down', 'key_up', 'seqs', 'pre_hitkeys', 'post_hitkeys', 'broadcasts',
]

/** 以现有帧为骨架，生成专属招式的帧 */
function make_special_frame(frames, spec) {
  const base = clone(frames[spec.from])
  if (!base) throw new Error(`招式帧模板 "${spec.from}" 不存在`)
  base.id = spec.id
  for (const k of FRAME_KEYS_TO_DROP) delete base[k]
  base.wait = spec.wait
  base.next = { id: spec.next }
  if (spec.itr !== undefined) {
    if (spec.itr.length) base.itr = clone(spec.itr)
    else delete base.itr
  }
  if (spec.opoint) {
    base.opoint = spec.opoint.map((o) => ({
      kind: 1,
      oid: o.oid,
      x: o.x,
      y: o.y,
      z: -6,
      action: { id: '0' },
      dvx: o.dvx ?? 0,
      dvy: o.dvy ?? 0,
      dvz: 0,
    }))
  } else {
    delete base.opoint
  }
  if (spec.invulnerable) base.invulnerable = spec.invulnerable
  if (spec.dvx != null) base.dvx = spec.dvx
  if (spec.dvy != null) base.dvy = spec.dvy
  return base
}

/** 弹丸（type 32）数据 */
function make_projectile_data(char, p) {
  const half = BALL_CELL / 2
  const itr = {
    kind: 0,
    kind_name: 'ItrKind.Normal',
    x: 6,
    y: 12,
    w: BALL_CELL - 12,
    h: BALL_CELL - 24,
    injury: p.injury,
    hit_flag: 61,
    dvx: p.hit_dvx,
    fall: p.fall,
    bdefend: p.bdefend,
    l: 24,
    z: -8,
  }
  const frames = {}
  for (let i = 0; i < p.frames; i++) {
    frames[String(i)] = {
      id: String(i),
      name: 'flying',
      pic: { tex: '0', x: i * BALL_CELL, y: 0, w: BALL_CELL, h: BALL_CELL },
      wait: 3,
      next: { id: String((i + 1) % p.frames) },
      state: 3000,
      state_name: 'StateEnum.Ball_Flying',
      centerx: half,
      centery: half,
      no_shadow: 1,
      itr: [clone(itr)],
      dvx: p.dvx,
    }
  }
  // 10 = 命中 / 20 = 撞到边界 / 30 = 被弹开：都短暂闪烁后消失
  for (const id of ['10', '20', '30']) {
    frames[id] = {
      id,
      name: id === '10' ? 'hitting' : 'disappearing',
      pic: { tex: '0', x: 0, y: 0, w: BALL_CELL, h: BALL_CELL },
      wait: 2,
      next: { id: 'gone' },
      state: 15,
      state_name: 'StateEnum.Normal',
      centerx: half,
      centery: half,
      no_shadow: 1,
    }
  }
  return {
    id: p.id,
    type: 32,
    base: {
      name: p.name,
      files: { 0: { id: '0', path: `characters/${char.id}/sprite/${p.id}.png` } },
      hp_max: 500,
    },
    frames,
  }
}

/** 招式表（游戏内 Move List 页面用） */
function make_moves_data(char) {
  return {
    oid: char.id,
    start_delay: 500,
    end_delay: 1600,
    moves: char.specials.map((sp) => ({
      name: sp.i18n,
      keys: sp.keys,
      seq: [
        { time: 0, keydowns: sp.demo },
        { time: 120, keyups: sp.demo },
      ],
      mp: sp.mp,
      dx: sp.dx ?? -100,
      entities: [{ oid: '30', dx: 130 }],
    })),
  }
}

function make_index(char) {
  const objects = [
    {
      id: char.id,
      type: '0',
      file: `characters/${char.id}/${char.id}.obj.json5`,
    },
  ]
  for (const sp of char.specials) {
    if (!sp.projectile) continue
    objects.push({
      id: sp.projectile.id,
      type: '0',
      file: `characters/${char.id}/${sp.projectile.id}.obj.json5`,
    })
  }
  return { objects }
}

function make_readme(char) {
  return `# ${char.name}（${char.title}）

${char.desc}

## 数据

- 角色数据：\`${char.id}.obj.json5\`
- 精灵图：\`sprite/0.png\`、\`sprite/1.png\`（79x79 格，10 列 x 7 行，80px 步距）
- 头像：\`sprite/face.png\`（120x120）、\`sprite/s.png\`（40x45）\n${char.specials.filter((sp) => sp.projectile).map((sp) => `- 弹丸数据：\`${sp.projectile.id}.obj.json5\`，贴图 \`sprite/${sp.projectile.id}.png\``).join('\n')}

## 数值

| 项目 | 值 |
| --- | --- |
| HP | ${char.stats.hp_max} |
| MP | ${char.stats.mp_max} |
| 行走速度 | ${char.stats.walk} |
| 奔跑速度 | ${char.stats.run} |
| 强度(ce) | ${char.stats.ce} |

## 招式

| 招式 | 输入 | 消耗 | 说明 |
| --- | --- | --- | --- |
${char.specials.map((sp) => `| ${sp.zh}（${sp.en}） | ${sp.keys} | ${sp.mp} MP | ${sp.projectile ? '发射弹丸' : '近身判定'} |`).join('\n')}

输入里的 **D** 是防御键，方向按角色朝向理解（\`>\` 为前方）。数据里对应的按键序列：\`${char.specials.map((sp) => sp.key).join(' / ')}\`。

## 来源

精灵图与数据均由 \`scripts/gen-fighters.mjs\` 程序化生成，不使用任何第三方素材。
修改外观/数值请改脚本后重新运行：

\`\`\`bash
node scripts/gen-fighters.mjs ${char.id}
npm run build:data
\`\`\`
`
}

// ---------------------------------------------------------------- 主流程

function generate(char, template) {
  const dir = join(CHAR_ROOT, char.id)
  const sprite_dir = join(dir, 'sprite')
  mkdirSync(sprite_dir, { recursive: true })

  const data = make_data(template, char)
  validate_data(char, data)
  const frames = Object.values(data.frames)

  writeFileSync(join(sprite_dir, '0.png'), encode_png(SHEET_W, SHEET_H, render_sheet(char, frames, '0').px))
  writeFileSync(join(sprite_dir, '1.png'), encode_png(SHEET_W, SHEET_H, render_sheet(char, frames, '1').px))
  writeFileSync(join(sprite_dir, 'face.png'), encode_png(FACE, FACE, render_face(char).px))
  writeFileSync(join(sprite_dir, 's.png'), encode_png(SMALL_W, SMALL_H, render_small(char).px))
  writeFileSync(join(dir, `${char.id}.obj.json5`), JSON5.stringify(data, null, 2) + '\n')
  writeFileSync(join(dir, `${char.id}.index.json5`), JSON5.stringify(make_index(char), null, 2) + '\n')
  writeFileSync(join(dir, 'README.md'), make_readme(char))
  console.log(`  characters/${char.id}`)

  // 弹丸：数据 + 贴图
  for (const sp of char.specials) {
    const p = sp.projectile
    if (!p) continue
    const ball = make_projectile_data(char, p)
    writeFileSync(join(sprite_dir, `${p.id}.png`), encode_png(BALL_CELL * p.frames, BALL_CELL, render_projectile(p).px))
    writeFileSync(join(dir, `${p.id}.obj.json5`), JSON5.stringify(ball, null, 2) + '\n')
    console.log(`  characters/${char.id}/${p.id}`)
  }

  // 招式表
  mkdirSync(MOVES_DIR, { recursive: true })
  writeFileSync(join(MOVES_DIR, `${char.id}.moves.json5`), JSON.stringify(make_moves_data(char), null, 2) + '\n')
}

/** 把角色登记到 moves/moves.index.json5（保持原有紧凑写法） */
function register_move_lists(chars) {
  const file = join(MOVES_DIR, 'moves.index.json5')
  let text = readFileSync(file, 'utf8')
  const nl = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = chars
    .filter((c) => !text.includes(`moves/${c.id}.moves.json5`))
    .map((c) => `    { id: "${c.id}", type: "moves", file: "moves/${c.id}.moves.json5" },`)
  if (!lines.length) return
  const anchor = /(\r?\n)(\s*)\],/
  const at = text.search(anchor)
  if (at < 0) throw new Error('moves.index.json5 结构不符合预期')
  text = text.replace(anchor, (m, br) => `${br}${lines.join(br)}${br}  ],`)
  writeFileSync(file, text.replace(/\r?\n/g, nl))
}

/** 把招式名写进 moves/moves.strings.json5 的三个语言表 */
function register_move_strings(chars) {
  const file = join(MOVES_DIR, 'moves.strings.json5')
  const obj = JSON5.parse(readFileSync(file, 'utf8'))
  let changed = false
  for (const c of chars) {
    for (const sp of c.specials) {
      const table = {
        '': sp.en,
        'zh-hans': sp.zh,
        'zh-hant': sp.zh,
      }
      for (const [locale, value] of Object.entries(table)) {
        if (!obj[locale]) continue
        if (obj[locale][sp.i18n] === value) continue
        obj[locale][sp.i18n] = value
        changed = true
      }
    }
  }
  if (changed) writeFileSync(file, JSON.stringify(obj, null, 2) + '\n')
}

const only = process.argv.slice(2).filter((v) => !v.startsWith('-'))
const template = JSON5.parse(readFileSync(TEMPLATE, 'utf8'))
const targets = CHARS.filter((c) => !only.length || only.includes(c.id))
for (const char of targets) generate(char, template)
register_move_lists(targets)
register_move_strings(targets)
console.log('done')
