import type { IPointingEvent } from "./LFW/ditto/pointings";
import type { IUIInputHandle } from "./LFW/ditto/ui/IEventHandle";
import { Ditto } from "./LFW/ditto/Instance";
import type { LFW } from "./LFW/LFW";
import { UINode } from "./LFW/ui/UINode";
import { get_ui_snapshot, type IUISnapshotItem } from "./DittoImpl/renderer/HeadlessUINodeRenderer";

/**
 * 无头 UI 回归测试的运行器（配合 `?headless_ui=1` 使用）。
 *
 * 为什么放在应用里而不是用 playwright：项目没有浏览器自动化依赖；这里直接把合成指针事件
 * 喂进 `lfw.pointings.callback`，走的是**和真实用户输入同一条回调链**（Pointings → UIInputHandle
 * → push_cmd → CMD_POINTER_EVENTS → UINode 分发），只跳过了 DOM 事件到 scene 坐标的换算。
 */

export interface IUITestStep {
  name: string;
  action: "wait" | "click_ui" | "click_id";
  /** click_ui 用：UI 坐标（794x450 空间，左上为原点） */
  at?: [number, number];
  /** click_id 用：节点的 data.id */
  id?: string;
  /** 动作后期望的页面 id（`UINode.id`）；用于等页面切换完，避免在转场中途取样 */
  expect_page?: string;
  /** expect_page 的超时（默认 15s；过 loading 这种要加载数据的步骤需要放宽） */
  timeout_ms?: number;
}

export interface IUITestStepResult {
  name: string;
  settled: boolean;
  page: string | null;
  page_ok: boolean;
  error?: string;
  nodes: IUISnapshotItem[];
}

const sleep = (ms: number) => new Promise<void>((r) => globalThis.setTimeout(r, ms));

export const SCENARIOS: Record<string, IUITestStep[]> = {
  /** 入口页 + 设置页往返 */
  entry: [
    { name: "launch", action: "wait", expect_page: "init" },
    { name: "entry", action: "click_ui", at: [397, 225], expect_page: "entry" },
    { name: "settings", action: "click_id", id: "btn_ctrl_settings", expect_page: "settings" },
    { name: "back", action: "click_id", id: "btn_exit_settings", expect_page: "entry" },
  ],
  /** 走 Game Start 真正加载数据包，一路等到主页（含 data.zip 下载/解析） */
  main_menu: [
    { name: "launch", action: "wait", expect_page: "init" },
    { name: "entry", action: "click_ui", at: [397, 225], expect_page: "entry" },
    { name: "start_game", action: "click_id", id: "btn_game_start", expect_page: "main_page", timeout_ms: 60000 },
  ],
};

function find_node(root: UINode, id: string): UINode | undefined {
  if (root.id === id) return root;
  const children = root.children;
  for (let i = 0; i < children.length; i++) {
    const hit = find_node(children[i], id);
    if (hit) return hit;
  }
  return undefined;
}

/** UI 坐标 → scene 坐标（`pos_arg` 的逆运算） */
function pointer_event(lfw: LFW, x: number, y: number, button: number = 0): IPointingEvent {
  const { screen_w, screen_h } = lfw.world.dataset;
  return {
    x,
    y,
    scene_x: (x / screen_w) * 2 - 1,
    scene_y: 1 - (y / screen_h) * 2,
    is_pointing_event: true,
    button,
    delta_x: 0,
    delta_y: 0,
  };
}

/** 等 n 个世界步 */
async function wait_ticks(lfw: LFW, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    const t = lfw.world.lifetime;
    const deadline = Date.now() + 1000;
    while (lfw.world.lifetime === t && Date.now() < deadline) await sleep(16);
  }
}

/** 树结构签名（只取可见节点的 id + 取整位置），用于判断动画是否稳定 */
function structure_key(): string {
  const nodes = get_ui_snapshot();
  let key = `${nodes.length}|`;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!n.visible) continue;
    key += `${n.id},${Math.round(n.x)},${Math.round(n.y)},${Math.round(n.w)},${Math.round(n.h)};`;
  }
  return key;
}

/** 等界面稳定：可见节点集合 + 位置连续 stable_ms 不变 */
async function settle(lfw: LFW, stable_ms = 600, timeout_ms = 10000): Promise<boolean> {
  const t0 = Date.now();
  let last = "";
  let last_change = Date.now();
  while (Date.now() - t0 < timeout_ms) {
    await wait_ticks(lfw, 2);
    const key = structure_key();
    if (key !== last) {
      last = key;
      last_change = Date.now();
    } else if (Date.now() - last_change >= stable_ms) {
      return true;
    }
    await sleep(60);
  }
  return false;
}

/** 等页面切到指定 id（转场有动画，不能靠"结构不变"判定） */
async function wait_page(lfw: LFW, id: string, timeout_ms = 15000): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout_ms) {
    if (lfw.ui?.id === id) return true;
    await sleep(50);
  }
  return false;
}

/** 合成一次点击：enter → move → down → up，与真实输入顺序一致 */
async function click_ui(
  lfw: LFW,
  handle: IUIInputHandle,
  x: number,
  y: number,
): Promise<void> {
  const move = pointer_event(lfw, x, y);
  handle.on_pointer_enter(move);
  handle.on_pointer_move(move);
  await wait_ticks(lfw, 2);
  handle.on_pointer_down(pointer_event(lfw, x, y));
  await wait_ticks(lfw, 2);
  handle.on_pointer_up(pointer_event(lfw, x, y));
  await wait_ticks(lfw, 2);
}

export async function ui_test_run(
  lfw: LFW,
  scenario: string | IUITestStep[] = "entry",
): Promise<{ scenario: string; steps: IUITestStepResult[] }> {
  const name = typeof scenario === "string" ? scenario : "inline";
  const steps = typeof scenario === "string" ? SCENARIOS[scenario] : scenario;
  if (!steps) throw new Error(`[ui_test_run] 未知场景: ${scenario}`);
  const out: IUITestStepResult[] = [];
  // 用被注入的那个实现（?headless_ui=1 时就是 HeadlessUIInputHandle），只跳过 DOM→scene 换算
  const handle = new Ditto.UIInputHandle(lfw);
  for (const step of steps) {
    let error: string | undefined;
    if (step.action === "click_ui") {
      if (!step.at) {
        error = "click_ui 缺少 at";
      } else {
        await click_ui(lfw, handle, step.at[0], step.at[1]);
      }
    } else if (step.action === "click_id") {
      const root = lfw.ui;
      const node = root && step.id ? find_node(root, step.id) : undefined;
      if (!node) error = `找不到节点: ${step.id}`;
      else {
        const g = node.geo;
        await click_ui(lfw, handle, (g.left + g.right) / 2, (g.top + g.bottom) / 2);
      }
    }
    let page_ok = true;
    if (!error && step.expect_page) page_ok = await wait_page(lfw, step.expect_page, step.timeout_ms);
    const settled = error ? false : await settle(lfw);
    out.push({
      name: step.name,
      settled,
      page: lfw.ui?.id ?? null,
      page_ok,
      error,
      nodes: get_ui_snapshot(),
    });
  }
  const result = { scenario: name, steps: out };
  // 开发期落盘（vite 中间件，见 vite.config.ts 的 ui_snapshot_sink_plugin）；生产环境静默失败
  try {
    await fetch(`/__ui-snapshot?scenario=${encodeURIComponent(name)}`, {
      method: "POST",
      body: JSON.stringify(result),
    });
  } catch { /* 非 dev server 时忽略 */ }
  return result;
}
