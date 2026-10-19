// `LFW`（门面 4AB）的 TS 侧台面，op 与 `subjects/lfw.cpp` 一一对应。
//
// 4D2 新增 op（两侧同名同义，见 C++ 侧头注）：`cmd`（走真 `CMDS.handle`）、
// `flpage`（把 `lfw.layers` 的节点别名进 `tnodes`）、`ptcur`（读 `get_pointer_cursors`）、
// `kkey`（挂载键的 `KeyStatus`）、`ctrlq`（傀儡控制器队列）。
//
// `Ditto` 的宿主包全脚本化（Sounds/ImageMgr/Keyboard/Pointings/UIInputHandle/WorldRender/
// Cache/Zip/Clock/Render/Timeout/…）；`Date.now` 固定成 12345（端口侧 `host.now()`）。
import { Ditto } from "../../../../src/LFW/ditto/Instance";
import { CMDS, get_pointer_cursors } from "../../../../src/LFW/cmds";
import { is_human_ctrl } from "../../../../src/LFW/entity/type_check";
import { Defines, GameMode, is_survival_rank_mode } from "../../../../src/LFW/defines";
import { ImageInfo } from "../../../../src/LFW/ditto";
import { Expression } from "../../../../src/LFW/base/Expression";
import { Factory } from "../../../../src/LFW/Factory";
import { LFW } from "../../../../src/LFW/LFW";
import { LocalController } from "../../../../src/LFW/controller/LocalController";
import { Randoming } from "../../../../src/LFW/helper/Randoming";
import { MersenneTwister } from "../../../../src/LFW/utils/math/MersenneTwister";
import { clamp } from "../../../../src/LFW/utils/math/clamp";
import { float_equal } from "../../../../src/LFW/utils/math/float_equal";
import { get_val_getter_from_stage } from "../../../../src/LFW/loader/get_val_getter_from_stage";
import { PlayerInfo } from "../../../../src/LFW/PlayerInfo";
import { Stage } from "../../../../src/LFW/stage/Stage";
import { cook_ui_info, find_ui_template, merge_ui_template } from "../../../../src/LFW/ui/cook_ui_info";
import { LFWKeyEvent } from "../../../../src/LFW/ui/LFWKeyEvent";
import { LFWPointerEvent } from "../../../../src/LFW/ui/LFWPointerEvent";
import { UIImgLoader } from "../../../../src/LFW/ui/UIImgLoader";
import { Style } from "../../../../src/LFW/ui/Style";
import { UILayers, type IPopPageOpts, type UILayer } from "../../../../src/LFW/ui/UILayer";
import { actor } from "../../../../src/LFW/ui/action/Actor";
import { UIComponent } from "../../../../src/LFW/ui/component/UIComponent";
import { SmoothNumber } from "../../../../src/LFW/ui/component/SmoothNumber";
import { TextInput } from "../../../../src/LFW/ui/component/TextInput";
import { PlayerName } from "../../../../src/LFW/ui/component/PlayerName";
import { PlayerTeamName } from "../../../../src/LFW/ui/component/PlayerTeamName";
import { FighterName } from "../../../../src/LFW/ui/component/FighterName";
import { IntegerPicker } from "../../../../src/LFW/ui/component/IntegerPicker";
import { Alignment } from "../../../../src/LFW/ui/component/Alignment";
import { Players } from "../../../../src/LFW/ui/component/Players";
import { Sounds } from "../../../../src/LFW/ui/component/Sounds";
import { LabelButton } from "../../../../src/LFW/ui/component/LabelButton";
import { PlayerCtrlType } from "../../../../src/LFW/ui/component/PlayerCtrlType";
import { WeaponRain } from "../../../../src/LFW/ui/component/WeaponRain";
import { FighterHead } from "../../../../src/LFW/ui/component/FighterHead";
import { FighterThumb } from "../../../../src/LFW/ui/component/FighterThumb";
import { ComponentsPlayer } from "../../../../src/LFW/ui/component/ComponentsPlayer";
import { StageSwitcher } from "../../../../src/LFW/ui/component/StageSwitcher";
import { BackgroundSwitcher } from "../../../../src/LFW/ui/component/BackgroundSwitcher";
import { Flex } from "../../../../src/LFW/ui/component/Flex";
import { Jalousie } from "../../../../src/LFW/ui/component/Jalousie";
import { Dialogs } from "../../../../src/LFW/ui/component/Dialogs";
import { BGMSwitcher } from "../../../../src/LFW/ui/component/BGMSwitcher";
import { SliderHandle } from "../../../../src/LFW/ui/component/Slider/SliderHandle";
import { ArrowSwitcher } from "../../../../src/LFW/ui/component/Slider/ArrowSwitcher";
import { ScrollView } from "../../../../src/LFW/ui/component/ScrollView";
import { Entity } from "../../../../src/LFW/entity/Entity";
import { SummaryLogic } from "../../../../src/LFW/ui/component/SummaryLogic";
import { make_sum_info } from "../../../../src/LFW/ui/component/make_sum_info";
import { FighterStatBar } from "../../../../src/LFW/ui/component/FighterStatBar";
import { CameraCtrl } from "../../../../src/LFW/ui/component/CameraCtrl";
import { CharMenuLogic } from "../../../../src/LFW/ui/component/CharMenu/CharMenuLogic";
import { LaunchPage } from "../../../../src/LFW/ui/component/LaunchPageLogic";
import { ActionDirector } from "../../../../src/LFW/director/ActionDirector";
import { DanmuGameLogic } from "../../../../src/LFW/ui/component/DanmuGameLogic";
import { LittleFunnyAutoGame } from "../../../../src/LFW/ui/component/LittleFunnyAutoGame";
import { SineOpacity } from "../../../../src/LFW/ui/component/SineOpacity";
import { FadeOutOpacity } from "../../../../src/LFW/ui/component/FadeOutOpacity";
import { OpacityAnimation } from "../../../../src/LFW/ui/component/OpacityAnimation";
import { ScaleAnimation } from "../../../../src/LFW/ui/component/ScaleAnimation";
import { PositionAnimation } from "../../../../src/LFW/ui/component/PositionAnimation";
import { ImgLoop } from "../../../../src/LFW/ui/component/ImgLoop";
import { PlayerScore } from "../../../../src/LFW/ui/component/PlayerScore";
import { summary_mgr } from "../../../../src/LFW/entity/SummaryMgr";
import { FSM } from "../../../../src/LFW/base/FSM";
import { ModeState } from "../../../../src/LFW/ui/component/ModeState";
import {
  GameModeFSMState_Running,
  GameModeFSMState_BeforeEnd,
  GameModeFSMState_End,
} from "../../../../src/LFW/ui/component/GameModeFSMState";
import { UINode } from "../../../../src/LFW/ui/UINode";
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
// 4AX：SmoothNumber 脚本。
const smooths = new Map<string, SmoothNumber>();
const flush_microtasks = async (): Promise<void> => {
  for (let k = 0; k < 12; k++) await Promise.resolve();
};
// 4AN：UINode 脚本。
const tnodes = new Map<string, UINode>();
// 4BQ：`ncomp` 创建的真组件（保引用防 GC）。
const g_ncomps: Rec[] = [];
// 4BU：ActionDirector 台面实例池。
const g_ads = new Map<string, ActionDirector>();

// 4BV：DanmuGameLogic 台面取件。
const danmu_of = (nid: string): DanmuGameLogic | undefined => {
  const n = tnodes.get(nid)!;
  for (const c of n.components) if (c instanceof DanmuGameLogic) return c as DanmuGameLogic;
  return undefined;
};

// 4AP：真 `UILayers`（台面直建，与 `lfw.layers` 的补丁面互不干扰）。
const real_layers: { v: UILayers | null } = { v: null };

function tree_str(n: UINode): string {
  let s = `${String(n.id ?? "u")}(${n.children.length})`;
  if (n.children.length) s += "[" + n.children.map((c) => tree_str(c as UINode)).join(",") + "]";
  return s;
}

function nref(p: UINode | undefined | null): string {
  return p ? renderValue(p.id) : "u";
}

// 4AS：台面假组件（与 C++ 侧 `bench::FakeComp` 逐字同日志）。
function iref(v: unknown): string {
  if (v instanceof UINode) return "node:" + String(v.id);
  if (v instanceof UIComponent) return "comp:" + (v as Rec).f_name + "#" + (v as Rec).id;
  return renderValue(v);
}

class FakeComponent extends UIComponent<any> {
  static readonly TAGS = ["FakeComp"];
  static readonly PROPS = {
    n: { key: "n", type: "number" },
    s: { key: "s", type: "string" },
    pick: { key: "pick", type: "string", nullable: true },
    ok: { key: "ok", type: "boolean", nullable: true },
    arr: { key: "arr", type: "array", nullable: true, items: { key: "arr", type: "number" } },
    strs: { key: "strs", type: "array", nullable: true, items: { key: "strs", type: "string" } },
    b0: { key: "b0", type: "string", nullable: true },
    sub: { key: "sub", type: UINode },
    other: { key: "other", type: UIComponent },
    stop_click: { key: "stop_click", type: "boolean", nullable: true },
    stop_key: { key: "stop_key", type: "string", nullable: true },
    del_at: { key: "del_at", type: "number", nullable: true },
  };
  private _updates = 0;
  // 4BK：FSM 宿主（`GameModeFSMState` 的 `owner.fsm`）。
  fsm?: Rec;
  private tag(): string {
    return `fc|${this.f_name}`;
  }
  dump(): void {
    const f = `${this.tag()}|props`;
    try {
      void this.props;
    } catch (e) {
      push(`${f}|err|${((e as Rec).errors ?? []).join("|")}`);
      return;
    }
    const h = this.props_holder;
    let line = `${f}|n=${renderValue(h.num("n"))}|s=${renderValue(h.str("s"))}|pick=${renderValue(
      h.str("pick", ["a", "b"])
    )}|ok=${renderValue(h.bool("ok"))}`;
    try {
      const a = h.nums("arr", 2);
      line += `|arr=${a ? a.join(",") : "z"}`;
    } catch {
      line += "|arr=err";
    }
    const ss = h.strs("strs");
    line += `|strs=${ss ? ss.join("+") : "z"}`;
    const ls = h.strs("s");
    line += `|lstrs=${ls ? ls.join("+") : "z"}`;
    line += `|b0=${renderValue(h.bool("b0"))}`;
    line += `|sub=${iref((this.props as Rec).sub)}|other=${iref((this.props as Rec).other)}`;
    push(line);
  }
  override init(): void {
    push(`${this.tag()}|init|${this.id}`);
  }
  override on_add(): void {
    push(`${this.tag()}|add|${this.id}`);
    this.dump();
  }
  override on_del(): void {
    push(`${this.tag()}|del|${this.id}`);
  }
  override on_start(): void {
    push(`${this.tag()}|start`);
    push(`${this.tag()}|lrud|${this.LR},${this.UD}`);
  }
  override on_stop(): void {
    push(`${this.tag()}|stop`);
  }
  override on_resume(): void {
    push(`${this.tag()}|resume`);
    push(`${this.tag()}|lrud|${this.LR},${this.UD}`);
  }
  override on_pause(): void {
    push(`${this.tag()}|pause`);
  }
  override on_show(): void {
    push(`${this.tag()}|show`);
  }
  override on_hide(): void {
    push(`${this.tag()}|hide`);
  }
  override on_foucs(): void {
    push(`${this.tag()}|foucs`);
  }
  override on_blur(): void {
    push(`${this.tag()}|blur`);
  }
  override on_click(e: LFWPointerEvent): void {
    push(`${this.tag()}|click|${num(e.button)}`);
    if (this.props_holder.bool("stop_click")) e.stop_immediate_propagation();
  }
  override on_key_down(e: LFWKeyEvent): void {
    push(`${this.tag()}|kdown|${renderValue(e.game_key)}`);
    if (this.props_holder.str("stop_key") === e.game_key) e.stop_immediate_propagation();
  }
  override on_key_up(e: LFWKeyEvent): void {
    push(`${this.tag()}|kup|${renderValue(e.game_key)}`);
  }
  override on_pointer_down(): void {
    push(`${this.tag()}|pdown`);
  }
  override on_pointer_move(): void {
    push(`${this.tag()}|pmove`);
  }
  override on_pointer_up(): void {
    push(`${this.tag()}|pup`);
  }
  override on_pointer_cancel(): void {
    push(`${this.tag()}|pcancel`);
  }
  override on_pointer_leave(): void {
    push(`${this.tag()}|pleave`);
  }
  override on_pointer_enter(): void {
    push(`${this.tag()}|penter`);
  }
  override update(): void {
    this._updates += 1;
    push(`${this.tag()}|update|${num(this._updates)}`);
    if (this.props_holder.num("del_at") === this._updates) {
      push(`${this.tag()}|delreq`);
      this.node.del_components(this);
    }
  }
}

Factory.register_component(FakeComponent as never);

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
  // 4BG：切换器夹具。索引条目是**文件描述**（`{id,file}` / 路径串），真内容走 `imp` 缝。
  const bg_fixture = (id: string, name: string, group: string | null, left = 0, right = 1588, far = -40) => ({
    type: "background",
    id,
    base: {
      name,
      shadow: "",
      height: 550,
      left,
      right,
      far,
      near: 0,
      group: group ? [group] : [],
    },
    layers: [],
  });
  const stage_fixture = (
    id: string,
    name: string,
    bg_id: string,
    group: string | null,
    start_name: string | null,
    phases: Rec[] = [],
  ) => ({
    id,
    name,
    bg: bg_id,
    ...(start_name !== null ? { is_starting: true, starting_name: start_name } : {}),
    group: group ? [group] : [],
    phases,
  });
  if (k === "bgr") return bg_fixture("bg_reg", "B1", "regular");
  if (k === "bgh") return bg_fixture("bg_hid", "B2", "hidden", 50, 1500, -70);
  if (k === "bgo") return bg_fixture("bg_oth", "B3", null, -100, 1700, -90);
  // `data.stages` 的条目是 `{file, skipped}` 描述符；文件内容是**列表**。
  if (k === "srg") return [stage_fixture("st_reg", "S1", "bg_reg", null, "SR")];
  if (k === "srh") return [stage_fixture("st_hid", "S2", "bg_hid", "hidden", "SH")];
  if (k === "srd") return [stage_fixture("st_dev", "S3", "bg_oth", "Dev", "DD")];
  // 4BR：可选入池的“正常起始舞台”（分组非 hidden/非 Dev + is_starting），带阶段动作。
  if (k === "srx") {
    const s0 = stage_fixture("st_demo", "SD", "bg_reg", "reg", "SD", [
      { on_start: ["gogogo_right"], on_end: ["loop_gogogo_right"] },
      { on_start: ["loop_gogogo_right"], on_end: ["gogogo_right"] },
    ]) as Rec;
    s0.next = "st_demo2";
    return [s0, stage_fixture("st_demo2", "SD2", "bg_reg", "reg", null)];
  }
  if (k === "swf") {
    return {
      backgrounds: [
        { id: "bg_reg", file: "bg/reg.json5" },
        { id: "bg_hid", file: "bg/hid.json5" },
        { id: "bg_oth", file: "bg/oth.json5" },
      ],
      stages: [{ file: "st/reg.json5" }, { file: "st/hid.json5" }, { file: "st/dev.json5" }, { file: "st/srv.json5" }],
    };
  }
  if (k === "ftr") {
    // ⚠ 不带 head：端口预处理不落图片任务 ⇒ 带 head 会多 img:load 漂移。
    return { id: "fg1", type: 8, base: { name: "FIGHTER ONE" }, frames: [] };
  }
  if (k === "idg") {
    return {
      objects: [{ id: "fg1", file: "data/fg1.json5" }],
    };
  }
    // 4BR：带分组的角色夹具（DemoModeLogic 的抽签池）。
    if (k === "lfa") return { id: "lfa", type: 8, base: { name: "FA", group: ["1000"], bg_face: "sprite/FA.png" }, frames: [] };
    if (k === "lfb") return { id: "lfb", type: 8, base: { name: "FB", group: ["Boss"] }, frames: [] };
    // 4BR：oid 情景（DemoMode 的 oids 表用数字 id）需要可解析的实体数据。
    if (k === "f51") return { id: "51", type: 8, base: { name: "FZ", group: ["Boss"] }, frames: [] };
    if (k === "f50") return { id: "50", type: 8, base: { name: "LE", group: ["Boss"] }, frames: [] };
    // 4BS：CharMenu 随机池夹具（含 hidden/Dev 分组与 bg_face）。
    if (k === "lfc" || k === "lfd" || k === "lfe") {
      const nm = k === "lfc" ? "FC" : k === "lfd" ? "FD" : "FE";
      const group = ["1000", ...(k === "lfd" ? ["hidden"] : k === "lfe" ? ["Dev"] : [])];
      return { id: k, type: 8, base: { name: nm, group, bg_face: `sprite/${nm}.png` }, frames: [] };
    }
    if (k === "lfj" || k === "lfz") {
      const no_name = k === "lfz";
      const base: Rec = { group: ["1000"], bg_face: no_name ? "sprite/FZ.png" : "!sprite/RFACE@4x.png" };
      if (!no_name) base.name = "FJ";
      if (!no_name) base.head = null;
      return { id: no_name ? "lfz" : "2", type: 8, base, frames: [] };
    }
    if (k === "lfx") {
      return { id: "lfx", type: 8, base: { name: "FX", group: ["1000"], bg_face: null }, frames: [] };
    }
    // 4BU：LFAG 士兵池（group "3000"，ce 控制双方士兵数量差；lf3d 无 ce 走缺省 1）。
    if (k === "lf3a" || k === "lf3b" || k === "lf3c" || k === "lf3d") {
      const nm = k === "lf3a" ? "G1" : k === "lf3b" ? "G2" : k === "lf3c" ? "G3" : "G4";
      const ce = k === "lf3a" ? 1 : k === "lf3b" ? 2 : k === "lf3c" ? 3 : 0;
      const base: Rec = { name: nm, group: ["3000"] };
      if (ce !== 0) base.ce = ce;
      return {
        id: k,
        type: 8,
        base,
        frames: { running_0: { id: "running_0", state: 1, wait: 2 } },
      };
    }
    if (k === "lfy") {
      return { id: "4", type: 8, base: { name: "FY", group: ["1000"], bg_face: null }, frames: [] };
    }
    // 4BS：生存舞台夹具（主路 = chapter=survival + is_starting；回退路 = id "50"）。
    if (k === "srv") {
      const make_stage = (id: string, name: string, bg_id: string, chapter: string | null) => ({
        id,
        name,
        bg: bg_id,
        is_starting: true,
        starting_name: name,
        ...(chapter !== null ? { chapter } : {}),
        group: ["reg"],
        phases: [],
      });
      return [
        make_stage("st_srv", "SV", "bg_reg", "survival"),
        make_stage("50", "F50", "bg_oth", null),
      ];
    }
    // 4BV：弹幕互动的模板 / 常规池 / 场景（`_start_coop_stage` 的择优、排除与回退）。
    if (k === "r1" || k === "r2") {
      const nm = k === "r1" ? "RA" : "RB";
      return {
        id: k,
        type: 8,
        base: { name: nm, group: ["1000"] },
        frames: { waiting: { id: "waiting", state: 0, wait: 2 } },
      };
    }
    if (k === "tmpl") {
      return {
        id: "0",
        type: 8,
        base: { name: "TP", group: ["hidden"] },
        frames: { waiting: { id: "waiting", state: 0, wait: 2 } },
      };
    }
    if (k === "sd11") {
      const st = stage_fixture("st_11", "1-1", "bg_reg", null, null) as Rec;
      st.next = "st_reg";
      return [st];
    }
    if (k === "sdreg") return [stage_fixture("st_reg", "S1", "bg_reg", null, "SR")];
    if (k === "sddev") return [stage_fixture("st_dev", "S3", "bg_reg", "Dev", "DD")];
    if (k === "sdhid") return [stage_fixture("st_hid", "S2", "bg_reg", "hidden", "SH")];
    if (k === "sdsurv") {
      const st = stage_fixture("st_surv", "SV", "bg_reg", null, "SV") as Rec;
      st.chapter = "survival";
      return [st];
    }
    if (k === "idso") {
      return {
        objects: [
          { id: "0", file: "data/tmpl.json5" },
          { id: "lfa", file: "data/lfa.json5" },
          { id: "r1", file: "data/r1.json5" },
          { id: "r2", file: "data/r2.json5" },
        ],
        backgrounds: [{ id: "bg_reg", file: "bg/reg.json5" }],
      };
    }
    if (k === "idsd" || k === "idsdnov" || k === "idsdc") {
      const stage_file = (path: string) => ({ file: path });
      const stages: Rec[] = [];
      if (k === "idsd") stages.push(stage_file("sd/11.json5"));
      stages.push(stage_file("sd/dev.json5"));
      stages.push(stage_file("sd/hid.json5"));
      stages.push(stage_file("sd/surv.json5"));
      if (k !== "idsdc") stages.push(stage_file("sd/reg.json5"));
      return { stages };
    }
    if (k === "idg3") {
      return {
        objects: [
          { id: "lf3a", file: "data/lf3a.json5" },
          { id: "lf3b", file: "data/lf3b.json5" },
          { id: "lf3c", file: "data/lf3c.json5" },
          { id: "lf3d", file: "data/lf3d.json5" },
        ],
      };
    }
    if (k === "idg2" || k === "idg2c") {
      return {
        objects: [
          { id: "lfa", file: "data/lfa.json5" },
          { id: "lfb", file: "data/lfb.json5" },
          { id: "51", file: "data/f51.json5" },
          { id: "50", file: "data/f50.json5" },
          ...(k === "idg2c" ? [
            { id: "lfc", file: "data/lfc.json5" },
            { id: "lfd", file: "data/lfd.json5" },
            { id: "lfe", file: "data/lfe.json5" },
            { id: "lfj", file: "data/lfj.json5" },
            { id: "lfz", file: "data/lfz.json5" },
            { id: "lfx", file: "data/lfx.json5" },
            { id: "lfy", file: "data/lfy.json5" },
          ] : []),
        ],
        stages: [{ file: "st/demo.json5" }],
      };
    }
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
    static current?: FakeSounds;
    bgm_name: string | null = null;
    is_random = false;
    readonly callbacks_list: Rec[] = [];
    callbacks = {
      add: (cb: unknown) => {
        if (!this.callbacks_list.includes(cb as Rec)) this.callbacks_list.push(cb as Rec);
        push("snd_cbadd");
      },
      del: (cb: unknown) => {
        const k = this.callbacks_list.indexOf(cb as Rec);
        if (k >= 0) this.callbacks_list.splice(k, 1);
        push("snd_cbdel");
      },
    };
    private _prev_url: string | null = null;
    private rand?: Randoming<string>;
    private readonly _lfw: Rec;
    constructor(lfw_: unknown) {
      FakeSounds.current = this;
      this._lfw = lfw_ as Rec;
      this.rand = new Randoming<string>("bgm_randoming", this._lfw["bgms"] as string[], this._lfw["mt"]);
      snd_probe = () => `${this.bgm_name ?? ""}|${this.is_random ? 1 : 0}`;
      snd_set = (which: string, v: number): void => {
        if (which === "volume") this.set_volume(v);
        else if (which === "bgm_volume") this.set_bgm_volume(v);
        else if (which === "sound_volume") this.set_sound_volume(v);
        else if (which === "bgm_muted") this.set_bgm_muted(!!v);
        else if (which === "sound_muted") this.set_sound_muted(!!v);
      };
      snd_v_probe = (): string =>
        `sndv|${num(this.volume())}|${num(this.bgm_volume())}|${num(this.sound_volume())}|${this.bgm_muted() ? 1 : 0}|${this.sound_muted() ? 1 : 0}`;
      push("snd_init");
    }
    private fire(bgm: string | null, prev: string | null): void {
      for (const cb of [...this.callbacks_list]) cb.on_bgm_changed?.(bgm, prev, this);
    }
    bgm(): string | null {
      return this.bgm_name;
    }
    dispose(): void {
      this.callbacks_list.length = 0;
      push("snd_dispose");
    }
    // 4BR：音量/静音族（照 `__Modern`：clamp 0..1、同值早退、变更后发事件）。
    volume_v = 0.3;
    bgm_volume_v = 0.5;
    sound_volume_v = 1;
    bgm_muted_v = false;
    sound_muted_v = false;
    private fire_ev(name: string, ...args: unknown[]): void {
      for (const cb of [...this.callbacks_list]) {
        const fn = cb[name] as ((...a: unknown[]) => void) | undefined;
        fn?.(...args, this);
      }
    }
    volume(): number {
      return this.volume_v;
    }
    set_volume(v: number): void {
      v = clamp(v, 0, 1);
      const prev = this.volume_v;
      if (float_equal(v, prev)) return;
      this.volume_v = v;
      this.fire_ev("on_volume_changed", v, prev);
    }
    bgm_volume(): number {
      return this.bgm_volume_v;
    }
    set_bgm_volume(v: number): void {
      v = clamp(v, 0, 1);
      const prev = this.bgm_volume_v;
      if (float_equal(v, prev)) return;
      this.bgm_volume_v = v;
      this.fire_ev("on_bgm_volume_changed", v, prev);
    }
    sound_volume(): number {
      return this.sound_volume_v;
    }
    set_sound_volume(v: number): void {
      v = clamp(v, 0, 1);
      const prev = this.sound_volume_v;
      if (float_equal(v, prev)) return;
      this.sound_volume_v = v;
      this.fire_ev("on_sound_volume_changed", v, prev);
    }
    bgm_muted(): boolean {
      return this.bgm_muted_v;
    }
    set_bgm_muted(v: boolean): void {
      if (v === this.bgm_muted_v) return;
      this.bgm_muted_v = v;
      this.fire_ev("on_bgm_muted_changed", v);
    }
    sound_muted(): boolean {
      return this.sound_muted_v;
    }
    set_sound_muted(v: boolean): void {
      if (v === this.sound_muted_v) return;
      this.sound_muted_v = v;
      this.fire_ev("on_sound_muted_changed", v);
    }
    play_bgm(name: string): () => void {
      push("snd_bgm");
      if (this._prev_url === name) return () => undefined;
      const prev = this.bgm_name;
      const real = name === "?" ? (this.rand!.set_src(this._lfw["bgms"] as string[]).get() as string | undefined) : name;
      this.bgm_name = null;
      this._prev_url = null;
      if (!real) return () => undefined;
      this.bgm_name = real;
      this._prev_url = real;
      this.is_random = name === "?";
      this.fire(real, prev);
      return () => undefined;
    }
    stop_bgm(): void {
      if (this.bgm_name === null) return;
      const prev = this.bgm_name;
      this.bgm_name = null;
      this._prev_url = null;
      push("snd_stop");
      this.fire(null, prev);
    }
    play(): void {
      push("snd_play");
    }
    play_with_load(): void {
      push("snd_load");
    }
    load(name: string, src: string): Promise<void> {
      push(`snd_file|${name}|${src}`);
      return Promise.resolve();
    }
    play_preset(name: unknown, x: unknown, y: unknown, z: unknown): void {
      push(`snd_preset|${renderValue(name)}|${renderValue(x)}|${renderValue(y)}|${renderValue(z)}`);
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
    measure_text(text: unknown, style: unknown): unknown {
      const norm = style instanceof Style ? (style as unknown as Rec).data : style;
      push(`measure|${renderValue(text)}|${renderValue(norm)}`);
      const t = String(text ?? "");
      return { text: t, w: t.length * 4, h: 10, scale: 1 };
    }
  }
  class FakeKeyboard {
    readonly callbacks: Rec[] = [];
    callback = {
      add: (cb: unknown) => {
        if (!this.callbacks.includes(cb as Rec)) this.callbacks.push(cb as Rec);
        push("kbd_cbadd");
      },
      del: (cb: unknown) => {
        const k = this.callbacks.indexOf(cb as Rec);
        if (k >= 0) this.callbacks.splice(k, 1);
        push("kbd_cbdel");
      },
    };
    constructor(_lfw: unknown) {
      kbd_dispatch = (dir, e) => {
        for (const cb of [...this.callbacks]) {
          if (dir === "down") cb.on_key_down?.(e);
          else cb.on_key_up?.(e);
        }
      };
      push("kbd_init");
    }
    dispose(): void {
      this.callbacks.length = 0;
      push("kbd_dispose");
    }
  }
  class FakePointings {
    readonly callbacks: Rec[] = [];
    // 4BN：`__Pointings` 的抢焦点状态（世代 + 持有者）。
    _grab_prev_epoch = -1;
    _grab_epoch = 0;
    _grabbing: unknown = undefined;
    get grabbing(): unknown {
      return this._grabbing !== void 0 && this._grab_prev_epoch === this._grab_epoch
        ? this._grabbing
        : void 0;
    }
    grab(who: unknown): boolean {
      if (
        this._grabbing !== void 0 &&
        this._grabbing !== who &&
        this._grab_prev_epoch === this._grab_epoch
      ) {
        push("pt_grab|0");
        return false;
      }
      this._grabbing = who;
      this._grab_prev_epoch = this._grab_epoch;
      push("pt_grab|1");
      return true;
    }
    ungrab(who: unknown): void {
      if (this._grabbing === who) {
        this._grabbing = void 0;
        push("pt_ungrab");
      }
    }
    grab_begin(): void {
      ++this._grab_epoch;
    }
    callback = {
      add: (cb: unknown) => {
        if (!this.callbacks.includes(cb as Rec)) this.callbacks.push(cb as Rec);
        push("pt_cbadd");
      },
      del: (cb: unknown) => {
        const k = this.callbacks.indexOf(cb as Rec);
        if (k >= 0) this.callbacks.splice(k, 1);
        push("pt_cbdel");
      },
    };
    constructor() {
      pt_dispatch = (what, e, noBump) => {
        // 真实平台在 pointer down 里 `grab_begin()`（世代 +1，之后才分发）。
        if (what === "down" && !noBump) this.grab_begin();
        for (const cb of [...this.callbacks]) {
          if (what === "down") cb.on_pointer_down?.(e);
          else if (what === "move") cb.on_pointer_move?.(e);
          else if (what === "up") cb.on_pointer_up?.(e);
          else if (what === "cancel") cb.on_pointer_cancel?.(e);
          else if (what === "wheel") cb.on_wheel?.(e);
          else cb.on_click?.(e);
        }
      };
      push("pt_init");
    }
    dispose(): void {
      this.callbacks.length = 0;
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
    Vector3: class Vec3 {
      x: number;
      y: number;
      z: number;
      constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
      }
      set(x = 0, y = 0, z = 0): unknown {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
      }
      equals(o: Vec3): boolean {
        return this.x === o.x && this.y === o.y && this.z === o.z;
      }
      copy(o: Vec3): Vec3 {
        this.x = o.x;
        this.y = o.y;
        this.z = o.z;
        return this;
      }
      add(o: Vec3): Vec3 {
        this.x += o.x;
        this.y += o.y;
        this.z += o.z;
        return this;
      }
      clone(): Vec3 {
        return new Vec3(this.x, this.y, this.z);
      }
      sub(o: Vec3): Vec3 {
        return new Vec3(this.x - o.x, this.y - o.y, this.z - o.z);
      }
    } as never,
    Vector2: class {
      x = 0;
      y = 0;
    } as never,
    WorldRender: FakeWorldRender as never,
    UINodeRenderer: class {
      constructor(private readonly uinode: UINode) {}
      private ref(): string {
        return nref(this.uinode);
      }
      del_self(): void { push(`rend|del_self|${this.ref()}`); }
      on_start(): void { push(`rend|on_start|${this.ref()}`); }
      on_stop(): void { push(`rend|on_stop|${this.ref()}`); }
      on_resume(): void { push(`rend|on_resume|${this.ref()}`); }
      on_pause(): void { push(`rend|on_pause|${this.ref()}`); }
      on_show(): void { push(`rend|on_show|${this.ref()}`); }
      on_hide(): void { push(`rend|on_hide|${this.ref()}`); }
      on_foucs(): void { push(`rend|on_foucs|${this.ref()}`); }
      on_blur(): void { push(`rend|on_blur|${this.ref()}`); }
    } as never,
    ImageMgr: FakeImageMgr as never,
    UIInputHandle: FakeUIInputHandle as never,
    XML: {} as never,
    warn: (...args: unknown[]) => push("warn|" + args.map((a) => render_value(safe_render(a))).join("~")),
    error: (...args: unknown[]) =>
      push("error|" + args.map((a) => render_value(safe_render(a))).join("~")),
    Log: (...args: unknown[]) => push("Log|" + args.map((a) => render_value(safe_render(a))).join("~")),
    // `warn`/`Log` 走真通道；`debug` 这一侧不收（端口那条走 DESIGN §149.23 的宿主缝）。
    debug: () => undefined,
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
// `FakeKeyboard` / `FakePointings` 在 `install_ditto` 里声明， 用模块级钩子接出分发入口。
let kbd_dispatch: (dir: "down" | "up", e: Rec) => void = () => undefined;
let pt_dispatch: (what: string, e: Rec, noBump?: boolean) => void = () => undefined;
// 假声音的状态探针（`sndbgm` op）：`<bgm>|<is_random>`。
let snd_probe: () => string = () => "|0";
// 4BR：宿主声音 setter/探针（`FakeSounds` 是 `install_ditto` 内的局部类，用闭包变量暴露）。
let snd_set: (which: string, v: number) => void = () => undefined;
let snd_v_probe: () => string = () => "";

function listen(): void {
  for (const name of CB_KEYS) {
    (lfw.callbacks as unknown as Rec).on(name, (...args: unknown[]) => {
      const parts: string[] = [`cb|${name}`];
      if (name === "on_ui_changed") {
        for (const a of args) parts.push(a == null ? "u" : "?");
        push(parts.join("|"));
        return;
      }
      // 4BV：`on_component_broadcast(component, text)` 的 component 带环（C++ 台面同样落 `?`）。
      if (name === "on_component_broadcast") {
        parts.push("?");
        push(parts.join("|"));
        return;
      }
      for (const a of args) {
        if (a === lfw) parts.push("self");
        else if (name === "on_ui_loaded") parts.push(String((a as unknown[]).length));
        else if (name === "on_zips_changed")
          parts.push((a as { name: string }[]).map((v) => v.name).join(","));
        else if (name === "on_broadcast") parts.push("s:" + String(a));
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

function err_msg(e: unknown): string {
  return typeof e === "string" ? e : e instanceof Error ? e.message : String(e);
}

function main(): void {
  install_ditto();
  (Date as unknown as Rec).now = () => 12345;
  Randoming.mt = new MersenneTwister(12345);
  lfw = new LFW(false);
  listen();

  void run_ops().catch((e) => {
    process.stderr.write(log.slice(-14).join("\n") + "\n");
    process.stderr.write((e instanceof Error && e.stack ? e.stack : err_msg(e)) + "\n");
    process.exit(2);
  });
}

async function run_ops(): Promise<void> {
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
      const zips: string[] = [];
      while (i[0]! < t.length) zips.push(nextKey());
      LFW.ZIPS = zips as never;
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
    } else if (op === "camr") {
      const cam = (lfw.world as Rec).camera as Rec;
      const pos = cam.position as Rec;
      push(`camr|${num(pos.x as number)}|${num(pos.y as number)}`);
    } else if (op === "cams") {
      const x = Number(next());
      const y = Number(next());
      const cam = (lfw.world as Rec).camera as Rec;
      const pos = cam.position as Rec;
      pos.x = x;
      pos.y = y;
      push(`cams|${num(x)}|${num(y)}`);
    } else if (op === "sran") {
      const en = next() === "1";
      (lfw as unknown as Rec).survival_rank_available = en;
      push(`sran|${en ? 1 : 0}`);
    } else if (op === "danm") {
      const en = next() === "1";
      (lfw as unknown as Rec).danmu_available = en;
      push(`danm|${en ? 1 : 0}`);
    } else if (op === "pfight") {
      const pid = nextKey();
      const idx = Number(next());
      const arr = Array.from((lfw.world as Rec).entities as Set<Rec>);
      const e = idx >= 0 ? (arr[idx] as Rec | undefined) : undefined;
      const p = lfw.player(pid) as Rec;
      p.fighter = e;
      push(`pfight|${pid}|${e ? (e.id as string) : "-"}`);
    } else if (op === "cdbg") {
      const nid = next();
      const cid = nextKey();
      const n = tnodes.get(nid)!;
      const c = (n.components as Rec[]).find((v) => v.id === cid) as Rec | undefined;
      if (!c || !(c instanceof CameraCtrl)) {
        push(`cdbg|${nid}|none`);
      } else {
        const any = c as unknown as Rec;
        const s = any["staring"] as Rec | undefined;
        push(
          `cdbg|${nid}|a=${any["auto"] ? 1 : 0}|s=${s ? (s["id"] as string) : "-"}|w=${
            s ? num(s["outline_width"] as number) : num(0)
          }|c=${s ? String(s["outline_color"] ?? "") : "-"}`,
        );
      }
    } else if (op === "epos") {
      const idx = Number(nextKey());
      const x = Number(next());
      const z = Number(next());
      const arr = Array.from((lfw.world as Rec).entities as Set<Rec>);
      const e = idx >= 0 && idx < arr.length ? (arr[idx] as Rec | undefined) : undefined;
      if (e) {
        const p = e.position as Rec;
        p.x = x;
        p.z = z;
      }
      push(`epos|${num(idx)}|${num(x)}|${num(z)}`);
    } else if (op === "eol") {
      const idx = Number(nextKey());
      const arr = Array.from((lfw.world as Rec).entities as Set<Rec>);
      const e = idx >= 0 && idx < arr.length ? (arr[idx] as Rec | undefined) : undefined;
      push(
        `eol|${num(idx)}|${
          e ? `w=${num(e["outline_width"] as number)}|c=${String(e["outline_color"] ?? "")}` : "none"
        }`,
      );
    } else if (op === "dsrd") {
      const key = nextKey();
      push(`dsrd|${key}|${renderValue((lfw.world.dataset as Rec)[key])}`);
    } else if (op === "fsuse") {
      const nid = next();
      const cid = nextKey();
      const key = nextKey();
      const n = tnodes.get(nid)!;
      const c = (n.components as Rec[]).find((v) => v.id === cid) as Rec | undefined;
      const f = c ? (c["fsm"] as Rec | undefined) : undefined;
      if (f) (f["use"] as (v: unknown) => void).call(f, key as never);
      push(`fsuse|${nid}|${cid}|${key}`);
    } else if (op === "fsr") {
      const nid = next();
      const cid = nextKey();
      const n = tnodes.get(nid)!;
      const c = (n.components as Rec[]).find((v) => v.id === cid) as Rec | undefined;
      const f = c ? (c["fsm"] as Rec | undefined) : undefined;
      if (!f) {
        push(`fsr|${nid}|none`);
      } else {
        const s = f["state"] as Rec | undefined;
        const pv = f["prev_state"] as Rec | undefined;
        push(
          `fsr|${nid}|${cid}|s=${s ? renderValue(s["key"]) : "-"}|p=${
            pv ? renderValue(pv["key"]) : "-"
          }|t=${num(f["time"] as number)}|st=${num(f["state_time"] as number)}`,
        );
      }
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
      kbd_dispatch("down", e as Rec);
      push(`kbdown|${key}|${num(times)}|${dev}|int=${(e as Rec)["_int"] ? 1 : 0}`);
    } else if (op === "kbup") {
      const key = nextKey();
      const e = { key };
      kbd_dispatch("up", e as Rec);
      push(`kbup|${key}`);
    } else if (op === "ptclick") {
      const btn = Number(nextKey());
      const e = {
        x: 0,
        y: 0,
        scene_x: 0,
        scene_y: 0,
        is_pointing_event: true,
        button: btn,
        delta_x: 0,
        delta_y: 0,
      };
      pt_dispatch("click", e as Rec);
      push(`ptclick|${num(btn)}`);
    } else if (op === "ptev") {
      const what = next();
      const btn = Number(nextKey());
      const x = Number(nextKey());
      const y = Number(nextKey());
      const sx = Number(nextKey());
      const sy = Number(nextKey());
      const e = {
        x,
        y,
        scene_x: sx,
        scene_y: sy,
        is_pointing_event: true,
        button: btn,
        delta_x: 0,
        delta_y: 0,
      };
      pt_dispatch(what, e as Rec);
      push(`ptev|${what}|${num(btn)}|${num(x)}|${num(y)}|${num(sx)}|${num(sy)}`);
    } else if (op === "ptdn") {
      const nid = next();
      const btn = Number(nextKey());
      const x = Number(nextKey());
      const y = Number(nextKey());
      const sx = Number(nextKey());
      const sy = Number(nextKey());
      const ne = new LFWPointerEvent({ x: 0, y: 0, z: 0 }, 0);
      const n = tnodes.get(nid)!;
      (lfw.pointings as unknown as Rec).grab_begin();
      n.on_pointer_down(ne);
      const e = {
        x,
        y,
        scene_x: sx,
        scene_y: sy,
        is_pointing_event: true,
        button: btn,
        delta_x: 0,
        delta_y: 0,
      };
      pt_dispatch("down", e as Rec, true);
      push(`ptdn|${nid}|${num(btn)}|${num(x)}|${num(y)}|${num(sx)}|${num(sy)}`);
    } else if (op === "ptw") {
      const x = Number(nextKey());
      const y = Number(nextKey());
      const sx = Number(nextKey());
      const sy = Number(nextKey());
      const dx = Number(nextKey());
      const dy = Number(nextKey());
      const e = {
        x,
        y,
        scene_x: sx,
        scene_y: sy,
        is_pointing_event: true,
        button: 0,
        delta_x: dx,
        delta_y: dy,
      };
      pt_dispatch("wheel", e as Rec);
      push(`ptw|${num(x)}|${num(y)}|${num(sx)}|${num(sy)}|${num(dx)}|${num(dy)}`);
    } else if (op === "ptg") {
      const g = (lfw.pointings as unknown as Rec).grabbing;
      push(`ptg|${g !== void 0 ? 1 : 0}`);
    } else if (op === "svgeo") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const g = n.geo;
      push(`svgeo|${nid}|${num(g.left)}|${num(g.top)}|${num(g.right)}|${num(g.bottom)}`);
    } else if (op === "svsb") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const p = n.components.find((c) => c instanceof ScrollView) as ScrollView | undefined;
      if (!p) push(`svsb|${nid}|none`);
      else {
        const sb = p.scrollbar;
        const thumb = p.scrollbar_thumb;
        push(
          `svsb|${nid}|sb=${sb ? sb.id : "-"}|th=${thumb ? nref(thumb) : "-"}|raw=${
            p.props_holder.str("scrollbar") ?? "-"
          }`,
        );
      }
    } else if (
      op === "svd" ||
      op === "svto" ||
      op === "svby" ||
      op === "svst" ||
      op === "sven" ||
      op === "svev" ||
      op === "svcb" ||
      op === "svcont"
    ) {
      const nid = next();
      const n = tnodes.get(nid)!;
      const p = n.components.find((c) => c instanceof ScrollView) as ScrollView | undefined;
      if (!p) push(`${op}|${nid}|none`);
      else if (op === "svd") {
        push(
          `svd|${nid}|${num(p.offset)}|${num(p.factor)}|${num(p.max_scroll)}|${
            p.dragging ? 1 : 0
          }|${n.clip_children ? 1 : 0}|${num((p as never as Rec)._target_offset as number)}`,
        );
      } else if (op === "svto") {
        p.scroll_to(Number(nextKey()));
        push(`svto|${nid}|${num(p.offset)}`);
      } else if (op === "svby") {
        p.scroll_by(Number(nextKey()));
        push(`svby|${nid}|${num(p.offset)}`);
      } else if (op === "svst") {
        p.scroll_to_start();
        push(`svst|${nid}|${num(p.offset)}`);
      } else if (op === "sven") {
        p.scroll_to_end();
        push(`sven|${nid}|${num(p.offset)}`);
      } else if (op === "svev") {
        const target = next();
        const ret = p.ensure_visible(tnodes.get(target)!);
        push(`svev|${nid}|${ret ? 1 : 0}|${num(p.offset)}`);
      } else if (op === "svcb") {
        p.on_scroll((o: number, f: number, self: ScrollView) =>
          push(`svcb|scroll|${num(o)}|${num(f)}|${self === p ? 1 : 0}`),
        );
        p.callbacks.add({
          on_scroll_start: (self: ScrollView) =>
            push(`svcb|start|${num(p.offset)}|${num(p.factor)}|${self === p ? 1 : 0}`),
          on_scroll_end: (self: ScrollView) =>
            push(`svcb|end|${num(p.offset)}|${num(p.factor)}|${self === p ? 1 : 0}`),
        });
        push(`svcb|${nid}|bound`);
      } else {
        const target = next();
        p.content = tnodes.get(target)!;
        push(`svcont|${nid}|${target}|${num(p.offset)}`);
      }
    } else if (
      op === "wpp" ||
      op === "ehp" ||
      op === "emp" ||
      op === "eres" ||
      op === "edel" ||
      op === "wrun" ||
      op === "ntick" ||
      op === "sdmg" ||
      op === "skill" ||
      op === "spick" ||
      op === "smlg" ||
      op === "smapx" ||
      op === "sumt" ||
      op === "smk" ||
      op === "sbctrl" ||
      op === "wdt" ||
      op === "edef" ||
      op === "eprobe" ||
      op === "wtime" ||
      op === "elist" ||
      op === "fdbg" ||
      op === "cprb" ||
      op === "fsbe" ||
      op === "camr" ||
      op === "cams" ||
      op === "sran" ||
      op === "danm" ||
      op === "pfight" ||
      op === "cdbg" ||
      op === "fsr" ||
      op === "fsuse" ||
      op === "eol" ||
      op === "dsrd" ||
      op === "epos" ||
      op === "ps"
    ) {
      const w = lfw.world as unknown as Rec;
      const ents = () => Array.from(w.entities as Set<Rec>);
      if (op === "wpp") {
        const pid = nextKey();
        const idx = Number(nextKey());
        const e = idx >= 0 ? (ents()[idx] as Rec | undefined) : undefined;
        const puppets = w.puppets as Map<string, Rec>;
        if (e) puppets.set(pid, e);
        else puppets.delete(pid);
        push(`wpp|${pid}|${e ? 1 : 0}|n=${String(puppets.size)}`);
      } else if (op === "ehp" || op === "emp" || op === "eres") {
        const idx = Number(nextKey());
        const v = Number(nextKey());
        const e = idx >= 0 ? (ents()[idx] as Rec | undefined) : undefined;
        if (e) {
          if (op === "ehp") e.hp = v;
          else if (op === "emp") e.mp = v;
          else e.reserve = v;
        }
        push(
          `${op}|${num(idx)}|${e ? 1 : 0}|hp=${num(e ? e.hp : 0)}|mp=${num(e ? e.mp : 0)}|res=${
            num(e ? e.reserve : 0)
          }`,
        );
      } else if (op === "edel") {
        const idx = Number(nextKey());
        const e = idx >= 0 ? (ents()[idx] as Rec | undefined) : undefined;
        if (e) (w.del_entity as (x: Rec) => void)(e);
        push(`edel|${num(idx)}|${e ? 1 : 0}|n=${num(ents().length)}`);
      } else if (op === "wrun") {
        const n = Number(nextKey());
        for (let k = 0; k < n; ++k) (w.update_once as (dt: number) => void)(16);
        push(`wrun|${num(n)}|n=${num(ents().length)}|paused=${w.paused ? 1 : 0}`);
      } else if (op === "ntick") {
        const nid = next();
        const n = Number(nextKey());
        const nn = tnodes.get(nid)!;
        for (let k = 0; k < n; ++k) nn.update(16);
        push(`ntick|${nid}|lt=${num((nn as never as Rec).lifetime as number)}`);
      } else if (op === "sdmg" || op === "skill" || op === "spick") {
        const idx = Number(nextKey());
        const v = Number(nextKey());
        const e = idx >= 0 ? (ents()[idx] as Rec | undefined) : undefined;
        if (e) {
          if (op === "sdmg") summary_mgr.add_damage_sum(e as never, v);
          else if (op === "skill") summary_mgr.add_kill_sum(e as never, v);
          else summary_mgr.get(e.id as string).picking_sum += v;
        }
        push(`${op}|${num(idx)}|${e ? 1 : 0}`);
      } else if (op === "smlg" || op === "smapx") {
        const nid = next();
        const n = tnodes.get(nid)!;
        const p = n.components.find((c) => c instanceof SummaryLogic) as
          | SummaryLogic
          | undefined;
        if (!p) push(`${op}|${nid}|none`);
        else if (op === "smapx") {
          p.on_fighter_add(ents()[0] as never);
          push(
            `smapx|${nid}|fighters=${num(p.fighters.size)}|players=${num(p.players.size)}|en=${num(
              ents().length,
            )}|gh=${num((w.ghosts as unknown[]).length)}|em=${num((w.entity_map as Map<unknown, unknown>).size)}`,
          );
        } else {
          push(
            `smlg|${nid}|teams=${num(p.teams.size)}|fighters=${num(p.fighters.size)}|players=${num(
              p.players.size,
            )}|losing=${num(p.losing_teams.size)}|cbm=${num(
              ((p as Rec)["_summary_cb_map"] as Map<unknown, unknown>).size,
            )}`,
          );
          for (const [k, s] of p.teams) {
            push(
              `sm|${k}|t=${String(s.team)}|${num(s.wins)}|${num(s.loses)}|${num(s.lives)}|${num(
                s.deads,
              )}|${num(s.spawns)}|${num(s.kills)}|${num(s.damages)}|${num(s.hp_lost)}|${num(
                s.mp_usage,
              )}|${num(s.pickings)}|${num(s.hp)}|${num(s.reserve)}|latest=${num(
                s.latest_dead_time,
              )}|losing=${p.losing_teams.has(s) ? 1 : 0}`,
            );
          }
          for (const [k, s] of p.fighters) {
            push(
              `smf|${k}|t=${String(s.team)}|${num(s.spawns)}|${num(s.deads)}|${num(s.kills)}|${
                num(s.damages)
              }|${num(s.hp_lost)}|${num(s.mp_usage)}|${num(s.pickings)}`,
            );
          }
          for (const [k, s] of p.players) {
            push(
              `smp|${k}|t=${String(s.team)}|pid=${String(s.player_id)}|${num(s.spawns)}|${num(
                s.deads,
              )}|${num(s.kills)}|${num(s.damages)}|${num(s.hp_lost)}|${num(
                s.mp_usage,
              )}|${num(s.pickings)}`,
            );
          }
        }
      } else if (op === "sumt") {
        const nid = next();
        const team = nextKey();
        const n = tnodes.get(nid)!;
        const p = n.components.find((c) => c instanceof SummaryLogic) as
          | SummaryLogic
          | undefined;
        if (p) p.team_sum(team);
        push(`sumt|${nid}|${team}|n=${num(p ? p.teams.size : -1)}`);
      } else if (op === "wdt") {
        const dt = Number(nextKey());
        const n = Number(nextKey());
        for (let k = 0; k < n; ++k) w.update_once(dt);
        push(`wdt|${num(dt)}|${num(n)}|lt=${num(lfw.world.lifetime)}`);
      } else if (op === "edef") {
        const idx = Number(nextKey());
        const f = nextKey();
        const v = Number(nextKey());
        const e = idx >= 0 ? (ents()[idx] as Rec | undefined) : undefined;
        if (e) {
          if (f === "defend_value") e["defend_value"] = v;
          else if (f === "defend_value_max") e["defend_value_max"] = v;
          else if (f === "fall_value") e["fall_value"] = v;
          else if (f === "fall_value_max") e["fall_value_max"] = v;
          else if (f === "toughness") e["toughness"] = v;
          else if (f === "toughness_max") e["toughness_max"] = v;
          else if (f === "hp_r") e["hp_r"] = v;
        }
        const rd = (k: string) => (e ? (e[k] as number) : 0);
        push(
          `edef|${num(idx)}|${f}|${e ? 1 : 0}|dv=${num(rd("defend_value"))}|dvm=${num(
            rd("defend_value_max"),
          )}|fv=${num(rd("fall_value"))}|fvm=${num(rd("fall_value_max"))}|tv=${num(
            rd("toughness"),
          )}|tvm=${num(rd("toughness_max"))}|hpr=${num(rd("hp_r"))}`,
        );
      } else if (op === "eprobe") {
        const idx = Number(nextKey());
        const e = idx >= 0 ? (ents()[idx] as Rec | undefined) : undefined;
        const marks = e ? (e.marks as Map<string, unknown>) : undefined;
        push(
          `eprobe|${num(idx)}|e=${e ? (e["id"] as string) : "-"}|life=${num(
            e ? ((e as never as Rec).lifetime as number) : 0,
          )}|marks=${num(marks ? marks.size : 0)}|heal=${
            marks && marks.has("Healing") ? 1 : 0
          }|mpheal=${marks && marks.has("MpHealing") ? 1 : 0}`,
        );
      } else if (op === "wtime") {
        push(`wtime|gt=${num(lfw.world.game_time as number)}|lt=${num(lfw.world.lifetime)}`);
      } else if (op === "elist") {
        const all = ents();
        for (let k = 0; k < all.length; k++) {
          const e = all[k]!;
          push(
            `el|${num(k)}|e=${e["id"] as string}|t=${e["team"] as string}|hp=${num(
              e["hp"] as number,
            )}`,
          );
        }
      } else if (op === "fdbg") {
        const nid = nextKey();
        const nn = tnodes.get(nid)!;
        const any = (nn.components as Rec[]).find((c) => c instanceof FighterStatBar) as
          | Rec
          | undefined;
        const ent = any && any["entity"] ? (any["entity"] as Rec) : undefined;
        const tc = any && any["_tier_colors"] ? (any["_tier_colors"] as string[]).length : -1;
        const marks = ent ? (ent["marks"] as Map<string, unknown>) : undefined;
        const life = ent
          ? `${num(ent["lifetime"] as number)}/${num(marks ? marks.size : 0)}/${
              marks && marks.has("Healing") ? 1 : 0
            }/${marks && marks.has("MpHealing") ? 1 : 0}`
          : "-";
        push(
          `fdbg|${nid}|n=${num((nn.components as Rec[]).length)}|fl=${
            any ? (any["hp_flashing"] ? 1 : 0) : "-"
          }|dead=${any ? (any["dead"] ? 1 : 0) : "-"}|mp=${
            any ? (any["mp_healing"] ? 1 : 0) : "-"
          }|tc=${num(tc)}|life=${life}|e=${ent ? (ent["id"] as string) : "-"}`,
        );
      } else if (op === "smk") {
        const team = nextKey();
        push(`smk|${String(make_sum_info(team).team)}`);
      } else if (op === "sbctrl") {
        const idx = Number(nextKey());
        const pid = nextKey();
        const mode = i[0]! < t.length ? nextKey() : "";
        const e = idx >= 0 ? (ents()[idx] as Rec | undefined) : undefined;
        const p = lfw.player(pid) as Rec | undefined;
        let c: Rec | undefined;
        if (e) {
          if (mode === "human") {
            c = (lfw.factory as Rec).acquire_ctrl(LocalController, pid, e) as Rec | undefined;
          } else {
            c = (lfw.factory as Rec).create_ctrl(
              (e["data"] as Rec)["id"],
              pid,
              e,
            ) as Rec | undefined;
          }
          if (c) e["ctrl"] = c;
        }
        push(
          `sbctrl|${num(idx)}|${e ? 1 : 0}|p=${p ? 1 : 0}|bot=${
            c && c["__is_bot_ctrl__"] === true ? 1 : 0
          }|pid=${c ? String(c["player_id"]) : '-'}`,
        );
      } else if (op === "cprb") {
        const nid = next();
        const cid = nextKey();
        const prop = nextKey();
        const n = tnodes.get(nid)!;
        const c = n.components.find((v: Rec) => v.id === cid) as Rec | undefined;
        let ok = false;
        let hit = "u";
        let errs = "";
        if (c) {
          try {
            const p = c["props"] as Rec;
            const v = p[prop] as Rec | undefined;
            ok = true;
            hit = v ? `s"${String(v.id ?? v.name)}"` : "u";
          } catch (e) {
            errs = (e as Error).message;
          }
        }
        push(`cprb|${nid}|${c ? 1 : 0}|ok=${ok ? 1 : 0}|n=${hit}|errs=${errs}`);
      } else if (op === "fsbe") {
        const nid = next();
        const cid = nextKey();
        const idx = Number(nextKey());
        const n = tnodes.get(nid)!;
        const p = n.components.find((c) => c.id === cid && c instanceof FighterStatBar) as
          | FighterStatBar
          | undefined;
        const e = idx >= 0 ? (ents()[idx] as Rec | undefined) : undefined;
        if (p) p.set_entity((e ?? undefined) as never);
        push(`fsbe|${nid}|${p ? 1 : 0}|e=${e ? 1 : 0}`);
      } else {
        const nid = next();
        const n = tnodes.get(nid)!;
        const p = n.components.find((c) => c instanceof PlayerScore) as
          | PlayerScore
          | undefined;
        if (!p) push(`ps|${nid}|none`);
        else {
          const l = p.lose;
          const f = p.fighter;
          push(
            `ps|${nid}|idx=${num(p.index)}|lose=${
              l === undefined ? '-' : l ? 1 : 0
            }|f=${f ? f.id : '-'}|vis=${n.visible ? 1 : 0}`,
          );
        }
      }
    } else if (op === "eteam" || op === "emark" || op === "edmark") {
      const idx = Number(nextKey());
      const arr = Array.from((lfw.world as unknown as Rec).entities as Set<Rec>);
      const e = idx >= 0 ? (arr[idx] as Rec | undefined) : undefined;
      if (op === "eteam") {
        const team = nextKey();
        if (e) e.team = team;
        push(`eteam|${num(idx)}|${e ? e.team : '-'}`);
      } else {
        const key = nextKey();
        const val = nextKey();
        if (e) {
          if (op === "emark") e.set_mark(key, val);
          else e.del_mark(key, val);
        }
        push(`${op}|${num(idx)}|${num(e ? (e.marks as Map<string, unknown>).size : 0)}`);
      }
    } else if (op === "wtick") {
      // 推进 `world.lifetime`（暂停下 `step` 只做无害段；台面需要非零时间戳喂 `is_start`）。
      const n = Number(nextKey());
      const w = lfw.world as unknown as Rec;
      lfw.world.set_paused(1);
      for (let k = 0; k < n; ++k) w.update_once(16);
      lfw.world.set_paused(0);
      push(`wtick|${num(n)}|lt=${num(lfw.world.lifetime)}`);
    } else if (op === "stgfin") {
      // 4BV：直发舞台完成事件（`Stage` 的 Completed 态 enter 同款）。
      const st = lfw.world.stage;
      if (st) st.callbacks.call("on_stage_finish", st);
      push(`stgfin|${st ? 1 : 0}`);
    } else if (op === "mttimes") {
      push(`mttimes|${num((lfw as Rec)["_mt"].times as number)}`);
    } else if (op === "kstat") {
      // 逐个驱动所有已挂载的按键状态（= `CMD_KEY_EVENT` 对 `mounted_keys` 做的事）。
      const gk = nextKey();
      const what = next();
      const tok = t[i[0]!];
      const has_t = tok !== undefined && tok !== "-";
      const tm = has_t ? Number(t[i[0]!++]!) : undefined;
      let cnt = 0;
      let ret = 0;
      for (const ks of lfw.mounted_keys) {
        const st = (ks as unknown as Rec)[gk];
        if (!st) continue;
        ++cnt;
        if (what === "hit") st.hit(tm);
        else if (what === "end") st.end();
        else if (what === "use") ret = st.use();
        else st.reset();
      }
      push(
        `kstat|${gk}|${what}|cnt=${cnt}` + (what === "use" ? `|ret=${num(ret)}` : ""),
      );
    } else if (op === "kkey") {
      // 台面探针：已挂载 `Keys` 里某个游戏键的 `KeyStatus`（`KEY_EVENT` 的 `hit`/`end` 落点）。
      const gk = nextKey();
      let line = `kkey|${gk}`;
      for (const ks of lfw.mounted_keys) {
        const st = (ks as unknown as Rec)[gk] as
          | { time: number; u_time: number; used: number }
          | undefined;
        if (!st) {
          line += "|u";
          continue;
        }
        line += `|${num(st.time)}|${num(st.u_time)}|${num(st.used)}`;
      }
      push(line);
    } else if (op === "cmds") {
      push("cmds|" + lfw.cmds.join(";"));
    } else if (op === "clearcmds") {
      lfw.cmds.length = 0;
    } else if (op === "cmd") {
      // 经真命令分发器跑一条命令（`POINTER_*` / `KEY_EVENT` / `F4` …）。
      const text = parseValue(t, i) as string;
      CMDS.handle(lfw.world, [String(text)]);
    } else if (op === "flpage") {
      // 把 `lfw.layers`（命令真正作用的那一栈）的节点别名进 `tnodes`（`npg` 只认 `real_layers`）。
      const nid = next();
      const li = Number(next());
      const pi = Number(next());
      const l = lfw.layers.at(li);
      let node: UINode | undefined = l ? (pi < 0 ? l.ui : l.at(pi)) : undefined;
      while (node && i[0]! < t.length) {
        const idx = Number(t[i[0]!++]!);
        node = idx < node.children.length ? node.children[idx] : undefined;
      }
      tnodes.set(nid, node as UINode);
      push(`flpage|${nid}|${node ? 1 : 0}|${num(l ? l.pages.length : 0)}`);
    } else if (op === "ptcur") {
      const tok = next();
      const from = tok === "-" ? "" : keyOf(tok);
      const cursors = get_pointer_cursors(lfw.world);
      if (!cursors) {
        push("ptcur|u");
      } else {
        const c = cursors.get(from);
        if (!c) push(`ptcur|${from}|none`);
        else push(`ptcur|${from}|${num(c.x)}|${num(c.y)}|${c.down ? 1 : 0}|${c.hidden ? 1 : 0}`);
      }
    } else if (op === "ischeat") {
      push(`ischeat|${nextKey()}|${lfw.is_cheat(nextKey()) ? 1 : 0}`);
    } else if (op === "setcheat") {
      const name = nextKey();
      const en = t[i[0]!++]!;
      lfw.set_cheat(name, team_to_bool(en));
    } else if (op === "cheat") {
      const name = nextKey();
      const on = t[i[0]!++] === "1";
      (lfw.world as Rec).dataset[name] = on;
      (lfw.callbacks as Rec).call("on_cheat_changed", name, on);
      push(`cheat|${name}|${on ? "1" : "0"}`);
    } else if (op === "cmdbg") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const cm = n.components.find((c) => c instanceof CharMenuLogic) as CharMenuLogic | undefined;
      if (!cm) push(`cmdbg|${nid}|none`);
      else {
        const arr = [...cm.players.entries()];
        const last = arr.length ? arr[arr.length - 1] : undefined;
        push(
          `cmdbg|${nid}|n=${arr.length}|last=${last ? last[0].id : "-"}|lastic=${
            last ? (last[0].is_com ? "1" : "0") : "-"
          }|lc=${last && last[0].is_com ? last[0].id : "-"}`,
        );
      }
    } else if (op === "dgrp") {
      const g = nextKey();
      let line = `dgrp|${g}`;
      for (const v of lfw.datas.get_fighters_of_group(g as never)) line += `|${(v as Rec).id}`;
      push(line);
    } else if (op === "ep") {
      lfw.emit_progress(nextKey(), Number(nextKey()));
    } else if (op === "eps") {
      const c = nextKey();
      const p = Number(nextKey());
      const s = nextKey();
      lfw.emit_progress(c, p, s === "-" ? undefined : Number(s));
    } else if (op === "lstart") {
      (lfw.callbacks as Rec).call("on_loading_start");
      push("lstart");
    } else if (op === "lend") {
      (lfw.callbacks as Rec).call("on_loading_end");
      push("lend");
    } else if (op === "lfail") {
      const reason = parseValue(t, i);
      (lfw.callbacks as Rec).call("on_loading_failed", reason);
      push(`lfail|${renderValue(reason)}`);
    } else if (op === "lprel") {
      (lfw.callbacks as Rec).call("on_prel_loaded", lfw);
      push("lprel");
    } else if (op === "desktop") {
      const on = nextKey() === "1";
      (Ditto as Rec).IsDesktop = on;
      push(`desktop|${on ? 1 : 0}`);
    } else if (op === "lpl") {
      const nid = nextKey();
      const n = tnodes.get(nid)!;
      let lp: LaunchPage | undefined;
      for (const c of n.components) {
        if (c instanceof LaunchPage) {
          lp = c as LaunchPage;
          break;
        }
      }
      if (!lp) {
        push(`lpl|${nid}|none`);
      } else {
        const rc = lp as Rec;
        const props = rc["props"] as Rec;
        const fsmv = ((rc["fsm"] as Rec | undefined)?.["state"] as Rec | undefined)?.["key"] ?? "";
        const la = props["loading_anim"] as ImgLoop | undefined;
        const flags = (node: UINode | undefined): string => {
          if (!node) return "u";
          const sc = node.find_component(SineOpacity);
          const fc = node.find_component(FadeOutOpacity);
          return `${sc ? (sc.enabled ? 1 : 0) : -1}${fc ? (fc.enabled ? 1 : 0) : -1}`;
        };
        const opa_done = (node: UINode | undefined): string => {
          if (!node) return "u";
          const c = node.find_component(OpacityAnimation);
          return c ? (c.done ? "1" : "0") : "u";
        };
        const sc_end = (node: UINode | undefined, id: string): string => {
          if (!node) return "u";
          const c = node.find_component(ScaleAnimation, id);
          return c ? (c.is_end ? "1" : "0") : "u";
        };
        const hint = n.find_child("desktop_hint");
        push(
          `lpl|${nid}|fsm=${fsmv}|prel=${rc["_prel_loaded"] ? 1 : 0}` +
            `|la_t=${num(la ? la.anim.times : 0)}|la_c=${num(la ? la.anim.count : 0)}` +
            `|tap=${flags(props["tap_to_launch"] as UINode)}|sw=${flags(props["sound_warning"] as UINode)}` +
            `|note=${flags(props["translation_note"] as UINode | undefined)}` +
            `|yf=${props["yeonface"] ? 1 : 0}|bf=${props["bearface"] ? 1 : 0}|lt=${props["long_text"] ? 1 : 0}` +
            `|yfo=${opa_done(props["yeonface"] as UINode)}|bfo=${opa_done(props["bearface"] as UINode)}|lto=${opa_done(props["long_text"] as UINode)}` +
            `|ysi=${sc_end(props["yeonface"] as UINode, "scale_in")}|yso=${sc_end(props["yeonface"] as UINode, "scale_out")}|bso=${sc_end(props["bearface"] as UINode, "scale_out")}` +
            `|dt=${hint ? (hint.visible ? 1 : 0) : "u"}`
        );
      }
    } else if (op === "adnew") {
      g_ads.set(nextKey(), new ActionDirector());
    } else if (op === "adins" || op === "adoff" || op === "adrep") {
      const id = nextKey();
      const d = g_ads.get(id);
      if (!d) {
        push(`${op}|${id}|none`);
      } else {
        const work = (tag: string) => () => push(`adw|${tag}`);
        if (op === "adins") {
          const time = Number(nextKey());
          d.insert(time, work(nextKey()));
        } else if (op === "adoff") {
          const delay = Number(nextKey());
          d.offset(delay, work(nextKey()));
        } else {
          const times = Number(nextKey());
          const delay = Number(nextKey());
          d.repeat(times, delay, work(nextKey()));
        }
      }
    } else if (op === "adwait" || op === "adt" || op === "adsort" || op === "adreset" || op === "adup") {
      const id = nextKey();
      const d = g_ads.get(id);
      if (!d) {
        push(`${op}|${id}|none`);
      } else if (op === "adwait") d.wait(Number(nextKey()));
      else if (op === "adt") d.times(Number(nextKey()));
      else if (op === "adsort") d.sort();
      else if (op === "adreset") d.reset();
      else d.update(Number(nextKey()));
    } else if (op === "adp") {
      const id = nextKey();
      const d = g_ads.get(id);
      if (!d) {
        push(`adp|${id}|none`);
      } else {
        const rc = d as Rec;
        push(
          `adp|${id}|life=${num(d.lifetime)}|end=${num(d.end_time)}|idx=${num(rc["_action_idx"])}` +
            `|curr=${num(rc["_curr"])}|times=${num(rc["_times"])}|n=${num((rc["_actions"] as unknown[]).length)}`
        );
      }
    } else if (op === "addump") {
      const id = nextKey();
      const d = g_ads.get(id);
      if (!d) {
        push(`addump|${id}|none`);
      } else {
        const list = (d as Rec)["_actions"] as Rec[];
        push(`addump|${id}|n=${num(list.length)}`);
        for (let k = 0; k < list.length; ++k) {
          push(`ad|${id}|${num(k)}|t=${num(list[k]["time"] as number)}|s=${num(list[k]["seq"] as number)}`);
        }
      }
    } else if (op === "lfgp") {
      const nid = nextKey();
      const n = tnodes.get(nid)!;
      let lp: LittleFunnyAutoGame | undefined;
      for (const c of n.components) {
        if (c instanceof LittleFunnyAutoGame) {
          lp = c as LittleFunnyAutoGame;
          break;
        }
      }
      if (!lp) {
        push(`lfg|${nid}|none`);
      } else {
        const rc = lp as Rec;
        const teams = rc["_teams"] as Rec;
        const ent_part = (e: Entity | undefined): string => {
          if (!e) return "z";
          const fid = e.frame?.id ?? "-";
          return (
            `${e.id}|t=${e.team}|x=${num(e.position.x)}|hp=${num(e.hp)}|fm=${num(e.facing)}` +
            `|hr=${num(e.hp_r)}|hm=${num(e.hp_max)}|fr=${fid}|dg=${num(e.dead_gone)}|nv=${num(e.name_visible)}|sb=${num(e.stat_bar)}`
          );
        };
        const ids_of = (v: Entity[] | undefined): string => {
          if (!v || !v.length) return "-";
          return v.map((e) => e.id).join(",");
        };
        const t1 = teams["1"] as Rec;
        const t2 = teams["2"] as Rec;
        push(
          `lfg|${nid}|lr=${num(rc["_lr"] as number)}|ox=${num(rc["_ox"] as number)}|wp=${num(lfw.world.paused ? 1 : 0)}` +
            `|b1=${ent_part(t1["boss"] as Entity | undefined)}|b2=${ent_part(t2["boss"] as Entity | undefined)}` +
            `|s1=${num((t1["soldiers"] as Entity[]).length)}|s2=${num((t2["soldiers"] as Entity[]).length)}` +
            `|s1i=${ids_of(t1["soldiers"] as Entity[])}|s2i=${ids_of(t2["soldiers"] as Entity[])}`
        );
      }
    } else if (op === "dj" || op === "de" || op === "dsw") {
      const nid = nextKey();
      const uid = nextKey();
      const d = danmu_of(nid);
      if (op === "dsw") {
        const oid = nextKey();
        if (!d) push(`dsw|${uid}|none`);
        else push(`dsw|${uid}|${d["switch"](uid, oid === "-" ? undefined : oid) ? 1 : 0}`);
      } else {
        const name = nextKey();
        const oid = nextKey();
        if (!d) push(`${op}|${uid}|none`);
        else {
          const ret = op === "dj"
            ? d.join({ uid, name, oid: oid === "-" ? undefined : oid })
            : d.enter({ uid, name, oid: oid === "-" ? undefined : oid });
          push(`${op}|${uid}|${ret ? 1 : 0}`);
        }
      }
    } else if (op === "dleave" || op === "dtouch" || op === "dcheer") {
      const nid = nextKey();
      const uid = nextKey();
      const d = danmu_of(nid);
      if (!d) push(`${op}|${uid}|none`);
      else if (op === "dleave") push(`dleave|${uid}|${d.leave(uid) ? 1 : 0}`);
      else if (op === "dtouch") {
        d.touch(uid);
        push(`dtouch|${uid}`);
      } else push(`dcheer|${uid}|${d.cheer(uid) ? 1 : 0}`);
    } else if (op === "dp") {
      const nid = nextKey();
      const d = danmu_of(nid);
      if (!d) push(`dp|${nid}|none`);
      else {
        const rc = d as Rec;
        const csv = (v: string[]): string => (v.length ? v.join(",") : "-");
        let line = `dp|${nid}|mode=${d.mode}|time=${num(d.time)}`;
        line += `|stg=${lfw.world.stage ? lfw.world.stage.name : "z"}`;
        const wins = [...d.teams].map(([k, v]) => `${k}:${num((v as { wins: number }).wins)}`).sort();
        line += `|w=${csv(wins)}`;
        line += `|teams=${csv([...(rc["_teams"] as Set<string>)].sort())}`;
        const caps = [...(rc["_team_caps"] as Map<string, number>)].map(([k, v]) => `${k}:${num(v)}`);
        line += `|caps=${csv(caps)}`;
        line += `|q=${num(d.join_queue.size)}`;
        const qu = [...d.join_queue.all].map((e) => `${e.uid}:${e.name}:${renderValue(e.oid)}`);
        line += `|qu=${csv(qu)}`;
        line += `|wts=${d.waiting_next_stage ? 1 : 0}`;
        line += `|cr=${rc["_coop_stage_ready"] ? 1 : 0}`;
        line += `|wr=${rc["_waiting_respawn"] ? 1 : 0}`;
        line += `|nsk=${num((rc["_next_stage_delay"] as { value: number }).value)}`;
        line += `|gck=${num((rc["_gameover_countdown"] as { value: number }).value)}`;
        line += `|sc=${num((rc["_staring_countdown"] as { value: number }).value)}`;
        line += `|qst=${num((rc["_queue_sweep_timer"] as { value: number }).value)}`;
        const cam = rc["_cam_ctrl"] as CameraCtrl | undefined;
        const staring = cam?.staring;
        line += `|st=${cam ? (staring ? staring.id : "z") : "u"}`;
        line += `|ca=${cam ? (cam.auto ? 1 : 0) : "u"}`;
        const jf = rc["_join_fallen"] as string | null;
        line += `|jf=${jf ?? "z"}`;
        const sv = rc["_survivors"] as { uid: string }[] | null;
        line += `|sv=${sv ? (sv.length ? sv.map((e) => e.uid).join(",") : "e") : "z"}`;
        const seen = [...(rc["_queue_seen"] as Map<string, number>)].map(([k, v]) => `${k}:${num(v)}`).sort();
        line += `|seen=${csv(seen)}`;
        const cd = [...(rc["_cheer_cd"] as Map<string, number>)].map(([k, v]) => `${k}:${num(v)}`).sort();
        line += `|cd=${csv(cd)}`;
        const feed = d.cheer_feed.map((e) => `${e.uid}:${e.name}:${num(e.time)}`);
        line += `|feed=${csv(feed)}`;
        push(line);
      }
    } else if (op === "dstats") {
      const nid = nextKey();
      const d = danmu_of(nid);
      if (!d) push(`dstats|${nid}|none`);
      else {
        const list = d.viewer_stats();
        push(`dstats|${nid}|n=${num(list.length)}`);
        for (const v of list)
          push(
            `vs|${v.uid}|${v.name}|sp=${num(v.spawns)}|k=${num(v.kills)}|d=${num(v.deads)}|dm=${num(v.damages)}|ch=${num(v.cheers)}|al=${v.alive ? 1 : 0}`
          );
      }
    } else if (op === "dlst") {
      const nid = nextKey();
      const ents = lfw.world.entities as unknown as Rec[];
      push(`dlst|${nid}|${num(ents.length)}`);
      for (let k = 0; k < ents.length; ++k) {
        const e = ents[k];
        if (!e) {
          push(`dl|${num(k)}|z`);
          continue;
        }
        const uid = (e["marks"] as Map<string, string>).get(Defines.DANMU_UID_MARK);
        push(
          `dl|${num(k)}|${e["id"]}|u=${uid ?? "-"}|n=${e["name"]}|p=${num((e["position"] as Rec).x as number)},${num((e["position"] as Rec).y as number)},${num((e["position"] as Rec).z as number)}` +
            `|sb=${num(e["stat_bar"] as number)}|nv=${num(e["name_visible"] as number)}|dg=${num(e["dead_gone"] as number)}` +
            `|bl=${num((e as Rec)["blinking"] as number)}|iv=${num((e as Rec)["invulnerable"] as number)}|hp=${num((e as Rec)["hp"] as number)}` +
            `|fr=${(e["frame"] as Rec | undefined)?.["id"] ?? "-"}`
        );
      }
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
      lfw.game_mode = GameMode.SurvivalRank2P;
      lfw.survival_rank_available = true;
      lfw.survival_rank_period = "week";
      lfw.set_survival_rank_data({ period: "week", list: [], mine: null });
      push(
        `srank|${is_survival_rank_mode(lfw.game_mode) ? 1 : 0}${lfw.survival_rank_available ? 1 : 0}${lfw.game_mode === GameMode.SurvivalRank2P ? 1 : 0}|${lfw.survival_rank_period}|cheated=${lfw.survival_rank_cheated ? 1 : 0}|modded=${lfw.survival_rank_modded ? 1 : 0}|invalid=${lfw.survival_rank_invalid ? 1 : 0}`,
      );
    } else if (op === "randinfo") {
      const e = make_real_entity(lfw.world, { type: 8, id: "rx" }) as Rec;
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
      const t1 = i[0]! < t.length ? nextKey() : undefined;
      const team = t1 === '-' ? undefined : t1;
      const type_id = i[0]! < t.length ? Number(nextKey()) : 8;
      // 4BP：带上真数据（`fg1` 等）的 `base` / `frames`；不整对象展开（碰 texml getter 会炸）。
      const real = (lfw.datas.find(id) ?? {}) as Rec;
      const data: Rec = {
        type: type_id,
        id,
        base: { ...(((real["base"] as Rec) ?? {}) as Rec) },
        frames: (real["frames"] as unknown[]) ?? [],
      };
      const ret = lfw.entities.add(data as never, n, team);
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
    } else if (op === "nod" || op === "noc") {
      const nid = next();
      const parent = op === "noc" ? tnodes.get(next()) : undefined;
      const data = parseValue(t, i);
      tnodes.set(nid, new UINode(lfw, data as never, parent as never));
    } else if (op === "nadd") {
      const parent = tnodes.get(next())!;
      const child = tnodes.get(next())!;
      parent.add_child(child);
    } else if (op === "nfn") {
      const n = tnodes.get(next())!;
      const tok = next();
      n.focused_node = tok === "-" ? undefined : tnodes.get(tok)!;
    } else if (op === "nset") {
      const nid = next();
      const what = next();
      const n = tnodes.get(nid)!;
      const nnum = (): number => Number(next());
      if (what === "x") n.set_x(nnum());
      else if (what === "y") n.set_y(nnum());
      else if (what === "z") n.set_z(nnum());
      else if (what === "w") n.set_w(nnum());
      else if (what === "h") n.set_h(nnum());
      else if (what === "cx") n.set_cx(nnum());
      else if (what === "cy") n.set_cy(nnum());
      else if (what === "cz") n.set_cz(nnum());
      else if (what === "sx") n.set_sx(nnum());
      else if (what === "sy") n.set_sy(nnum());
      else if (what === "sz") n.set_sz(nnum());
      else if (what === "visible") n.set_visible(next() === "1");
      else if (what === "disabled") n.set_disabled(next() === "1");
      else if (what === "opacity") n.set_opacity(nnum());
      else if (what === "clip") n.clip_children = next() === "1";
      else if (what === "focused") n.focused = next() === "1";
      else if (what === "background" || what === "foreground") {
        const tok = next();
        const v = tok === "-" ? null : keyOf(tok);
        if (what === "background") n.background = v;
        else n.foreground = v;
      } else if (what === "backgroundAlpha" || what === "foregroundAlpha") {
        const tok = next();
        const v = tok === "-" ? null : Number(tok);
        if (what === "backgroundAlpha") n.backgroundAlpha = v;
        else n.foregroundAlpha = v;
      } else if (what === "outlineColor" || what === "outlineWidth" || what === "outlineAlpha") {
        const v = parseValue(t, i);
        if (what === "outlineColor") n.outlineColor = v as never;
        else if (what === "outlineWidth") n.outlineWidth = v as never;
        else n.outlineAlpha = v as never;
      } else if (what === "global_pos") {
        n.global_pos = { x: nnum(), y: nnum(), z: nnum() };
      } else if (what === "resize3") {
        n.resize(nnum(), nnum(), nnum());
      } else if (what === "move3") {
        n.move_to(nnum(), nnum(), nnum());
      } else if (what === "center3") {
        n.set_center(nnum(), nnum(), nnum());
      } else if (what === "scale3") {
        n.set_scale(nnum(), nnum(), nnum());
      } else if (what === "update") {
        n.update(nnum());
      } else if (what === "updaten") {
        // 4BV：多帧推进（`Times.add()` 逐帧 +1，需要「跑 N 帧」的台面节）。
        const count = nnum();
        const dt = nnum();
        for (let k = 0; k < count; ++k) n.update(dt);
        push(`nupd|${nid}|${num(count)}`);
      } else if (what === "text") {
        n.set_text(keyOf(next()));
      } else if (what === "text2") {
        const s = keyOf(next());
        n.set_text(s, parseValue(t, i) as never);
      } else if (what === "texti") {
        n.text = parseValue(t, i) as never;
      } else if (what === "image") {
        n.image = parseValue(t, i) as never;
      } else if (what === "style_assign") {
        n.style.assign(parseValue(t, i) as never);
      } else if (what === "style_touch") {
        n.style.touch();
      } else fail(`unknown nset '${what}'`);
    } else if (op === "nrd") {
      const nid = next();
      const what = next();
      const n = tnodes.get(nid)!;
      if (what === "pos" || what === "scale" || what === "size" || what === "center") {
        const v = what === "pos" ? n.pos : what === "scale" ? n.scale : what === "size" ? n.size : n.center;
        push(`nrd|${nid}|${what}|${num(v.x)}|${num(v.y)}|${num(v.z)}`);
      } else if (what === "clip") {
        push(`nrd|${nid}|clip|${n.clip_children ? "1" : "0"}`);
      } else if (what === "cross") {
        const c = n.cross;
        push(`nrd|${nid}|cross|${num(c.left)}|${num(c.top)}|${num(c.right)}|${num(c.bottom)}|${num(c.mid_x)}|${num(c.mid_y)}`);
      } else if (what === "rect") {
        const r = n.rect;
        push(`nrd|${nid}|rect|${num(r.left)}|${num(r.top)}|${num(r.right)}|${num(r.bottom)}`);
      } else if (what === "geo") {
        const g = n.geo;
        push(`nrd|${nid}|geo|${num(g.pos.x)}|${num(g.pos.y)}|${num(g.left)}|${num(g.top)}|${num(g.right)}|${num(g.bottom)}`);
      } else if (what === "gp") {
        const g = n.global_pos;
        push(`nrd|${nid}|gp|${num(g.x)}|${num(g.y)}|${num(g.z)}`);
      } else if (what === "flags") {
        push(`nrd|${nid}|flags|${n.visible ? 1 : 0}${n.self_visible ? 1 : 0}${n.disabled ? 1 : 0}${n.self_disabled ? 1 : 0}`);
      } else if (what === "op") {
        push(`nrd|${nid}|op|${num(n.opacity)}|${num(n.global_opacity)}`);
      } else if (what === "bg") {
        push(`nrd|${nid}|bg|${esc(n.background)}|${num(n.backgroundAlpha)}`);
      } else if (what === "fg") {
        push(`nrd|${nid}|fg|${esc(n.foreground)}|${num(n.foregroundAlpha)}`);
      } else if (what === "outline") {
        push(`nrd|${nid}|outline|${renderValue(n.outlineColor)}|${renderValue(n.outlineWidth)}|${renderValue(n.outlineAlpha)}`);
      } else if (what === "id") {
        push(`nrd|${nid}|id|${renderValue(n.id)}|${renderValue(n.name)}|${num(n.depth)}`);
      } else if (what === "depth") {
        push(`nrd|${nid}|depth|${num(n.depth)}`);
      } else if (what === "lifetime") {
        push(`nrd|${nid}|lifetime|${num(n.lifetime)}`);
      } else if (what === "ptr") {
        push(`nrd|${nid}|ptr|${n.pointer_over}|${n.pointer_down}|${n.click_flag}`);
      } else if (what === "foc") {
        push(`nrd|${nid}|foc|${n.focused ? 1 : 0}|${nref(n.focused_node)}`);
      } else if (what === "state") {
        push(`nrd|${nid}|state|${renderValue(n.state)}`);
      } else if (what === "value") {
        push(`nrd|${nid}|value|${renderValue(n.get_value(keyOf(next())))}`);
      } else if (what === "fc" || what === "sn" || what === "ln" || what === "fp") {
        const id = keyOf(next());
        const hit =
          what === "fc" ? n.find_child(id) : what === "sn" ? n.search_node(id) : what === "ln" ? n.lookup_node(id) : n.find_parent((p) => p.id === id);
        push(`nrd|${nid}|${what}|${nref(hit)}`);
      } else if (what === "fcn") {
        push(`nrd|${nid}|fcn|${nref(n.find_child_by_name(keyOf(next())))}`);
      } else if (what === "hit") {
        const x = Number(next());
        const y = Number(next());
        push(`nrd|${nid}|hit|${n.hit(x, y) ? 1 : 0}`);
      } else if (what === "text") {
        const tv = n.text as Rec | null | undefined;
        if (tv === null || tv === undefined) push(`nrd|${nid}|text|null`);
        else {
          const st = (tv as Rec).style;
          const ver = st instanceof Style;
          const sv = ver ? "v" + String((st as unknown as Rec).version) : "-";
          const sj = ver ? "-" : esc(JSON.stringify(st ?? {}));
          push(`nrd|${nid}|text|${renderValue((tv as Rec).text)}|${renderValue((tv as Rec).w)}|${renderValue((tv as Rec).h)}|${renderValue((tv as Rec).scale)}|${sv}|${sj}`);
        }
      } else if (what === "style") {
        push(`nrd|${nid}|style|${renderValue(n.style.data)}`);
      } else if (what === "image") {
        push(`nrd|${nid}|image|${renderValue(n.image)}`);
      } else if (what === "color") {
        push(`nrd|${nid}|color|${renderValue(n.color)}`);
      } else if (what === "opacity") {
        push(`nrd|${nid}|opacity|${num(n.opacity)}`);
      } else if (what === "kids") {
        let line = `nrd|${nid}|kids|${n.children.length}`;
        for (const c of n.children) line += `|${nref(c as UINode)}`;
        push(line);
      } else fail(`unknown nrd '${what}'`);
    } else if (op === "npd" || op === "npm" || op === "npu" || op === "npc") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const e = new LFWPointerEvent({ x: 0, y: 0, z: 0 }, 0);
      if (op === "npd") n.on_pointer_down(e);
      else if (op === "npm") n.on_pointer_move(e);
      else if (op === "npu") n.on_pointer_up(e);
      else n.on_pointer_cancel(e);
      push(`np|${nid}|${op}|stop=${e.stopped}`);
    } else if (op === "npl" || op === "npe") {
      const nid = next();
      const n = tnodes.get(nid)!;
      if (op === "npl") n.on_pointer_leave();
      else n.on_pointer_enter();
      push(`np|${nid}|${op}`);
    } else if (op === "ncb") {
      const nid = next();
      const ev = next();
      const n = tnodes.get(nid)!;
      if (ev === "show") n.callbacks.on("on_show", (node) => push(`cb|${nid}|show|${nref(node as never as UINode)}`));
      else if (ev === "hide") n.callbacks.on("on_hide", (node) => push(`cb|${nid}|hide|${nref(node as never as UINode)}`));
      else if (ev === "foucs_changed") n.callbacks.on("on_foucs_changed", (node) => push(`cb|${nid}|foucs_changed|${nref(node as never as UINode)}`));
      else if (ev === "foucs_item_changed") n.callbacks.on("on_foucs_item_changed", (f, b) => push(`cb|${nid}|foucs_item_changed|${nref(f as never)}|${nref(b as never)}`));
      else if (ev === "pdown" || ev === "pmove" || ev === "pup" || ev === "pcancel") {
        const key = ev === "pdown" ? "on_pointer_down" : ev === "pmove" ? "on_pointer_move" : ev === "pup" ? "on_pointer_up" : "on_pointer_cancel";
        n.callbacks.on(key, (e) => push(`cb|${nid}|${ev}|${num((e as LFWPointerEvent).button)}`));
      } else if (ev === "pleave") n.callbacks.on("on_pointer_leave", (node) => push(`cb|${nid}|pleave|${nref(node as never as UINode)}`));
      else if (ev === "penter") n.callbacks.on("on_pointer_enter", (node) => push(`cb|${nid}|penter|${nref(node as never as UINode)}`));
      else if (ev === "comp_add") n.callbacks.on("on_component_add", (c, node) => push(`cb|${nid}|comp_add|${(c as Rec).f_name}#${(c as Rec).id}|${nref(node as never as UINode)}`));
      else if (ev === "comp_del") n.callbacks.on("on_component_del", (c, node) => push(`cb|${nid}|comp_del|${(c as Rec).f_name}#${(c as Rec).id}|${nref(node as never as UINode)}`));
      else fail(`unknown ncb '${ev}'`);
    } else if (op === "nmk") {
      const nid = next();
      const ptok = next();
      const parent = ptok === "-" ? undefined : tnodes.get(ptok)!;
      tnodes.set(nid, UINode.create(lfw, parseValue(t, i) as never, parent, undefined));
    } else if (op === "nlife") {
      const n = tnodes.get(next())!;
      const what = next();
      if (what === "start") n.on_start();
      else if (what === "stop") n.on_stop();
      else if (what === "resume") n.on_resume();
      else if (what === "pause") n.on_pause();
      else if (what === "show") n.on_show();
      else if (what === "hide") n.on_hide();
      else if (what === "blur") n.on_blur();
      else if (what === "foucs") n.on_foucs();
      else fail(`unknown nlife '${what}'`);
      await flush_microtasks();
    } else if (op === "nclick") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const e = new LFWPointerEvent({ x: 0, y: 0, z: 0 }, Number(next()));
      n.on_click(e);
      push(`click|${nid}|stop=${e.stopped}`);
    } else if (op === "nkey") {
      const nid = next();
      const dir = next();
      const gk = nextKey();
      const key = nextKey();
      const pre = t[i[0]] === "1";
      if (pre) ++i[0];
      const n = tnodes.get(nid)!;
      const e = new LFWKeyEvent("", dir === "down", gk as never, key);
      if (pre) e.stop_immediate_propagation();
      if (dir === "down") n.on_key_down(e);
      else n.on_key_up(e);
      push(`nkey|${nid}|${dir}|stop=${e.stopped}`);
    } else if (op === "npg") {
      const nid = next();
      const idx = Number(next());
      const l = real_layers.v?.at(idx);
      if (l?.ui) tnodes.set(nid, l.ui);
      push(`npg|${nid}|${l?.ui ? 1 : 0}`);
    } else if (op === "nml") {
      const nid = next();
      const lt = next();
      const layer = lt !== "-" ? real_layers.v?.at(Number(lt)) : undefined;
      tnodes.set(nid, UINode.create(lfw, parseValue(t, i) as never, undefined, layer));
    } else if (op === "cadd" || op === "cdel" || op === "lcomp" || op === "cupd" || op === "cfind" || op === "cset" || op === "ncomp") {
      const nid = next();
      const n = tnodes.get(nid)!;
      if (op === "ncomp") {
        const item = parseValue(t, i) as Rec;
        const comps = (lfw.factory as Rec).create_components(n, [item] as never) as Rec[];
        for (const c of comps) {
          n.add_components(c as never);
          g_ncomps.push(c);
        }
        push(`ncomp|${nid}|${n.components.length}`);
      } else if (op === "cadd") {
        const cid = next();
        const props = parseValue(t, i) as Rec;
        const info = { id: cid, name: cid, cls: "FakeComp", args: [], enabled: true, properties: props, props: {}, weight: 0 };
        const c = new FakeComponent(n, cid, info as never);
        n.add_components(c);
        push(`cadd|${nid}|${cid}|${n.components.length}`);
      } else if (op === "cdel") {
        const cid = next();
        const c = n.components.find((v: Rec) => v.id === cid) as FakeComponent | undefined;
        if (c) n.del_components(c);
        push(`cdel|${nid}|${cid}|${n.components.length}`);
      } else if (op === "lcomp") {
        push(`lcomp|${nid}|${n.components.length}`);
        let k = 0;
        for (const c of n.components as FakeComponent[]) {
          push(`fc|list|${k}|${(c.constructor as Rec).TAG}|${c.f_name}|${c.id}|${c.name}|${c.enabled ? "b1" : "b0"}`);
          k += 1;
        }
      } else if (op === "cupd") {
        n.update(Number(next()));
        push(`cupd|${nid}`);
      } else if (op === "cset") {
        const cid = next();
        const on = next() === "1";
        const c = n.components.find((v: Rec) => v.id === cid) as FakeComponent | undefined;
        c?.set_enabled(on);
        push(`cset|${nid}|${cid}|${c?.enabled ? "b1" : "b0"}`);
      } else {
        const cid = next();
        const which = keyOf(next());
        const c = n.components.find((v: Rec) => v.id === cid) as FakeComponent | undefined;
        push(`cfind|${nid}|${cid}|${which}|${c ? nref(c.find_node(which) as UINode) : "u"}`);
      }
    } else if (op === "wpause") {
      const v = Number(next());
      lfw.world.set_paused(v as never);
      push(`wpause|${num(v)}|${lfw.world.paused ? 1 : 0}`);
    } else if (op === "gfa" || op === "gfu" || op === "gfuse" || op === "gfr") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const cid = next();
      const c = (n.components as Rec[]).find((v) => v.id === cid) as Rec | undefined;
      if (op === "gfa") {
        c!.fsm = new FSM<ModeState, never>().add(
          new GameModeFSMState_Running(c as never),
          new GameModeFSMState_BeforeEnd(c as never),
          new GameModeFSMState_End(c as never),
        ) as never;
        push(`gfa|${nid}|${cid}`);
      } else if (op === "gfu") {
        const dt = Number(next());
        (c!.fsm as Rec).update(dt);
        push(`gfu|${nid}|${cid}|${num(dt)}`);
      } else if (op === "gfuse") {
        const key = nextKey();
        (c!.fsm as Rec).use(key as never);
        push(`gfuse|${nid}|${cid}|${key}`);
      } else {
        const f = c!.fsm as Rec;
        const s = f.state as Rec | undefined;
        const p = f.prev_state as Rec | undefined;
        push(
          `gfr|${nid}|${cid}|state=${renderValue(s?.key)}|prev=${renderValue(p?.key)}|st=${num(f.state_time as number)}|t=${num(f.time as number)}`,
        );
      }
    } else if (op === "cplay") {
      const nid = next();
      const cls = next();
      const act = next();
      const rev = next() === "1";
      const n = tnodes.get(nid)!;
      const comp = (n.components as Rec[]).find(
        (c) => (((c.constructor as Rec).TAGS as string[] | undefined) ?? []).includes(cls),
      );
      if (comp) {
        if (cls === "OpacityAnimation") {
          if (act === "start") (comp as Rec).start(rev);
          else if (act === "stop") (comp as Rec).stop(rev);
        } else if (cls === "OpacityFlash") {
          if (act === "start") (comp as Rec).start();
          else if (act === "stop") (comp as Rec).stop();
          else if (act === "replay") (comp as Rec).replay();
        } else if (cls === "FadeOutOpacity" || cls === "ScaleAnimation" || cls === "PositionAnimation") {
          if (act === "start") (comp as Rec).start(rev);
        }
      }
      push(`cplay|${nid}|${cls}|${act}|${comp ? "ok" : "none"}|${comp && (comp as Rec).enabled ? "b1" : "b0"}`);
    } else if (op === "calign") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const c = (n.components as Rec[]).find(
        (v) => (((v.constructor as Rec).TAGS as string[] | undefined) ?? []).includes("FlexItem"),
      );
      if (!c) {
        push(`calign|${nid}|none`);
      } else {
        let out = "err";
        let errs = 0;
        try {
          out = String((c as Rec).align);
          errs = (((c as Rec).props_holder as Rec).errors as unknown[]).length;
        } catch (e) {
          errs = (((e as Rec).errors as unknown[] | undefined) ?? []).length;
        }
        push(`calign|${nid}|${out}|${num(errs)}`);
      }
    } else if (op === "pic") {
      const nid = next();
      const act = next();
      const n = tnodes.get(nid)!;
      const comps = n.components as Rec[];
      const pic = comps.find((v) => (((v.constructor as Rec).TAGS as string[] | undefined) ?? []).includes("Picture"));
      const loop = comps.find((v) => (((v.constructor as Rec).TAGS as string[] | undefined) ?? []).includes("ImgLoop"));
      if (act === "src" && pic) {
        (pic as Rec).set_src(next());
        await flush_microtasks();
        push(`pic|${nid}|src|${String((pic as Rec).src)}`);
      } else if (act === "rd" && pic) {
        push(`pic|${nid}|rd|${num((pic as Rec).width)}|${num((pic as Rec).height)}|${String((pic as Rec).src)}`);
      } else if (act === "setw" && pic) {
        (pic as Rec).width = Number(next());
        push(`pic|${nid}|setw|${num((pic as Rec).width)}`);
      } else if (act === "seth" && pic) {
        (pic as Rec).height = Number(next());
        push(`pic|${nid}|seth|${num((pic as Rec).height)}`);
      } else if (act === "setimg" && (pic || loop)) {
        (n as Rec).image = new ImageInfo(parseValue(t, i) as Rec);
        push(`pic|${nid}|setimg|1`);
      } else if (act === "istart" && loop) {
        (loop as Rec).start();
        push(`pic|${nid}|istart|1`);
      } else if (act === "istop" && loop) {
        (loop as Rec).stop();
        push(`pic|${nid}|istop|1`);
      } else {
        push(`pic|${nid}|${act}|none`);
      }
    } else if (op === "snew") {
      const sid = next();
      const s = new SmoothNumber();
      s.handler((self) => push(`scb|${sid}|${num(self.value)}|${self.done ? 1 : 0}`));
      smooths.set(sid, s);
    } else if (op === "srd") {
      const sid = next();
      const s = smooths.get(sid)!;
      push(`srd|${sid}|${num(s.value)}|${num(s.target)}|${s.done ? 1 : 0}`);
    } else if (op === "svalue" || op === "starget" || op === "sspeed" || op === "sfactor" || op === "smdiff") {
      const sid = next();
      const v = Number(next());
      const s = smooths.get(sid)!;
      if (op === "svalue") s.value = v;
      else if (op === "starget") s.target = v;
      else if (op === "sspeed") s.speed(v);
      else if (op === "sfactor") s.factor(v);
      else s.min_diff(v);
    } else if (op === "smode") {
      const sid = next();
      smooths.get(sid)!.mode(next() as never);
    } else if (op === "supd") {
      smooths.get(next())!.update();
    } else if (op === "shandle") {
      smooths.get(next())!.handle();
    } else if (op === "reach") {
      const nid = next();
      const act = next();
      const n = tnodes.get(nid)!;
      const comps = n.components as Rec[];
      const tags = (v: Rec): string[] => (((v.constructor as Rec).TAGS as string[] | undefined) ?? []);
      if (act === "rd") {
        const r = comps.find((v) => tags(v).includes("Reachable"));
        if (!r) push(`reach|${nid}|none`);
        else push(`reach|${nid}|g|${String((r as Rec).group_name)}|${(r as Rec).group ? nref((r as Rec).group.node as UINode) : "u"}`);
      } else {
        const rg = comps.find((v) => tags(v).includes("ReachableGroup"));
        if (!rg) push(`reach|${nid}|none`);
        else {
          const parts = [
            `reach|${nid}|rg|${String((rg as Rec).group)}|${String((rg as Rec).direction)}|${nref((rg as Rec).binded_layout as UINode)}|${((rg as Rec).reachables as Rec[]).length}`,
            ...((rg as Rec).reachables as Rec[]).map((v) => nref(v.node as UINode)),
          ];
          push(parts.join("|"));
        }
      }
    } else if (op === "wfn") {
      lfw.world.fn_locked = Number(next()) !== 0;
    } else if (op === "stime") {
      lfw.world.stage.time = Number(next());
    } else if (op === "wcb") {
      lfw.world.callbacks.call(keyOf(next()));
    } else if (op === "lcb") {
      lfw.callbacks.call(keyOf(next()), lfw);
    } else if (op === "wstage") {
      lfw.world.stage = new Stage(lfw.world, parseValue(t, i) as never);
    } else if (op === "sphase") {
      lfw.world.stage.enter_phase(Number(next()));
    } else if (op === "sfield") {
      const key = keyOf(next());
      (lfw.world.stage.data as Rec)[key] = parseValue(t, i);
    } else if (op === "dialpush") {
      lfw.world.stage.push_dialogs(parseValue(t, i) as never);
    } else if (op === "dialnext") {
      lfw.world.stage.next_dialog();
    } else if (op === "dialclear") {
      lfw.world.stage.clear_dialogs();
    } else if (op === "stevt") {
      lfw.world.stage.callbacks.call(keyOf(next()), lfw.world.stage);
    } else if (op === "pkeye") {
      const pid = nextKey();
      const name = nextKey();
      const key = nextKey();
      const p = lfw.player(pid);
      let ok = 0;
      try {
        p.set_key(name as never, key, true);
        ok = 1;
      } catch {
        ok = 0;
      }
      push(`pkeye|${p.id}|${ok}`);
    } else if (op === "ctext") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const act = next();
      const ti = n.components.find((c) => c instanceof TextInput) as TextInput | undefined;
      if (!ti) push(`ctext|${nid}|none`);
      else {
        if (act === "set") ti.text = keyOf(next());
        push(`ctext|${nid}|${render_value(ti.text)}|${render_value(ti.maxLength)}|${render_value(ti.defaultValue)}`);
      }
    } else if (op === "pname") {
      const pid = nextKey();
      const name = nextKey();
      lfw.player(pid).set_name(name, true);
    } else if (op === "ccall") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const cls_name = next();
      const method = next();
      const cls = cls_name === "PlayerName" ? PlayerName : cls_name === "PlayerTeamName" ? PlayerTeamName : FighterName;
      const c = n.components.find((v) => v instanceof cls) as PlayerName | undefined;
      if (!c) push(`ccall|${nid}|${cls_name}|none`);
      else if (method === "quit") c.quit();
      else {
        const text = keyOf(next());
        const com = next() === "1";
        const decided = next() === "1";
        c.join(text, com, decided);
      }
    } else if (op === "shd" || op === "shv" || op === "shcb" || op === "semit") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const p = n.components.find((c) => c instanceof SliderHandle) as SliderHandle | undefined;
      if (!p) push(`${op}|${nid}|none`);
      else if (op === "shd") push(`shd|${nid}|${num(p.value)}|${num(p.factor)}|${p.mode}`);
      else if (op === "shv") {
        const v = Number(next());
        p.set_value(v);
        push(`shv|${nid}|${num(p.value)}|${num(p.factor)}`);
      } else if (op === "semit") {
        p.callbacks.call("on_value_changed", p.value, p);
        push(`semit|${nid}|${num(p.value)}|${num(p.factor)}`);
      } else {
        p.on_value_changed((v: number, self: SliderHandle) =>
          push(`shcb|${num(v)}|${self === p ? 1 : 0}`),
        );
        push(`shcb|${nid}|bound`);
      }
    } else if (op === "asw" || op === "asv" || op === "ascb" || op === "aemit") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const p = n.components.find((c) => c instanceof ArrowSwitcher) as ArrowSwitcher | undefined;
      if (!p) push(`${op}|${nid}|none`);
      else if (op === "asw") push(`asw|${nid}|${num(p.value)}|${num(p.count)}`);
      else if (op === "asv") {
        const v = Number(next());
        p.set_value(v);
        push(`asv|${nid}|${num(p.value)}`);
      } else if (op === "aemit") {
        p.callbacks.call("on_value_changed", p.value, p);
        push(`aemit|${nid}|${num(p.value)}`);
      } else {
        p.on_value_changed((v: number, self: ArrowSwitcher) =>
          push(`ascb|${num(v)}|${self === p ? 1 : 0}`),
        );
        push(`ascb|${nid}|bound`);
      }
    } else if (op === "ird") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const p = n.components.find((c) => c instanceof IntegerPicker) as IntegerPicker | undefined;
      if (!p) push(`ird|${nid}|none`);
      else push(`ird|${nid}|${num(p.min)}|${num(p.max)}|${num(p.val)}`);
    } else if (op === "ibus") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const p = n.components.find((c) => c instanceof IntegerPicker) as IntegerPicker | undefined;
      if (!p) push(`ibus|${nid}|none`);
      else {
        p.callbacks.add({
          on_min_changed: (curr: number, prev: number, self: IntegerPicker) =>
            push(`ibus|min|${num(curr)}|${num(prev)}|${self === p ? 1 : 0}`),
          on_max_changed: (curr: number, prev: number, self: IntegerPicker) =>
            push(`ibus|max|${num(curr)}|${num(prev)}|${self === p ? 1 : 0}`),
          on_val_changed: (curr: number, prev: number, self: IntegerPicker) =>
            push(`ibus|val|${num(curr)}|${num(prev)}|${self === p ? 1 : 0}`),
        });
      }
    } else if (op === "iput") {
      const nid = next();
      const what = next();
      const v = Number(next());
      const n = tnodes.get(nid)!;
      const p = n.components.find((c) => c instanceof IntegerPicker) as IntegerPicker | undefined;
      if (!p) push(`iput|${nid}|none`);
      else if (what === "min") p.min = v;
      else if (what === "max") p.max = v;
      else p.val = v;
    } else if (op === "algn") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const p = n.components.find((c) => c instanceof Alignment) as Alignment | undefined;
      if (!p) push(`algn|${nid}|none`);
      else {
        const ref = (v: Rec | null | undefined) => (v ? renderValue(v.id) : "u");
        const al = (v: string | null | undefined) => renderValue(v ?? undefined);
        const once = (p as unknown as Rec).once as boolean;
        push(
          `algn|${nid}|f=${ref(p.follower)}|l=${ref(p.followed.l)}|r=${ref(p.followed.r)}|t=${ref(p.followed.t)}|b=${ref(p.followed.b)}|al=${al(p.align.l)}|ar=${al(p.align.r)}|at=${al(p.align.t)}|ab=${al(p.align.b)}|ol=${num(p.offset.l)}|or=${num(p.offset.r)}|ot=${num(p.offset.t)}|ob=${num(p.offset.b)}|once=${once ? 1 : 0}|has=${n.components.includes(p) ? 1 : 0}`,
        );
      }
    } else if (op === "apl") {
      const nid = next();
      const what = next();
      const n = tnodes.get(nid)!;
      const c = n.components.find((v) => v instanceof Players) as Players | undefined;
      if (!c) push(`apl|${nid}|none`);
      else if (what === "read") push(`apl|${nid}|read|${num(c.players.size)}`);
      else {
        const pid = nextKey();
        const p = lfw.player(pid);
        if (!p) push(`apl|${nid}|${pid}|nop`);
        else if (what === "join")
          push(`apl|${nid}|${pid}|${c.player_join(p) ? 1 : 0}|${num(c.players.size)}`);
        else {
          c.player_leave(p);
          push(`apl|${nid}|${pid}|left|${num(c.players.size)}`);
        }
      }
    } else if (op === "scall") {
      const nid = next();
      const what = next();
      const n = tnodes.get(nid)!;
      const c = n.components.find((v) => v instanceof Sounds) as Sounds | undefined;
      if (!c) push(`scall|${nid}|none`);
      else {
        if (what === "start") c.start();
        else if (what === "stop") c.stop();
        else if (what !== "read") c.replay();
        const rec = c as unknown as Rec;
        push(
          `scall|${nid}|${what}|en=${c.enabled ? 1 : 0}|idx=${num(rec.idx)}|tm=${num(rec.time)}|lc=${num(c.loop.count)}|lt=${num(c.loop.times)}`,
        );
      }
    } else if (op === "tsn") {
      const map = (lfw.callbacks as unknown as Rec)._map as Map<string, Rec> | undefined;
      const pack = map?.get("on_enter_next_stage");
      const n = pack ? (pack._set as Set<unknown>).size : 0;
      push(`tsn|n=${n}`);
    } else if (op === "lbk") {
      const nid = next();
      const what = next();
      const n = tnodes.get(nid)!;
      const c = n.components.find((v) => v instanceof LabelButton) as LabelButton | undefined;
      if (!c) push(`lbk|${nid}|none`);
      else {
        if (what === "set") c.text = keyOf(next());
        else if (what === "checked") {
          const v = next();
          c.checked = v === "null" ? null : v === "1";
        }
        push(
          `lbk|${nid}|checked=${renderValue(c.checked)}|resp=${nref(c.responser)}|nc=${esc(c.normal_color)}|hc=${esc(c.hover_color)}|text=${esc(c.text)}`,
        );
      }
    } else if (op === "pct" || op === "pset") {
      const pid = nextKey();
      const p = lfw.player(pid);
      if (op === "pset") {
        const v = Number(next());
        const emit = next() === "1";
        p.set_ctrl(v as never, emit);
      }
      push(`pct|${pid}|ctrl=${renderValue(p.ctrl)}`);
    } else if (op === "wr") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const c = n.components.find((v) => v instanceof WeaponRain) as WeaponRain | undefined;
      if (!c) push(`wr|${nid}|none`);
      else {
        const rec = c as unknown as Rec;
        const timer = rec.timer as Rec;
        push(
          `wr|${nid}|tv=${num(timer.value)}|tmin=${num(timer.min)}|tmax=${num(timer.max)}|ls=${renderValue(rec.last_section)}|n=${num((rec._oid_datas as unknown[]).length)}`,
        );
      }
    } else if (op === "fh") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const c = n.components.find((v) => v instanceof FighterHead) as FighterHead | undefined;
      if (!c) push(`fh|${nid}|none`);
      else {
        (c as unknown as Rec).handle_changed();
        await flush_microtasks();
        push(
          `fh|${nid}|pid=${esc(c.player_id)}|head=${esc(c.head)}|src=${esc(c.src)}|w=${num(c.width)}|h=${num(c.height)}`,
        );
      }
    } else if (op === "ft") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const c = n.components.find((v) => v instanceof FighterThumb) as FighterThumb | undefined;
      if (!c) push(`ft|${nid}|none`);
      else {
        (c as unknown as Rec).handle_changed();
        await flush_microtasks();
        push(
          `ft|${nid}|url=${esc(c.thumb_url)}|src=${esc(c.src)}|w=${num(c.width)}|h=${num(c.height)}`,
        );
      }
    } else if (op === "dcnt") {
      const st = lfw.datas.stages.map((v) => String((v as Rec)["id"])).join(",");
      const bg = lfw.datas.backgrounds.map((v) => String((v as Rec)["id"])).join(",");
      const fg = (lfw.datas as Rec & { fighters: Rec[] }).fighters
        .map((v) => String(v["id"]))
        .join(",");
      push(`dcnt|stages=${st}|bgs=${bg}|fighters=${fg}`);
    } else if (op === "cplayer") {
      const nid = next();
      const act = next();
      const n = tnodes.get(nid)!;
      const c = n.components.find((v) => v instanceof ComponentsPlayer) as
        | ComponentsPlayer
        | undefined;
      if (!c) push(`cplayer|${nid}|none`);
      else {
        if (act === "start") c.start();
        else if (act === "stop") c.stop();
        else if (act === "replay") c.replay();
        const list = (c as unknown as Rec)["components"] as (Rec | null)[];
        const ids = list
          .map((v) => (v ? `${String(v["id"])}@${nref((v as Rec)["node"] as UINode)}` : "u"))
          .join(",");
        push(
          `cplayer|${nid}|${act}|enabled=${c.enabled ? 1 : 0}|playable=${c["__is_playable__"] ? 1 : 0}|ids=${ids}`,
        );
      }
    } else if (op === "sswi") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const c = n.components.find((v) => v instanceof StageSwitcher) as StageSwitcher | undefined;
      if (!c) push(`sswi|${nid}|none`);
      else {
        const list = c.stages as Rec[];
        const st = (c as unknown as Rec)["_stage"] as Rec;
        push(
          `sswi|${nid}|n=${num(list.length)}|all=${c.show_all ? 1 : 0}|id=${String(st?.["id"])}|text=${esc(c.stage_text)}`,
        );
      }
    } else if (op === "bswi") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const c = n.components.find((v) => v instanceof BackgroundSwitcher) as
        | BackgroundSwitcher
        | undefined;
      if (!c) push(`bswi|${nid}|none`);
      else {
        const list = c.backgrounds as Rec[];
        const bg = (c as unknown as Rec)["_background"] as Rec;
        push(`bswi|${nid}|n=${num(list.length)}|id=${String(bg?.["id"])}`);
      }
    } else if (op === "dlg") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const c = n.components.find((v) => v instanceof Dialogs) as Dialogs | undefined;
      if (!c) push(`dlg|${nid}|none`);
      else {
        const tr = (c as unknown as Rec)["_transform"] as Rec;
        push(
          `dlg|${nid}|hiding=${(c as unknown as Rec)["_hiding"] ? 1 : 0}|` +
            `vis=${n.visible ? 1 : 0}|tx=${num(tr["scale_x"] as number)},` +
            `${num(tr["scale_y"] as number)},${num(tr["scale_z"] as number)}|` +
            `wt=${num((lfw.world as Rec)["transform"]["x"] as number)},` +
            `${num((lfw.world as Rec)["transform"]["y"] as number)}|` +
            `wtt=${num((lfw.world as Rec)["transform"]["d"]["x"] as number)},` +
            `${num((lfw.world as Rec)["transform"]["d"]["y"] as number)}`,
        );
      }
    } else if (op === "fx") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const c = n.components.find((v) => v instanceof Flex) as Flex | undefined;
      if (!c) push(`fx|${nid}|none`);
      else {
        const pad = c.padding;
        push(
          `fx|${nid}|${c.direction}|${num(c.gap)}|${num(c.row_gap)}|${num(c.col_gap)}|` +
            `${c.align}|${c.fit ? 1 : 0}|${c.fit_w ? 1 : 0}|${c.fit_h ? 1 : 0}|` +
            `${num(pad[0])}|${num(pad[1])}|${num(pad[2])}|${num(pad[3])}`,
        );
      }
    } else if (op === "jl") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const c = n.components.find((v) => v instanceof Jalousie) as Jalousie | undefined;
      if (!c) push(`jl|${nid}|none`);
      else {
        const anim = c.anim as Rec & { value: number; done: boolean; reverse: boolean };
        push(
          `jl|${nid}|${c.open ? 1 : 0}|${c.click_test ? 1 : 0}|${num(c.w)}|${num(c.h)}|` +
            `v=${num(anim.value)}|done=${anim.done ? 1 : 0}|rev=${anim.reverse ? 1 : 0}|` +
            `dur=${num(anim.duration as number)}|n=${num((anim.anims as Rec[]).length)}`,
        );
      }
    } else if (op === "jlopen") {
      const nid = next();
      const v = next() === "1";
      const n = tnodes.get(nid)!;
      const c = n.components.find((v2) => v2 instanceof Jalousie) as Jalousie | undefined;
      if (c) c.open = v;
    } else if (op === "jsub") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const c = n.components.find((v) => v instanceof Jalousie) as Jalousie | undefined;
      if (c) {
        c.callbacks.add({
          on_anim_end: (v: Jalousie) => push(`jcb|on_anim_end|${v === c ? 1 : 0}`),
        });
      }
    } else if (op === "mtstate") {
      const mt = (lfw as Rec)["_mt"] as Rec;
      push(`mtstate|${num(mt["index"] as number)}|${num(mt["times"] as number)}`);
    } else if (op === "gwcnt") {
      const section = Number(next());
      const count = Number(next());
      ((lfw.world as Rec).ground_weapon_counts as Map<number, number>).set(section, count);
      push(`gwcnt|${num(section)}|${num(count)}`);
    } else if (op === "fhset" || op === "ftset") {
      const nid = nextKey();
      const url = nextKey();
      const n = tnodes.get(nid)!;
      let e: Rec | undefined;
      if (url !== "-") {
        const key = op === "fhset" ? "head" : "small";
        e = { id: "fx", data: { type: 8, id: "fx", base: { [key]: url === "z" ? undefined : url } } };
        fakes.push(e);
      }
      if (op === "fhset") {
        const c = n.components.find((v) => v instanceof FighterHead) as FighterHead | undefined;
        const pid = c?.player_id ?? "";
        lfw.player(pid).fighter = e as never;
        push(`fhset|${pid}|${e ? 1 : 0}`);
      } else {
        const c = n.components.find((v) => v instanceof FighterThumb) as FighterThumb | undefined;
        if (c) (c as unknown as Rec).fighter = e;
        push(`ftset|${nid}|${e ? 1 : 0}`);
      }
    } else if (op === "nact") {
      const n = tnodes.get(next())!;
      actor.act(n, parseValue(t, i) as never);
    } else if (op === "rlnew") {
      real_layers.v = new UILayers(lfw);
    } else if (op === "flset" || op === "flpush") {
      const id = keyOf(next());
      // 4D2：可选层号（缺省 0，照旧）。
      const li = i[0]! < t.length ? Number(t[i[0]!++]!) : 0;
      if (op === "flset") lfw.layers.set_page({ id }, li);
      else lfw.layers.push_page({ id }, li);
    } else if (op === "rlpush") {
      real_layers.v!.push();
    } else if (op === "rlset" || op === "rlpushp") {
      const idx = Number(next());
      const id = keyOf(next());
      if (op === "rlset") real_layers.v!.set_page({ id }, idx);
      else real_layers.v!.push_page({ id }, idx);
    } else if (op === "rlpop") {
      const idx = Number(next());
      const min_pages = Number(next());
      const inclusive = next() === "1";
      const until = next();
      const l = real_layers.v!.at(idx) as UILayer | undefined;
      const opts: IPopPageOpts = { min_pages, inclusive };
      if (until !== "-") opts.until = (u) => u.id === until;
      l?.pop(opts);
    } else if (op === "rldisp") {
      real_layers.v!.dispose();
    } else if (op === "rlinfo") {
      let line = `rlinfo|${num(real_layers.v!.length)}`;
      for (const l of real_layers.v!.all) {
        if (!l) {
          line += "|-";
          continue;
        }
        line += `|${num(l.index)}:${num(l.pages.length)}:${l.ui?.id ?? "u"}`;
      }
      push(line);
    } else if (op === "rlui") {
      const idx = Number(next());
      const u = real_layers.v!.at(idx)?.ui;
      push(`rlui|${num(idx)}|${nref(u)}|${u ? num(u.z) : "u"}`);
    } else if (op === "rlz") {
      const idx = Number(next());
      const u = real_layers.v!.at(idx)?.ui;
      push(`rlz|${num(idx)}|${u ? num(u.z) : "u"}`);
    } else if (op === "rlfind") {
      const idx = Number(next());
      const nid = keyOf(next());
      const u = real_layers.v!.at(idx)?.ui;
      const hit = u ? u.search_node(nid) : undefined;
      push(`rlfind|${num(idx)}|${nref(hit)}|${hit ? num(hit.depth) : "u"}`);
    } else if (op === "rlfocus") {
      const idx = Number(next());
      const nid = keyOf(next());
      const v = next() === "1";
      const hit = real_layers.v!.at(idx)?.ui?.search_node(nid);
      if (hit) hit.focused = v;
    } else if (op === "rlfn") {
      const idx = Number(next());
      const u = real_layers.v!.at(idx)?.ui;
      push(`rlfn|${num(idx)}|${nref(u ? u.root.focused_node : undefined)}`);
    } else if (op === "rltree") {
      const idx = Number(next());
      const u = real_layers.v!.at(idx)?.ui;
      push(`rltree|${num(idx)}|${u ? tree_str(u) : "u"}`);
    } else if (op === "unpatch") {
      // 4AQ：两侧都不再有 uis/layers 补丁（真实现）；占位兼容旧用例。
    } else if (op === "uipg") {
      const id = keyOf(next());
      const v = parseValue(t, i) as Rec;
      v["id"] = id;
      (lfw.uis as unknown as Rec)["add"](v);
    } else if (op === "rlact") {
      const idx = Number(next());
      const ntok = next();
      const action = parseValue(t, i) as never;
      const l = real_layers.v!.at(idx) as UILayer | undefined;
      let u: UINode | undefined = l?.ui;
      if (u && ntok !== "-") u = u.search_node(keyOf(ntok));
      if (u) actor.act(u, action);
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
    } else if (op === "setbgms") {
      const list = parseValue(t, i) as string[];
      const cur = (lfw as unknown as Rec)["bgms"] as string[];
      cur.length = 0;
      for (const b of list) cur.push(b);
      push(`setbgms|${cur.join(",")}`);
    } else if (op === "sndbgm") {
      push(`sndbgm|${snd_probe()}`);
    } else if (op === "sndset") {
      const which = next();
      const v = Number(next());
      snd_set(which, v);
      push(`sndset|${which}|${num(v)}`);
    } else if (op === "sndv") {
      push(snd_v_probe());
    } else if (op === "fpge") {
      const s = nextKey();
      (lfw as unknown as Rec)["first_page"] = s;
      push(`fpge|${s}`);
    } else if (op === "stid") {
      const st = lfw.world.stage as Stage | undefined;
      push(`stid|${st ? st.id : "-"}`);
    } else if (op === "phid") {
      const st = lfw.world.stage as (Stage & { phase_idx?: number }) | undefined;
      push(`phid|${num(st ? (st.phase_idx ?? -1) : -1)}`);
    } else if (op === "ppup") {
      const pid = nextKey();
      const eidx = Number(next());
      const arr = lfw.world.entities as Rec[];
      const pe = eidx >= 0 && eidx < arr.length ? arr[eidx] : undefined;
      (lfw.world.puppets as Map<string, Rec>).set(pid, pe as Rec);
      push(`ppup|${pid}|${pe ? (pe.id as string) : "none"}`);
    } else if (op === "ctrlq") {
      // 台面探针：`world.puppets` 里该玩家实体的控制器队列（`KEY_EVENT` 落 `start`/`end` 的地方）。
      // 只打 `KEY_EVENT` 用来放行的 `is_human_ctrl(ctrl)`（TS 侧「没控制器」是 `undefined`）。
      const pid = nextKey();
      const pe = (lfw.world.puppets as Map<string, Rec>).get(pid);
      const c = pe ? (pe["ctrl"] as Rec | undefined) : undefined;
      const human = !!c && is_human_ctrl(c);
      let line = `ctrlq|${pid}|${human ? "h" : "b"}`;
      if (human && c) {
        const q = c["queue"] as [number, string][];
        line += `|${q.length}`;
        for (const e of q) line += `|${num(e[0])}:${e[1]}`;
      }
      push(line);
    } else if (op === "bcasts") {
      push(`bcasts|${(lfw.broadcasts as string[]).join(";")}`);
    } else if (op === "edump") {
      // 4BR：实体全字段快照（DemoMode 的摆位/朝向/血量族）；负数下标从尾数起。
      const idx = Number(next());
      const arr = lfw.world.entities as Rec[];
      const at = idx < 0 ? arr.length + idx : idx;
      const e = at >= 0 && at < arr.length ? (arr[at] as Rec) : undefined;
      if (!e) {
        push(`edump|${num(idx)}|none`);
      } else {
        const pos = e["position"] as Rec;
        push(
          `edump|${num(idx)}|id=${String(e["id"])}|team=${String(e["team"])}|x=${num(Number(pos["x"]))}|y=${num(Number(pos["y"]))}|z=${num(Number(pos["z"]))}|f=${num(Number(e["facing"]))}|mp=${num(Number(e["mp"]))}|hp=${num(Number(e["hp"]))}|bl=${num(Number(e["blinking"]))}|inv=${num(Number(e["invulnerable"]))}`,
        );
      }
    } else if (op === "nkeyp") {
      const nid = next();
      const pid = nextKey();
      const dir = next();
      const gk = nextKey();
      const key = nextKey();
      const pre = t[i[0]] === "1";
      if (pre) ++i[0];
      const n = tnodes.get(nid)!;
      const e = new LFWKeyEvent(pid, dir === "down", gk as never, key);
      if (pre) e.stop_immediate_propagation();
      if (dir === "down") n.on_key_down(e);
      else n.on_key_up(e);
      push(`nkeyp|${nid}|${pid}|${dir}|stop=${e.stopped}`);
    } else if (op === "cmprobe") {
      const nid = next();
      const n = tnodes.get(nid)!;
      const cm = n.components.find((c) => c instanceof CharMenuLogic) as CharMenuLogic | undefined;
      if (!cm) push(`cmprobe|${nid}|none`);
      else {
        const parts: string[] = [`cmprobe|${nid}`];
        parts.push(`com=${num(cm.com_num)}`);
        parts.push(`fsm=${cm.fsm.state ? String((cm.fsm.state as unknown as Rec).key) : ""}`);
        parts.push(`prev=${cm.prev_players.size}`);
        const ps: string[] = [];
        for (const [p, s] of cm.players) {
          ps.push(
            `${p.id}:${s.step}:${s.random ? 1 : 0}:${s.team}:${s.fighter ? String((s.fighter as unknown as Rec).id) : ""}`,
          );
        }
        parts.push(`ps=${ps.join(",")}`);
        parts.push(`slots=${cm.slots.length}`);
        parts.push(`max=${num(cm.max_player)}`);
        parts.push(`min=${num(cm.min_player)}`);
        parts.push(`tms=${cm.teams.join(",")}`);
        parts.push(`oids=${cm.oids ? cm.oids.length : "z"}`);
        const rnd = (cm as unknown as Rec)["_randoming"] as Randoming<unknown> | undefined;
        parts.push(`rnd=${rnd ? rnd.src.length : 0}`);
        const foc = n.root.focused_node as UINode | undefined;
        parts.push(`foc=${foc ? String(foc.id) : "-"}`);
        push(parts.join("|"));
      }
    } else if (op === "plist") {
      const out: string[] = ["plist"];
      for (const p of lfw.players.values()) out.push(`${p.id}:${p.is_com ? 1 : 0}`);
      push(out.join("|"));
    } else if (op === "srankdata") {
      lfw.set_survival_rank_data(parseValue(t, i) as never);
    } else if (op === "sprobe") {
      push(`sprobe|${is_survival_rank_mode(lfw.game_mode) ? 1 : 0}|${lfw.survival_rank_available ? 1 : 0}|${lfw.game_mode === GameMode.SurvivalRank2P ? 1 : 0}`);
    } else if (op === "wbg") {
      const bg = lfw.world.bg as { id?: string } | undefined;
      push(`wbg|${bg ? String(bg.id) : "-"}`);
    } else if (op === "cprops") {
      const nid = next();
      const cid = keyOf(next());
      const key = keyOf(next());
      const v = parseValue(t, i);
      const n = tnodes.get(nid)!;
      const found = n.components.find((c) => c.id === cid);
      if (!found) push(`cprops|${nid}|none`);
      else {
        try {
          (found.props as Rec)[key] = v;
          push(`cprops|${nid}|${key}|${renderValue(v)}`);
        } catch (e) {
          push(`cprops|${nid}|err|${esc(err_msg(e))}`);
        }
      }
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
const fakes: Rec[] = [];
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

function make_real_entity(world: unknown, data: Rec): unknown {
  // TS `Entity.reset` 直接点读 `data.base.*`（C++ 端是宽容 `opt_num`）⇒ 台面补空 base 兜底。
  // ⚠ 不整对象展开：DatMgr 的实体数据带 `xml*` 访问器（enumerable getter），一旦读取就会调
  // `Ditto.XML`（台面没有 create）⇒ 逐键拷贝时先滤掉 `xml*` 键（同 `entadd` 的原则）。
  const richer: Rec = {};
  for (const k of Object.keys(data)) {
    if (k.startsWith("xml")) continue;
    richer[k] = data[k];
  }
  if (!richer["base"]) richer["base"] = {};
  if (!richer["frames"]) richer["frames"] = [];
  return new Entity(world as never, richer as never);
}

function team_to_bool(t: string): boolean | undefined {
  if (t === "-") return undefined;
  return t === "1";
}

Factory.entity_creators.set(8 as never, ((world: unknown, data: Rec) => {
  push("entadd:create|" + String(data?.["id"]));
  return make_real_entity(world, data);
}) as never);
// 4BP：非战士实体（`is_fighter` 筛选用）。
Factory.entity_creators.set(4 as never, ((world: unknown, data: Rec) => {
  push("entadd:create|" + String(data?.["id"]));
  return make_real_entity(world, data);
}) as never);

main();
