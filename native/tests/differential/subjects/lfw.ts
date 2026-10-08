// `LFW`（门面 4AB）的 TS 侧台面，op 与 `subjects/lfw.cpp` 一一对应。
//
// `Ditto` 的宿主包全脚本化（Sounds/ImageMgr/Keyboard/Pointings/UIInputHandle/WorldRender/
// Cache/Zip/Clock/Render/Timeout/…）；`Date.now` 固定成 12345（端口侧 `host.now()`）。
import { Ditto } from "../../../../src/LFW/ditto/Instance";
import { Expression } from "../../../../src/LFW/base/Expression";
import { Factory } from "../../../../src/LFW/Factory";
import { LFW } from "../../../../src/LFW/LFW";
import { get_val_getter_from_stage } from "../../../../src/LFW/loader/get_val_getter_from_stage";
import { PlayerInfo } from "../../../../src/LFW/PlayerInfo";
import { cook_ui_info, find_ui_template, merge_ui_template } from "../../../../src/LFW/ui/cook_ui_info";
import { LFWKeyEvent } from "../../../../src/LFW/ui/LFWKeyEvent";
import { LFWPointerEvent } from "../../../../src/LFW/ui/LFWPointerEvent";
import { UIImgLoader } from "../../../../src/LFW/ui/UIImgLoader";
import { ui_load_img } from "../../../../src/LFW/ui/ui_load_img";

import { esc, keyOf, parseValue, readCaseLines, renderValue, splitWs } from "./trace_util";

type Rec = Record<string, any>;

const log: string[] = [];
function push(s: string): void {
  log.push(s);
}
function fail(msg: string): never {
  process.stderr.write(msg + "\n");
  process.exit(2);
}

const render_value = (v: unknown): string => renderValue(v);
const num = (n: number): string => renderValue(n);

// `renderValue` 的环安全版（cook 的 `items` 会挂 parent 指针形成环；DAG 共用照常展开）。
function render_cycle_safe(v: unknown, stack: Set<unknown> = new Set()): string {
  if (v !== null && typeof v === "object") {
    if (stack.has(v)) return "~circ";
    stack.add(v);
    let out: string;
    if (Array.isArray(v)) {
      out = "[" + v.map((x) => render_cycle_safe(x, stack)).join(",") + "]";
    } else {
      const o = v as Record<string, unknown>;
      out =
        "{" +
        Object.keys(o)
          .map((k) => `${esc(k)}:${render_cycle_safe(o[k], stack)}`)
          .join(",") +
        "}";
    }
    stack.delete(v);
    return out;
  }
  return renderValue(v);
}

let clock_ms = 0;

// `imp`/`lzadd` 的 kind 迷你语言（两侧一致）：`-`/`o`/`a`/`k:<name>`/`str:<v>`/`e`（失败，抛 "boom"）。
const imports = new Map<string, () => unknown>();
const import_fails = new Map<string, string>();
// 4AJ：`find_ui_template` 要吞的「ImportError 形状」失败（C++ 侧就是 `impfail`）。
const import_soft_fails = new Set<string>();
// 4AJ：`uinew`/`uinest` 的 UI 值脚本。
const ui_vals = new Map<string, Rec>();
// 4AK：`imgset` 的图片脚本（FakeImageMgr.load_img 按 img_key 查）。
const image_vals = new Map<string, unknown>();

// 4AM：事件层与 UIImgLoader 的脚本。
const pevs = new Map<string, LFWPointerEvent>();
const kevs = new Map<string, LFWKeyEvent>();
const img_nodes = new Map<string, Rec>();
const loaders = new Map<string, UIImgLoader>();

function make_img_node(lfw_: LFW): Rec {
  const node: Rec = {
    lfw: lfw_,
    _image: null,
    resize(w: number, h: number): void {
      push(`imnode:resize|${num(w)}|${num(h)}`);
    },
  };
  Object.defineProperty(node, "image", {
    get() {
      return node["_image"];
    },
    set(v: unknown) {
      node["_image"] = v;
      push(`imnode:image|${renderValue(v)}`);
    },
  });
  return node;
}

// 4AD：URL 流程脚本。
const zip_stored = new Map<string, string>(); // `zip_url|md5` → blob token
const blob_zip = new Map<string, string>(); // blob/data token → zid
const dl_scripts = new Map<string, { mode: string; token: string; md5?: string; size: number }>();
const cache_vals = new Map<string, unknown>();
const cache_late = new Map<string, unknown>();
let cache_log = false;

function kind_value(k: string): unknown {
  if (k === "o") return {};
  if (k === "a") return [];
  if (k.startsWith("k:")) return { [k.slice(2)]: "1" };
  if (k.startsWith("str:")) return k.slice(4);
  if (k.startsWith("md5:")) return { md5: k.slice(4) };
  if (k.startsWith("w:")) return { "": { [k.slice(2)]: "1" } };
  if (k === "spk") return { id: "spark", type: 4, base: { name: "Spark" } };
  return undefined;
}

function err_msg(e: unknown): string {
  return typeof e === "string" ? e : e instanceof Error ? e.message : String(e);
}

// `cook` 给数据挂的 `xml*` 访问器/函数：C++ 侧不建形 ⇒ 渲染前剥掉（两边 warn 输出才能同形）。
function safe_render(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(safe_render);
  if (v !== null && typeof v === "object") {
    const out: Rec = {};
    for (const k of Object.keys(v as Rec)) {
      if (k === "xml" || k === "xml_roundtrip" || k === "xml_roundtrip_ok") continue;
      const val = (v as Rec)[k];
      if (typeof val === "function") continue;
      out[k] = safe_render(val);
    }
    return out;
  }
  return v;
}

function install_ditto(): void {
  class FakeSounds {
    constructor(_lfw: unknown) {
      push("snd_init");
    }
    dispose(): void {
      push("snd_dispose");
    }
    play_bgm(): () => void {
      push("snd_bgm");
      return () => undefined;
    }
    stop_bgm(): void {
      push("snd_stop");
    }
    play(): void {
      push("snd_play");
    }
    play_with_load(): void {
      push("snd_load");
    }
  }
  class FakeImageMgr {
    constructor(_lfw: unknown) {
      push("img_init");
    }
    load_img(key: string, path?: unknown, ops?: unknown): unknown {
      // 两参以下的调用是 DatMgr 那条（只打一行）；三参是 `ui_load_img`（带 ops）。
      if (ops === undefined) {
        push("img:load|" + key);
        return "";
      }
      push(`img:load|${key}|${renderValue(path)}|${renderValue(ops)}`);
      if (!image_vals.has(key)) throw "unscripted image";
      return image_vals.get(key);
    }
    pin(key: string): void {
      push("img:pin|" + key);
    }
    measure_text(): string {
      push("measure");
      return "";
    }
  }
  class FakeKeyboard {
    callback = { add: () => push("kbd_cbadd") };
    constructor(_lfw: unknown) {
      push("kbd_init");
    }
    dispose(): void {
      push("kbd_dispose");
    }
  }
  class FakePointings {
    callback = { add: () => push("pt_cbadd") };
    constructor() {
      push("pt_init");
    }
    dispose(): void {
      push("pt_dispose");
    }
  }
  class FakeUIInputHandle {
    constructor(_lfw: unknown) {}
  }
  class FakeWorldRender {
    constructor(_world: unknown) {
      push("wr_init");
    }
    add_entity(): void {}
    del_entity(): void {}
    render(): void {}
    dispose(): void {}
  }
  const cache = {
    forget(type: string, version: number) {
      push(`cache:forget|${type}|${num(version)}`);
      return Promise.resolve();
    },
    async get(name: string) {
      if (cache_log) push(`cache:get|${name}`);
      if (cache_late.has(name)) {
        const v = cache_late.get(name);
        cache_late.delete(name);
        cache_vals.set(name, v);
        return undefined;
      }
      return cache_vals.get(name);
    },
    put(entry: Rec) {
      if (cache_log) push(`cache:put|${String(entry?.["name"])}`);
    },
    async del(name: string, version: string) {
      if (cache_log) push(`cache:del|${name}|${version}`);
    },
  };
  const zip = {
    forget_stored(type: string, version: number) {
      push(`zip:forget|${type}|${num(version)}`);
      return Promise.resolve();
    },
    async get_stored(url: string, md5: string) {
      push(`zip:get_stored|${url}|${md5}`);
      return zip_stored.get(`${url}|${md5}`);
    },
    async read_blob(name: string, blob: unknown, md5: unknown) {
      push(`zip:read_blob|${name}|${String(md5)}`);
      return resolve_token(blob, "unscripted blob");
    },
    async read_buf(name: string, data: unknown) {
      push(`zip:read_buf|${name}`);
      return resolve_token(data, "unscripted buf");
    },
    async download(url: string, progress: (p: number, s: number) => void) {
      push(`zip:download|${url}`);
      const s = dl_scripts.get(url);
      if (!s) throw "unscripted download";
      if (s.mode === "fail") throw "dl-fail";
      progress(50, s.size);
      return { stored: s.mode === "stored", blob: s.token, md5: s.md5 };
    },
  };
  const resolve_token = (token: unknown, msg: string): unknown => {
    if (typeof token !== "string") throw msg;
    const zid = blob_zip.get(token);
    if (zid === undefined) throw msg;
    const z = lzips.get(zid);
    if (!z) throw msg;
    return z;
  };
  const importer = {
    async import_as_json(urls: string[]) {
      for (const url of urls) {
        const key = url.split("?")[0]!;
        push(`imp:json|${key}`);
        if (import_soft_fails.has(key)) throw { is_make_import_error: true, message: "soft" };
        const fail = import_fails.get(key);
        if (fail !== undefined) throw fail;
        if (imports.has(key)) return [imports.get(key)!(), url];
      }
      throw "unscripted import";
    },
    async import_as_text(_urls: string[]) {
      throw { is_make_import_error: true, message: "no text" };
    },
  };
  const clock = {
    ms: 0,
    next: 1,
    handles: new Map<number, () => void>(),
    now: () => clock_ms,
    add(h: () => void) {
      const id = clock.next++;
      clock.handles.set(id, h);
      return id;
    },
    del(id: number) {
      clock.handles.delete(id);
    },
    hidden: () => false,
  };
  const render = {
    add(h: () => void) {
      return clock.add(h);
    },
    del(id: number) {
      clock.del(id);
    },
    raf(h: () => void) {
      return clock.add(h);
    },
    caf(id: number) {
      clock.del(id);
    },
  };
  Ditto.setup({
    Clock: clock as never,
    Render: render as never,
    Timeout: {
      next: 1,
      add(_h: () => void, _ms: number) {
        return clock.next++;
      },
      del(_id: number) {},
    } as never,
    Interval: {
      next: 1,
      add(_h: () => void, _ms: number) {
        return clock.next++;
      },
      del(_id: number) {},
    } as never,
    MD5: (s: unknown) => "h:" + String(s),
    JSON5: { parse: (s: string) => JSON.parse(s), stringify: (v: unknown) => JSON.stringify(v) },
    Zip: zip as never,
    Sounds: FakeSounds as never,
    Keyboard: FakeKeyboard as never,
    Pointings: FakePointings as never,
    FullScreen: class {} as never,
    Importer: importer as never,
    Cache: cache as never,
    Vector3: class {
      x = 0;
      y = 0;
      z = 0;
    } as never,
    Vector2: class {
      x = 0;
      y = 0;
    } as never,
    WorldRender: FakeWorldRender as never,
    UINodeRenderer: class {} as never,
    ImageMgr: FakeImageMgr as never,
    UIInputHandle: FakeUIInputHandle as never,
    XML: {} as never,
    warn: (...args: unknown[]) => push("warn|" + args.map((a) => render_value(safe_render(a))).join("~")),
    error: (...args: unknown[]) =>
      push("error|" + args.map((a) => render_value(safe_render(a))).join("~")),
    Log: (...args: unknown[]) => push("Log|" + args.map((a) => render_value(safe_render(a))).join("~")),
    debug: (...args: unknown[]) =>
      push("debug|" + args.map((a) => render_value(safe_render(a))).join("~")),
    DEV: false,
    IsDesktop: false,
    alert: () => undefined,
  });
}

const CB_KEYS = [
  "on_ui_changed",
  "on_loading_start",
  "on_loading_end",
  "on_loading_failed",
  "on_progress",
  "on_bgms_loaded",
  "on_bgms_clear",
  "on_player_infos_changed",
  "on_cheat_changed",
  "on_stage_pass",
  "on_enter_next_stage",
  "on_dispose",
  "on_ui_loaded",
  "on_prel_loaded",
  "on_lang_changed",
  "on_broadcast",
  "on_survival_rank_changed",
  "on_zips_changed",
  "on_component_broadcast",
  "on_extra_zips_changed",
  "controller_detected",
  "keyboard_detected",
];

let lfw: LFW;

function listen(): void {
  for (const name of CB_KEYS) {
    (lfw.callbacks as unknown as Rec).on(name, (...args: unknown[]) => {
      const parts: string[] = [`cb|${name}`];
      for (const a of args) {
        if (a === lfw) parts.push("self");
        else if (name === "on_ui_loaded") parts.push(String((a as unknown[]).length));
        else if (name === "on_zips_changed")
          parts.push((a as { name: string }[]).map((v) => v.name).join(","));
        else if (a === undefined || a === null) parts.push("u");
        else if (a instanceof PlayerInfo) parts.push("pl:" + String(a.id));
        else if (typeof a === "number") parts.push("n:" + num(a));
        else if (typeof a === "boolean") parts.push("b:" + (a ? 1 : 0));
        else if (typeof a === "string") parts.push("s:" + a);
        else parts.push(render_value(a));
      }
      push(parts.join("|"));
    });
  }
}

function team_token(t: string): string | undefined {
  if (t === "-") return undefined;
  return t;
}

// ---- 4AC：加载流程的脚本化假 zip ----
class LzObject {
  constructor(
    private readonly path: string,
    private readonly kind: string,
  ) {}
  get name(): string {
    return this.path;
  }
  async json(): Promise<unknown> {
    push(`lz:json|${this.path}`);
    if (this.kind === "e") throw "boom";
    return kind_value(this.kind);
  }
  async text(): Promise<unknown> {
    push(`lz:text|${this.path}`);
    if (this.kind === "e") throw "boom";
    const v = kind_value(this.kind);
    return typeof v === "string" ? v : v === undefined ? undefined : JSON.stringify(v);
  }
}

class Lz {
  zid = "";
  name = "";
  md5?: string;
  entries: { path: string; kind: string }[] = [];
  file(path: string | RegExp): unknown {
    if (typeof path === "string") {
      push(`lz:file|${this.zid}|${path}`);
      const e = this.entries.find((v) => v.path === path);
      return e ? new LzObject(e.path, e.kind) : null;
    }
    push(`lz:rgx|${this.zid}|${path.source}`);
    return this.entries
      .filter((v) => {
        path.lastIndex = 0;
        return path.test(v.path);
      })
      .map((v) => new LzObject(v.path, v.kind));
  }
}

const lzips = new Map<string, Lz>();

function dump_info(info: Rec): string {
  return [
    info["type"],
    info["url"],
    info["title"],
    info["description"],
    info["author"],
    info["version"],
    info["time"],
    info["md5"],
  ]
    .map((v) => String(v))
    .join("|");
}

function main(): void {
  install_ditto();
  (Date as unknown as Rec).now = () => 12345;
  lfw = new LFW(false);
  listen();

  void run_ops().catch((e) => {
    process.stderr.write(err_msg(e) + "\n");
    process.exit(2);
  });
}

async function run_ops(): Promise<void> {
  const lfw_rec = lfw as unknown as Rec;
  const uis = lfw_rec["uis"] as Rec;
  const orig_add = (uis["add"] as (...a: unknown[]) => void).bind(uis);
  uis["add"] = (...a: unknown[]) => {
    push("ui:add|" + a.length);
    return orig_add(...a);
  };
  const orig_clear = (uis["clear"] as () => void).bind(uis);
  uis["clear"] = () => {
    push("ui:clear");
    return orig_clear();
  };
  const desc = Object.getOwnPropertyDescriptor(uis, "all");
  const proto_desc =
    desc ?? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(uis) as object, "all");
  if (proto_desc?.get) {
    Object.defineProperty(uis, "all", {
      configurable: true,
      get() {
        push("ui:all");
        return proto_desc.get!.call(uis);
      },
    });
  }
  const layers = lfw_rec["layers"] as Rec;
  const orig_set_page = (layers["set_page"] as (...a: unknown[]) => unknown).bind(layers);
  layers["set_page"] = (opts: Rec, idx: number) => {
    push(`layers:set_page|${String(opts?.id)}`);
    return orig_set_page(opts, idx);
  };
  for (const line of readCaseLines(process.argv[2]!)) {
    const t = splitWs(line);
    if (t.length === 0) continue;
    const op = t[0]!;
    const i = [1];
    const next = (): string => t[i[0]!++]!;
    const arg = (): unknown => parseValue(t, i);
    const nextKey = (): string => keyOf(next());

    if (op === "info") {
      const info = LFW.INFO as Rec;
      push(
        `info|${String(info?.["title"])}|${String(info?.["type"])}|${num(Number(info?.["version"]))}|default=${LFW.IS_DEFAULT_INFO ? 1 : 0}|zips=${LFW.ZIPS.length}`,
      );
    } else if (op === "setinfo") {
      const title = nextKey();
      LFW.INFO = {
        type: "FULL",
        version: 1,
        title,
        description: "d",
        author: "a",
        paths: ["prel.zip.json", "data.zip.json", "extra.zip.json"],
      } as never;
    } else if (op === "setzips") {
      LFW.ZIPS = [nextKey(), nextKey()] as never;
    } else if (op === "newid") {
      const n = Number(nextKey());
      for (let k = 0; k < n; ++k) push("newid|" + lfw.new_id);
    } else if (op === "newteam") {
      const n = Number(nextKey());
      for (let k = 0; k < n; ++k) push("newteam|" + lfw.new_team);
    } else if (op === "resetids") {
      lfw.reset_new_id();
    } else if (op === "resetteam") {
      lfw.reset_new_team();
    } else if (op === "player") {
      const id = nextKey();
      const p1 = lfw.player(id);
      const p2 = lfw.player(id);
      push(
        `player|${p1.id}|${p1 === p2 ? 1 : 0}|local=${p1.local ? 1 : 0}|${String(p1.name ?? "u")}|count=${lfw.players.size}`,
      );
    } else if (op === "pkey") {
      const pid = nextKey();
      const name = nextKey();
      const key = nextKey();
      const p = lfw.player(pid);
      let ok = 0;
      try {
        p.set_key(name, key);
        ok = 1;
      } catch (e) {
        void e;
      }
      push(`pkey|${p.id}|${ok}`);
    } else if (op === "pkeys") {
      const pid = nextKey();
      const p = lfw.player(pid);
      push(`pkeys|${p.id}|${render_value(p.keys)}`);
    } else if (op === "kbdown") {
      const key = nextKey();
      const times = Number(nextKey());
      const dev = nextKey();
      const e = {
        key,
        times,
        device_type: dev === "-" ? undefined : dev,
        interrupt() {
          (e as Rec)["_int"] = true;
        },
      };
      lfw.on_key_down(e as never);
      push(`kbdown|${key}|${num(times)}|${dev}|int=${(e as Rec)["_int"] ? 1 : 0}`);
    } else if (op === "kbup") {
      const key = nextKey();
      const e = { key };
      lfw.on_key_up(e as never);
      push(`kbup|${key}`);
    } else if (op === "cmds") {
      push("cmds|" + lfw.cmds.join(";"));
    } else if (op === "clearcmds") {
      lfw.cmds.length = 0;
    } else if (op === "ischeat") {
      push(`ischeat|${nextKey()}|${lfw.is_cheat(nextKey()) ? 1 : 0}`);
    } else if (op === "setcheat") {
      const name = nextKey();
      const en = t[i[0]!++]!;
      lfw.set_cheat(name, team_to_bool(en));
    } else if (op === "ep") {
      lfw.emit_progress(nextKey(), Number(nextKey()));
    } else if (op === "eps") {
      const c = nextKey();
      const p = Number(nextKey());
      const s = nextKey();
      lfw.emit_progress(c, p, s === "-" ? undefined : Number(s));
    } else if (op === "bcast") {
      lfw.broadcast(nextKey());
    } else if (op === "dataset") {
      (lfw.world.dataset as Rec)[nextKey()] = parseValue(t, i);
    } else if (op === "switchdiff") {
      lfw.switch_difficulty(Number(nextKey()));
    } else if (op === "lang") {
      push(`lang|${lfw.lang}`);
    } else if (op === "setlang") {
      lfw.lang = nextKey();
    } else if (op === "setlangbad") {
      lfw.set_lang(parseValue(t, i) as never);
    } else if (op === "canon") {
      push(`canon|${String(lfw.canonical_lang(nextKey()))}`);
    } else if (op === "i18nadd") {
      const lang = nextKey();
      const key = nextKey();
      const val = nextKey();
      (lfw as Rec)["_i18n"].add({ [lang]: { [key]: val } });
      push(`i18nadd|${lang}|${key}`);
    } else if (op === "str") {
      const n = nextKey();
      push(`str|${n}|${render_value(lfw.string(n))}`);
    } else if (op === "srank") {
      lfw.survival_rank_mode = true;
      lfw.survival_rank_available = true;
      lfw.survival_rank_2p = true;
      lfw.survival_rank_period = "week";
      lfw.set_survival_rank_data({ period: "week", list: [], mine: null });
      push(
        `srank|${lfw.survival_rank_mode ? 1 : 0}${lfw.survival_rank_available ? 1 : 0}${lfw.survival_rank_2p ? 1 : 0}|${lfw.survival_rank_period}|cheated=${lfw.survival_rank_cheated ? 1 : 0}|modded=${lfw.survival_rank_modded ? 1 : 0}|invalid=${lfw.survival_rank_invalid ? 1 : 0}`,
      );
    } else if (op === "randinfo") {
      const e = make_entity();
      lfw.random_entity_info(e as never);
      push(
        `randinfo|${(e as Rec)["id"]}|${fmt_num((e as Rec)["facing"])}|${fmt_num((e as Rec)["position"].x)}|${fmt_num((e as Rec)["position"].y)}|${fmt_num((e as Rec)["position"].z)}|L${fmt_num(lfw.world.left)},${fmt_num(lfw.world.right)},${fmt_num(lfw.world.near)},${fmt_num(lfw.world.far)}`,
      );
    } else if (op === "mtrange") {
      push(
        `mtrange|${fmt_num((lfw as Rec)["_mt"].range(Number(nextKey()), Number(nextKey())))}`,
      );
    } else if (op === "entadd") {
      const id = nextKey();
      const n = Number(nextKey());
      const ret = lfw.entities.add({ type: 8, id }, n);
      push(`entadd|${ret.length}`);
    } else if (op === "getter") {
      const w = nextKey();
      push(`getter|${w}|${get_val_getter_from_stage(w) ? 1 : 0}`);
    } else if (op === "endtest") {
      const words: string[] = [];
      while (i[0]! < t.length) words.push(keyOf(t[i[0]!++]!));
      const items = words.map((w) => new Expression(w, get_val_getter_from_stage));
      push(`endtest|${words.join(",")}|${items.length}`);
    } else if (op === "keys2") {
      const a = (lfw as unknown as Rec)["keys"];
      const b = (lfw as unknown as Rec)["keys"];
      push(`keys2|${a === b ? 1 : 0}`);
    } else if (op === "keysgo") {
      const k = (lfw as unknown as Rec)["create_keys"]();
      const before = lfw.mounted_keys.length;
      (lfw as unknown as Rec)["regist_keys"](k);
      (lfw as unknown as Rec)["recycle_keys"](k);
      (lfw as unknown as Rec)["regist_keys"](k);
      push(`keysgo|${before}|${lfw.mounted_keys.length}`);
    } else if (op === "instcount") {
      push(`instcount|${LFW.instances.length}`);
    } else if (op === "dispose") {
      lfw.dispose();
      push(`dispose|${LFW.instances.length}`);
    } else if (op === "lznew") {
      const z = new Lz();
      z.zid = nextKey();
      z.name = nextKey();
      if (i[0] < t.length) z.md5 = nextKey();
      lzips.set(z.zid, z);
    } else if (op === "lzadd") {
      const zid = nextKey();
      const path = nextKey();
      const kind = t[i[0]!++]!;
      lzips.get(zid)!.entries.push({ path, kind });
    } else if (op === "imp") {
      const key = next();
      const kind = next();
      imports.set(key, () => kind_value(kind));
    } else if (op === "impfail") {
      const key = next();
      import_fails.set(key, i[0] < t.length ? next() : "boom");
    } else if (op === "impsoft") {
      import_soft_fails.add(next());
    } else if (op === "uimg") {
      const vid = next();
      const img = parseValue(t, i);
      try {
        const info = await ui_load_img(lfw, img as never);
        push(`uimg|${vid}|ok|${renderValue(safe_render(info))}`);
      } catch (e) {
        push(`uimg|${vid}|err|${esc(err_msg(e))}`);
      }
    } else if (op === "imgset") {
      const key = next();
      image_vals.set(key, parseValue(t, i));
    } else if (op === "newp") {
      const id = next();
      const x = Number(next());
      const y = Number(next());
      const z = Number(next());
      const btn = Number(next());
      pevs.set(id, new LFWPointerEvent({ x, y, z }, btn));
    } else if (op === "newk") {
      const id = next();
      const player = nextKey();
      const pressed = next() === "1";
      const gk = nextKey();
      const key = nextKey();
      kevs.set(id, new LFWKeyEvent(player, pressed, gk as never, key));
    } else if (op === "stp" || op === "sti") {
      const id = next();
      const e = pevs.get(id) ?? kevs.get(id);
      if (!e) fail(`unknown event '${id}'`);
      if (op === "stp") e.stop_propagation();
      else e.stop_immediate_propagation();
    } else if (op === "rdp") {
      const id = next();
      const e = pevs.get(id)!;
      push(`rdp|${id}|${num(e.point.x)}|${num(e.point.y)}|${num(e.point.z)}|${num(e.button)}|${e.stopped}`);
    } else if (op === "rdk") {
      const id = next();
      const e = kevs.get(id)!;
      push(`rdk|${id}|${esc(e.player)}|${esc(e.game_key)}|${esc(e.key)}|${e.pressed ? "1" : "0"}|${e.stopped}`);
    } else if (op === "imnode") {
      const lid = next();
      const nid = next();
      let node: Rec | null = null;
      if (nid !== "-") {
        node = img_nodes.get(nid) ?? null;
        if (!node) {
          node = make_img_node(lfw);
          img_nodes.set(nid, node);
        }
      }
      const captured = node;
      loaders.set(lid, new UIImgLoader(() => captured as never));
    } else if (op === "imjid") {
      const j = (loaders.get(next()) as unknown as Rec)["_jid"] as Rec;
      push(`imjid|${num(j["value"] as number)}|${num(j["min"] as number)}|${num(j["max"] as number)}`);
    } else if (op === "imignore") {
      loaders.get(next())!.ignore_out_of_date();
    } else if (op === "imload" || op === "imset") {
      const lid = next();
      const loader = loaders.get(lid)!;
      try {
        const imgs =
          op === "imload"
            ? await loader.load(parseValue(t, i) as never)
            : await loader.set_img(nextKey());
        push(`imload|ok|${renderValue(imgs)}`);
      } catch (e) {
        const rec = e as Rec;
        push(
          `imload|err|${esc(err_msg(e))}` +
            (rec && rec["__is_out_of_date_error"] ? "|ood|" + renderValue(rec["texture"]) : ""),
        );
      }
    } else if (op === "uinew") {
      ui_vals.set(next(), parseValue(t, i) as Rec);
    } else if (op === "uinest") {
      const cid = next();
      const pid = next();
      (ui_vals.get(cid) as Rec)["parent"] = ui_vals.get(pid);
    } else if (op === "uifind") {
      const id = next();
      const name = nextKey();
      const out = await find_ui_template(lfw, ui_vals.get(id) as never, name);
      push(`uifind|${renderValue(out)}`);
    } else if (op === "uimerge") {
      const pid = next();
      const parent = pid === "-" ? undefined : (ui_vals.get(pid) as never);
      const raw = parseValue(t, i) as never;
      push(`uimerge|${renderValue(await merge_ui_template(lfw, raw, parent))}`);
    } else if (op === "ucook") {
      const pid = next();
      const parent = pid === "-" ? undefined : (ui_vals.get(pid) as never);
      const info = parseValue(t, i);
      try {
        const cooked = await cook_ui_info(lfw, info as never, parent);
        push(`ucook|${render_cycle_safe(cooked)}`);
      } catch (e) {
        const rec = e as Rec;
        const msg = rec && rec["error"] ? (rec["error"] as Error).message : err_msg(e);
        push(`ucook|err|${esc(msg)}`);
      }
    } else if (op === "devon") {
      lfw.dev = true;
    } else if (op === "devoff") {
      lfw.dev = false;
    } else if (op === "zips") {
      const zs = (lfw as unknown as Rec)["zips"].zips as { name: string }[];
      const infos = (lfw as unknown as Rec)["zips"].data_infos as Rec[];
      push(`zips|${zs.map((v) => v.name).join(",")}|${infos.map((v) => String(v.md5)).join(",")}`);
    } else if (op === "collect") {
      const infos = (await (LFW as unknown as Rec).collect_data_infos()) as Rec[];
      const body = infos
        .map((v) => `${String(v.type)}:${String(v.url)}:${String(v.title)}:${String(v.md5)}`)
        .join(";");
      push(`collect|${infos.length}|${body}`);
    } else if (op === "lstate") {
      const r = lfw as unknown as Rec;
      push(
        `lstate|loading=${r["_loading"] ? 1 : 0}|playable=${r["_playable"] ? 1 : 0}|ui=${r["_ui_loaded"] ? 1 : 0}|disposed=${r["_disposed"] ? 1 : 0}`,
      );
    } else if (op === "bgms") {
      push(`bgms|${((lfw as unknown as Rec)["bgms"] as string[]).join(",")}`);
    } else if (op === "loadobj") {
      const zid = nextKey();
      const z = lzips.get(zid);
      try {
        const loaded = await (lfw as unknown as Rec)["_load_zip_from_object"](z);
        push(`loadobj|ok|${dump_info(loaded.info)}`);
      } catch (e) {
        push(`loadobj|fail|${err_msg(e)}`);
      }
    } else if (op === "loaddata") {
      const zid = nextKey();
      const z = lzips.get(zid);
      try {
        const loaded = await (lfw as unknown as Rec)["_load_zip_from_object"](z);
        await (lfw as unknown as Rec)["load_data"](loaded);
        push("loaddata|ok");
      } catch (e) {
        push(`loaddata|fail|${err_msg(e)}`);
      }
    } else if (op === "load") {
      const items: unknown[] = [];
      while (i[0] < t.length) {
        const tok = t[i[0]!++]!;
        if (tok.startsWith("z:")) items.push(lzips.get(tok.slice(2)));
        else items.push(keyOf(tok.startsWith("s:") ? tok.slice(2) : tok));
      }
      try {
        await lfw.load(...(items as never[]));
        push("load|ok");
      } catch (e) {
        push(`load|fail|${err_msg(e)}`);
      }
    } else if (op === "stored") {
      const url = next();
      const md5 = next();
      zip_stored.set(`${url}|${md5}`, next());
    } else if (op === "blob" || op === "buf") {
      blob_zip.set(next(), next());
    } else if (op === "dl") {
      const url = next();
      const mode = next();
      const token = next();
      const md5 = next();
      const size = Number(next());
      dl_scripts.set(url, { mode, token, md5: md5 === "-" ? undefined : md5, size });
    } else if (op === "cacheblob" || op === "cachedata") {
      const key = next();
      const name = next();
      const token = next();
      cache_vals.set(key, op === "cacheblob" ? { name, blob: token } : { name, data: token });
    } else if (op === "cachelate") {
      const key = next();
      const name = next();
      const token = next();
      cache_late.set(key, { name, blob: token });
    } else if (op === "cachelog") {
      cache_log = true;
    } else if (op === "impinfo") {
      const key = next();
      const url = next();
      const md5 = next();
      imports.set(key, () => {
        const v: Rec = { type: "FULL", title: "T" };
        if (url !== "-") v["url"] = url;
        if (md5 !== "-") v["md5"] = md5;
        return v;
      });
    } else if (op === "url") {
      const info_url = nextKey();
      try {
        const loaded = await (lfw as unknown as Rec)["_load_zip_from_url"](info_url);
        push(`url|ok|${loaded.zip.name}|${dump_info(loaded.info)}`);
      } catch (e) {
        push(`url|fail|${err_msg(e)}`);
      }
    } else {
      fail(`unknown op '${op}'`);
    }
  }

  process.stdout.write(log.join("\n") + "\n");
}

let ent_seq = 0;
function make_entity(): Rec {
  const e: Rec = {
    id: `e${++ent_seq}`,
    facing: 1,
    team: undefined,
    ctrl: undefined,
    position: {
      x: 0,
      y: 0,
      z: 0,
      set(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
      },
    },
    attach() {},
  };
  return e;
}

function fmt_num(n: unknown): string {
  return num(Number(n));
}

function team_to_bool(t: string): boolean | undefined {
  if (t === "-") return undefined;
  return t === "1";
}

Factory.entity_creators.set(8 as never, ((_world: unknown, data: Rec) => {
  push("entadd:create|" + String(data?.["id"]));
  const e = make_entity();
  e["data"] = data;
  return e;
}) as never);

main();
