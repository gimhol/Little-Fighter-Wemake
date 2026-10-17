import { Callbacks } from "../../../../src/LFW/base/Callbacks";
import { FPS } from "../../../../src/LFW/base/FPS";
import type { FSM as FSMType, IState } from "../../../../src/LFW/base/FSM";
import { FSM } from "../../../../src/LFW/base/FSM";
import { get_short_file_size_txt } from "../../../../src/LFW/base/get_short_file_size_txt";
import { get_team_outline_color } from "../../../../src/LFW/base/get_team_shadow_color";
import { get_team_text_color } from "../../../../src/LFW/base/get_team_text_color";
import { Ticker } from "../../../../src/LFW/base/Ticker";
import { ValExpression } from "../../../../src/LFW/base/ValExpression";
import { Ditto } from "../../../../src/LFW/ditto/Instance";
import { preprocess_opoint } from "../../../../src/LFW/loader/preprocess_opoint";
import { make_buring_smoke } from "../../../../src/LFW/dat_translator/make_buring_smoke";
import { spawn_ice_piece } from "../../../../src/LFW/state/spawn_ice_piece";
import { MersenneTwister } from "../../../../src/LFW/utils/math/MersenneTwister";

import { bitsHex, esc, f64FromBits, parseJsStringLiteral, parseValue, readCaseLines, renderValue, splitWs } from "./trace_util";

const out: string[] = [];
const line = (...p: (string | number)[]): string => p.map((x) => String(x)).join(" ");

const cb = new Callbacks<any>();
const byId = new Map<string, any>();
let reemitKey = "";

let fsm: FSMType<string, IState<string>> | undefined;
let snap: ReturnType<FSMType<string, IState<string>>["to_snapshot"]> | undefined;
let selfAddId = "";
let selfAddKey = "";

// --- `base/ValExpression` + `loader/preprocess_opoint` 的假宿主 ---------------
// 端口按 `ValExpression` 的 Ctx 概念给的是 `frame_var(name)` + `mt()`；TS 侧是
// `{ frame: {width,height,centerx,centery}, lfw: { mt } }` 这样的结构体对象。

const mt = new MersenneTwister(0);
const frame = { width: 0, height: 0, centerx: 0, centery: 0 };
// `data`：闭包开头 `is_object(emitter)`（= `is_object_data(e.data)`）的判据。
const fakeData = { type: 4 };
const fake = { frame, data: fakeData, lfw: { mt } } as never;
const customVars: Record<string, (e: unknown) => number> = {};
const vexprs: ValExpression[] = [];
let opoint: Record<string, unknown> = {};
let pctx_data: unknown;
let pctx_frame: unknown;

const GEN_FIELDS: [string, string][] = [
  ["gen_x", "__gen_x"],
  ["gen_y", "__gen_y"],
  ["gen_z", "__gen_z"],
  ["gen_dvx", "__gen_dvx"],
  ["gen_dvy", "__gen_dvy"],
  ["gen_dvz", "__gen_dvz"],
  ["gen_spread_x", "__gen_spread_x"],
  ["gen_spread_y", "__gen_spread_y"],
  ["gen_spread_z", "__gen_spread_z"],
];

function veDump(idx: number): void {
  const e = vexprs[idx]!;
  out.push(line("D", idx, esc(e.text), esc(e.tag), e.err === undefined ? "-" : esc(e.err)));
}

function veGet(idx: number, times: number): void {
  const e = vexprs[idx]!;
  const parts: (string | number)[] = ["G", idx, times, esc(mt.mark)];
  for (let i = 0; i < times; i++) parts.push(bitsHex(e.get(fake)));
  out.push(parts.join(" "));
}

function opointCompile(): void {
  preprocess_opoint({ opoint, lfw: { mt }, data: pctx_data, frame: pctx_frame } as never);
  let present = 0;
  const rows: string[] = [];
  for (const [genKey, dstKey] of GEN_FIELDS) {
    const v = opoint[dstKey];
    const ok = v instanceof ValExpression;
    if (ok) present++;
    const kept = ok ? "-" : esc(renderValue(v));
    rows.push(
      line(
        "PG",
        esc(dstKey),
        ok ? 1 : 0,
        ok ? (v.err === undefined ? "-" : esc(v.err)) : "-",
        ok ? bitsHex(v.get(fake)) : "-",
        kept,
      ),
    );
    // §4.40 的对齐约定：TS 把函数对象挂在记录上，端口不挂 ⇒ 差分时 TS 侧删掉。
    delete opoint[dstKey];
  }
  out.push(line("PC", present));
  out.push(...rows);
}
function keyValue(tok: string): string | number {
  return /^-?\d+(\.\d+)?$/.test(tok) ? Number(tok) : tok;
}

// --- `base/Ticker` + `base/FPS` 的假时钟 / 假定时器 --------------------------
// TS 侧换掉 `Ditto.Clock` / `Ditto.Timeout`（端口换 `clock()` / `timeout()` 两个槽）。
// 两侧都把 `add` / `del` 打进日志：**走 Timeout 还是走 Clock、delay 是多少**正是
// `Ticker._schedule` 的行为。`fire` 取「句柄最大的待发回调」（Ticker 同时只挂一个）。

const fakeClock = {
  value: 0,
  hid: false,
  nextId: 1,
  pending: new Map<number, () => void>(),
  now(): number {
    return this.value;
  },
  add(handler: () => void): number {
    const id = this.nextId++;
    this.pending.set(id, handler);
    out.push(line("CLK", "add", id));
    return id;
  },
  del(handle: number): void {
    this.pending.delete(handle);
    out.push(line("CLK", "del", handle));
  },
  hidden(): boolean {
    return this.hid;
  },
};

const fakeTimeout = {
  nextId: 1,
  pending: new Map<number, () => void>(),
  add(handler: () => void, timeout?: number): number {
    const id = this.nextId++;
    this.pending.set(id, handler);
    out.push(line("TOUT", "add", id, bitsHex(timeout ?? 0)));
    return id;
  },
  del(timerId: number): void {
    this.pending.delete(timerId);
    out.push(line("TOUT", "del", timerId));
  },
};

Ditto.Clock = fakeClock as never;
Ditto.Timeout = fakeTimeout as never;

function firePending(pend: Map<number, () => void>, kind: string): void {
  let best = -1;
  for (const k of pend.keys()) if (k > best) best = k;
  if (best < 0) {
    out.push(line("FIRE", kind, "-"));
    return;
  }
  const fn = pend.get(best)!;
  pend.delete(best);
  out.push(line("FIRE", kind, best));
  fn();
}

// 宿主「发一次待发的回调」：Ticker 同时只会挂一个（Timeout 或 Clock），所以先看 Timeout。
function fireAny(): void {
  if (fakeTimeout.pending.size > 0) {
    firePending(fakeTimeout.pending, "timeout");
    return;
  }
  if (fakeClock.pending.size > 0) {
    firePending(fakeClock.pending, "clock");
    return;
  }
  out.push("FIRE -");
}

let tkStep = 16;
let tkSpent = 0;
let tkSteps = 0;
// 重入钩子：`on_step` 里回调 Ticker 自己（`resume`/`pause`/`stop`）。这是 `_schedule`
// 三个守卫因子唯一的可观察入口（宿主在一步的中间改状态），所以值得做成 op。
let tkInside = "";

const tkOpt = {
  step_ms: (): number => tkStep,
  on_step: (dt: number): void => {
    out.push(line("STEP", tkSteps++, bitsHex(dt)));
    // `on_step` 里的「干活耗时」：让假时钟前进，`Ticker.cost` 的 EMA 才动得起来。
    fakeClock.value += tkSpent;
    if (tkInside !== "" && ticker !== undefined) {
      const sub = tkInside;
      tkInside = "";
      if (sub === "resume") ticker.resume();
      else if (sub === "pause") ticker.pause();
      else if (sub === "stop") ticker.stop();
      else if (sub === "resync") ticker.resync(true);
    }
  },
};

let ticker: Ticker | undefined;
let fps: FPS | undefined;

function flagText(b: boolean): string {
  return b ? "true" : "false";
}

function tickerDump(): void {
  const t = ticker as any;
  out.push(
    line(
      "TK",
      "run=" + flagText(ticker !== undefined && Boolean(ticker.running)),
      "pend=" + flagText(t !== undefined && Boolean(t._pending)),
      "pause=" + flagText(t !== undefined && Boolean(t._paused)),
      "base=" + bitsHex(Number(t?._base ?? 0)),
      "span=" + bitsHex(Number(t?._span ?? 0)),
      "step=" + bitsHex(Number(t?._base ?? 0) * Number(t?._span ?? 0)),
      "rate=" + bitsHex(Number(t?._rate ?? 0)),
      "cost=" + bitsHex(Number(t?._cost ?? t?.cost ?? 0)),
      "dl=" + bitsHex(Number(t?._deadline ?? 0)),
      "last=" + bitsHex(Number(t?._last_step ?? 0)),
      "tid=" + Number(t?._timer ?? 0),
      "wid=" + Number(t?._wake_id ?? 0),
    ),
  );
}

function fpsDump(): void {
  const f = fps as any;
  out.push(
    line(
      "FPS",
      "value=" + bitsHex(Number(f?._value ?? 0)),
      "dur=" + bitsHex(Number(f?._duration ?? 0)),
      "ret=" + bitsHex(Number(f?._retention ?? 0)),
    ),
  );
}

Ditto.warn = (msg: string) => {
  out.push("WARN " + esc(msg));
};

function makeListener(id: string, keys: string[], once: boolean): unknown {
  const o: Record<string, unknown> = {};
  for (const k of keys) {
    o[k] = (...args: unknown[]) => {
      out.push(line("L", id, k, ...args.map(renderValue)));
      if (reemitKey !== "" && reemitKey === k) cb.call(k);
      if (selfAddKey !== "" && selfAddKey === k) {
        cb.once(k, () => {
          out.push("LX " + id);
        });
      }
    };
  }
  if (once) o.once = true;
  return o;
}

function keyText(s: IState<string> | undefined): string {
  return s === undefined ? "-" : esc(String(s.key));
}

function fsmDump(tag: string): void {
  out.push(
    line(
      tag,
      fsm === undefined ? "-" : esc(fsm.name),
      keyText(fsm?.state),
      keyText(fsm?.prev_state),
      renderValue(fsm?.time ?? 0),
      renderValue(fsm?.state_time ?? 0),
    ),
  );
}

function main(): void {
  const casePath = process.argv[2];
  if (!casePath) {
    process.stderr.write("usage: lfw_trace_base.mjs <case-file>\n");
    process.exit(2);
  }

  for (const raw of readCaseLines(casePath)) {
    const t = splitWs(raw);
    if (t.length === 0) continue;
    const op = t[0]!;
    const idx = [1];

    if (op === "add") {
      const id = t[idx[0]!++]!;
      const keys: string[] = [];
      while (idx[0]! < t.length) keys.push(t[idx[0]!++]!);
      const l = makeListener(id, keys, false);
      byId.set(id, l);
      cb.add(l);
    } else if (op === "once") {
      const id = t[idx[0]!++]!;
      const key = t[idx[0]!++]!;
      const l = makeListener(id, [key], true);
      byId.set(id, l);
      cb.add(l);
    } else if (op === "on") {
      const id = t[idx[0]!++]!;
      const key = t[idx[0]!++]!;
      const l = makeListener(id, [key], false);
      byId.set(id, l);
      cb.add(l);
    } else if (op === "del") {
      const id = t[idx[0]!++]!;
      const l = byId.get(id);
      if (l !== undefined) cb.del(l);
    } else if (op === "clear") {
      cb.clear();
    } else if (op === "call") {
      const key = t[idx[0]!++]!;
      const args: unknown[] = [];
      while (idx[0]! < t.length) args.push(parseValue(t, idx));
      cb.call(key, ...(args as never[]));
    } else if (op === "keys") {
      out.push(line("KS", ...Array.from((cb as any)._map.keys()).map((k: string) => esc(k))));
    } else if (op === "count") {
      const key = t[idx[0]!++]!;
      out.push(line("CNT", key, (cb as any)._map.get(key)?._set.size ?? 0));
    } else if (op === "pend") {
      const key = t[idx[0]!++]!;
      out.push(line("PEND", key, (cb as any)._map.get(key)?._pendings.length ?? 0));
    } else if (op === "loop") {
      reemitKey = t[idx[0]!++]!;
    } else if (op === "selfadd") {
      selfAddId = t[idx[0]!++]!;
      selfAddKey = t[idx[0]!++]!;
    } else if (op === "stoploop") {
      reemitKey = "";
    } else if (op === "mtseed") {
      mt.reset(Number(t[idx[0]!++]!));
    } else if (op === "mdraw") {
      const lo = Number(t[idx[0]!++]!);
      const hi = Number(t[idx[0]!++]!);
      out.push(line("MD", bitsHex(mt.range(lo, hi))));
    } else if (op === "mmark") {
      out.push("MM " + esc(mt.mark));
    } else if (op === "frame") {
      frame.width = Number(t[idx[0]!++]!);
      frame.height = Number(t[idx[0]!++]!);
      frame.centerx = Number(t[idx[0]!++]!);
      frame.centery = Number(t[idx[0]!++]!);
    } else if (op === "gf") {
      // `World::gen_field`（`lfw/entity/gen_field.cpp`）：TS 是 `__gen_*` 上的函数对象，
      // 端口是「闭包侧表 + `gen_*` 现编译」两条。`e` 用当前 `opoint`、`ice`/`smoke` 用
      // 引擎自己造的那两个对象（闭包型）。
      const which = t[idx[0]!++]!;
      const field = t[idx[0]!++]!;
      let holder: any;
      if (which === "e") holder = opoint;
      else if (which === "ice") holder = spawn_ice_piece("130");
      else if (which === "smoke") holder = make_buring_smoke(1).action;
      else { process.stderr.write(`unknown gf holder '${which}'\n`); process.exit(2); }
      let got: number | undefined;
      if (holder && typeof holder[field]?.get === "function") {
        got = holder[field].get(fake);
      } else if (holder && typeof holder[field.slice(2)] === "string" && holder[field.slice(2)]) {
        const e = new ValExpression(holder[field.slice(2)], { tag: field.slice(2) });
        if (e.err === undefined) got = e.get(fake);
      }
      out.push(line("GF", which, field, got === undefined ? "u" : bitsHex(got as number)));
    } else if (op === "var") {
      const name = t[idx[0]!++]!;
      const v = Number(t[idx[0]!++]!);
      customVars[name] = () => v;
    } else if (op === "varclr") {
      for (const k of Object.keys(customVars)) delete customVars[k];
    } else if (op === "x" || op === "xt") {
      const tag = op === "xt" ? t[idx[0]!++]! : undefined;
      const src = t.slice(idx[0]!).join(" ");
      vexprs.push(
        new ValExpression(src, tag === undefined ? { vars: customVars } : { tag, vars: customVars }),
      );
      veDump(vexprs.length - 1);
    } else if (op === "xw") {
      let src = "";
      while (idx[0]! < t.length) src += String.fromCharCode(parseInt(t[idx[0]!++]!, 16));
      vexprs.push(new ValExpression(src, { vars: customVars }));
      veDump(vexprs.length - 1);
    } else if (op === "get") {
      const times = idx[0]! < t.length ? Number(t[idx[0]!++]!) : 1;
      veGet(vexprs.length - 1, times);
    } else if (op === "dump") {
      veDump(Number(t[idx[0]!++]!));
    } else if (op === "po") {
      opoint = {};
      out.push("PO");
    } else if (op === "ps") {
      const key = t[idx[0]!++]!;
      const v = parseValue(t, idx);
      opoint[key] = v;
      out.push(line("PS", esc(key), renderValue(v)));
    } else if (op === "pc") {
      opointCompile();
    } else if (op === "pctx") {
      const which = t[idx[0]!++]!;
      const v = parseValue(t, idx);
      if (which === "data") pctx_data = v;
      else pctx_frame = v;
      out.push(line("PX", which, renderValue(v)));
    } else if (op === "pget") {
      const key = t[idx[0]!++]!;
      out.push(line("PE", esc(key), key in opoint ? renderValue(opoint[key]) : "u"));
    } else if (op === "pkeys") {
      out.push(line("PK", ...Object.keys(opoint).map((k) => esc(k))));
    } else if (op === "fire") {
      fireAny();
    } else if (op === "clk") {
      const sub = t[idx[0]!++]!;
      if (sub === "set") {
        fakeClock.value = Number(t[idx[0]!++]!);
      } else if (sub === "adv") {
        fakeClock.value += Number(t[idx[0]!++]!);
      } else if (sub === "hidden") {
        fakeClock.hid = t[idx[0]!++]! === "1";
      } else if (sub === "pend") {
        out.push(line("PEND", "clock=" + fakeClock.pending.size, "tout=" + fakeTimeout.pending.size));
      } else {
        process.stderr.write(`unknown clk sub '${sub}'\n`);
        process.exit(2);
      }
    } else if (op === "tk") {
      const sub = t[idx[0]!++]!;
      if (sub === "new") {
        tkStep = Number(t[idx[0]!++]!);
        tkSpent = 0;
        tkSteps = 0;
        tkInside = "";
        // 开一段新的：宿主把两个待发队列丢掉（用例因此可以逐段独立读）。
        fakeClock.pending.clear();
        fakeTimeout.pending.clear();
        ticker = new Ticker(tkOpt);
      } else if (sub === "stepms") {
        tkStep = Number(t[idx[0]!++]!);
      } else if (sub === "spent") {
        tkSpent = Number(t[idx[0]!++]!);
      } else if (sub === "inside") {
        tkInside = t[idx[0]!++]!;
      } else if (sub === "maxspan") {
        (ticker as any).max_span = Number(t[idx[0]!++]!);
      } else if (sub === "maxlag") {
        (ticker as any).max_lag_steps = Number(t[idx[0]!++]!);
      } else if (sub === "ratewin") {
        (ticker as any).rate_window = Number(t[idx[0]!++]!);
      } else if (sub === "start") {
        ticker!.start();
      } else if (sub === "stop") {
        ticker!.stop();
      } else if (sub === "pause") {
        ticker!.pause();
      } else if (sub === "resume") {
        ticker!.resume();
      } else if (sub === "resync") {
        ticker!.resync(idx[0]! < t.length && t[idx[0]!++]! === "1");
      } else if (sub === "dump") {
        tickerDump();
      } else {
        process.stderr.write(`unknown tk sub '${sub}'\n`);
        process.exit(2);
      }
    } else if (op === "fps") {
      const sub = t[idx[0]!++]!;
      if (sub === "new") {
        fps = idx[0]! < t.length ? new FPS(Number(t[idx[0]!++]!)) : new FPS();
      } else if (sub === "update") {
        fps!.update(Number(t[idx[0]!++]!));
      } else if (sub === "reset") {
        fps!.reset();
      } else if (sub === "dump") {
        fpsDump();
      } else {
        process.stderr.write(`unknown fps sub '${sub}'\n`);
        process.exit(2);
      }
    } else if (op === "fsm") {
      const sub = t[idx[0]!++]!;
      if (sub === "init") {
        fsm = new FSM<string, IState<string>>(t[idx[0]!++]!);
        fsm.log = (msg: string) => {
          out.push("LOG " + esc(msg));
        };
      } else if (sub === "state") {
        const key = t[idx[0]!++]!;
        const name = t[idx[0]!++]!;
        const target = t[idx[0]!++]!;
        const k = keyValue(key);
        fsm!.add({
          key: k,
          name: name === "~" ? undefined : name,
          update: target === "~" ? undefined : () => target,
          enter: () => {
            out.push("E " + key);
          },
          leave: () => {
            out.push("LV " + key);
          },
        } as IState<string>);
      } else if (sub === "use") {
        fsm!.use(keyValue(t[idx[0]!++]!) as never);
      } else if (sub === "reset") {
        fsm!.reset(keyValue(t[idx[0]!++]!) as never);
      } else if (sub === "update") {
        const dt = Number(t[idx[0]!++]!);
        const times = Number(t[idx[0]!++]!);
        for (let k = 0; k < times; k++) fsm!.update(dt);
      } else if (sub === "listen") {
        const id = t[idx[0]!++]!;
        fsm!.callbacks.on("on_state_changed", (f: FSMType<string, IState<string>>) => {
          out.push(line("S", id, esc(f.name), keyText(f.state)));
        });
      } else if (sub === "dump") {
        fsmDump("F");
      } else if (sub === "snap") {
        snap = fsm!.to_snapshot();
        fsmDump("SN");
      } else if (sub === "restore") {
        if (snap !== undefined) fsm!.from_snapshot(snap);
        fsmDump("F");
      } else {
        process.stderr.write(`unknown fsm sub '${sub}'\n`);
        process.exit(2);
      }
    } else if (op === "gtt") {
      // `gtt <team> [<fallback>]`：team 是 JS 字符串字面量（`""` = Independent 的键）；
      // fallback 不写 = TS 的「没传」（走默认值），写了就是显式值（`""` 也算显式）。
      const team = parseJsStringLiteral(t[idx[0]!++]!);
      const hasFallback = idx[0]! < t.length;
      const fallback = hasFallback ? parseJsStringLiteral(t[idx[0]!++]!) : undefined;
      const color =
        fallback === undefined ? get_team_text_color(team) : get_team_text_color(team, fallback);
      out.push(line("GTT", esc(team), fallback === undefined ? "-" : esc(fallback), esc(color)));
    } else if (op === "gto") {
      const team = parseJsStringLiteral(t[idx[0]!++]!);
      out.push(line("GTO", esc(team), esc(get_team_outline_color(team))));
    } else if (op === "gsf") {
      const hex = t[idx[0]!++]!;
      out.push(line("GSF", hex, esc(get_short_file_size_txt(f64FromBits(BigInt("0x" + hex))))));
    } else {
      process.stderr.write(`unknown op '${op}'\n`);
      process.exit(2);
    }
  }

  process.stdout.write(out.join("\n") + (out.length ? "\n" : ""));
}

main();
