import { CMD } from "../defines/CMD";
import { Ditto } from "../ditto/Instance";
import { LFWPointerEvent } from "../ui/LFWPointerEvent";
import { type UINode } from "../ui/UINode";
import { type World } from "../World";
import { CMDS } from "./CMDS";

const help_down = `Usage: POINTER_DOWN --paths=<layer>,<index>,<child>,... --pages=<page_id> --points=<x,y,z> --b=<button>

Replay a pointer-down hit list on the local UI, near to far / 按近到远在本地 UI 上重放一次指针按下命中列表

Options:
  --paths   <layer>,<页面栈下标>,<子节点索引>...，多项以 | 分隔 / node paths, '|' separated
  --pages   页面 id，各项须相同；用于校验下标处页面未变 / page id, same for every entry, checked against the page at that index
  --points  每项命中点 x,y,z，与 --paths 一一对应（只给指针位置用 --pos）/ hit point of each entry, pairs with '--paths' (use '--pos' for the pointer position)
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --b       0 left / 1 middle / 2 right
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally`;

const help_move = `Usage: POINTER_MOVE --paths=<layer>,<index>,<child>,... --pages=<page_id> --points=<x,y,z> --b=<button>

Replay a pointer-move on the local UI, enter/leave are derived by diff; omit '--paths' / '--pages' for no hits / 在本地 UI 上重放一次指针移动，enter/leave 由差异推导；省略 '--paths'/'--pages' 表示无命中（全体 leave）

Options:
  --paths   <layer>,<页面栈下标>,<子节点索引>...，多项以 | 分隔 / node paths, '|' separated
  --pages   页面 id，各项须相同 / page id, same for every entry
  --points  每项命中点 x,y,z，与 --paths 一一对应（只给指针位置用 --pos）/ hit point of each entry, pairs with '--paths' (use '--pos' for the pointer position)
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --b       0 left / 1 middle / 2 right
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally`;

const help_up = `Usage: POINTER_UP --paths=<layer>,<index>,<child>,... --pages=<page_id> --points=<x,y,z> --b=<button>

Replay a pointer-up on the local UI, then click and cancel leftovers; omit '--paths' / '--pages' for no hits / 重放指针抬起，随后派发 click 并取消未收到 up 的按下节点；省略 '--paths'/'--pages' 表示无命中（取消全部按下）

Options:
  --paths   <layer>,<页面栈下标>,<子节点索引>...，多项以 | 分隔 / node paths, '|' separated
  --pages   页面 id，各项须相同 / page id, same for every entry
  --points  每项命中点 x,y,z，与 --paths 一一对应（只给指针位置用 --pos）/ hit point of each entry, pairs with '--paths' (use '--pos' for the pointer position)
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --b       0 left / 1 middle / 2 right
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally`;

const help_click = `Usage: POINTER_CLICK --paths=<layer>,<index>,<child>,... --pages=<page_id> --points=<x,y,z> --b=<button>

Replay one atomic click on the local UI, dispatch 'on_click' only, near to far / 在本地 UI 上重放一次原子点击，只派发 on_click（近到远）

Options:
  --paths   <layer>,<页面栈下标>,<子节点索引>...，多项以 | 分隔 / node paths, '|' separated
  --pages   页面 id，各项须相同 / page id, same for every entry
  --points  每项命中点 x,y,z，与 --paths 一一对应（只给指针位置用 --pos）/ hit point of each entry, pairs with '--paths' (use '--pos' for the pointer position)
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --b       0 left / 1 middle / 2 right
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally`;

const help_cancel = `Usage: POINTER_CANCEL --b=<button>

Cancel every node still pressed in the local UI / 取消本地 UI 中所有仍处于按下状态的节点

Options:
  --b       0 left / 1 middle / 2 right
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally`;

const help_enter = `Usage: POINTER_ENTER --paths=<layer>,<index>,<child>,... --pages=<page_id>

Dispatch pointer-enter on the local UI / 在本地 UI 上派发指针进入

Options:
  --paths   <layer>,<页面栈下标>,<子节点索引>...，多项以 | 分隔 / node paths, '|' separated
  --pages   页面 id，各项须相同 / page id, same for every entry
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally`;

const help_leave = `Usage: POINTER_LEAVE --paths=<layer>,<index>,<child>,... --pages=<page_id>

Dispatch pointer-leave on the local UI; omit '--paths' / '--pages' when the pointer leaves the surface, leaving every hovered node and marking the initiator's cursor hidden / 在本地 UI 上派发指针离开；省略 '--paths'/'--pages' 表示指针离开画面：所有悬停节点 leave，并标记该发起方光标隐藏

Options:
  --paths   <layer>,<页面栈下标>,<子节点索引>...，多项以 | 分隔 / node paths, '|' separated
  --pages   页面 id，各项须相同 / page id, same for every entry
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally`;

interface IPointerTargets {
  paths: number[][];
  pages: string[];
  points: number[][];
}

interface IPointerState {
  down_uis: Set<UINode>;
  on_uis: Set<UINode>;
  cursors: Map<string, IPointerCursor>;
}

export interface IPointerCursor {
  x: number;
  y: number;
  down: boolean;
  hidden: boolean;
  t: number;
}

const _pointer_states = new WeakMap<World, IPointerState>();

export function get_pointer_cursors(world: World): Map<string, IPointerCursor> | undefined {
  return _pointer_states.get(world)?.cursors;
}

function state_of(world: World): IPointerState {
  let state = _pointer_states.get(world);
  if (!state) {
    state = {
      down_uis: new Set<UINode>(),
      on_uis: new Set<UINode>(),
      cursors: new Map<string, IPointerCursor>(),
    };
    _pointer_states.set(world, state);
  }
  return state;
}

function pointer_state(c: CMDS): IPointerState {
  return state_of(c.world);
}

function cursor_for(state: IPointerState, from: string): IPointerCursor {
  let cursor = state.cursors.get(from);
  if (!cursor) {
    cursor = { x: 0, y: 0, down: false, hidden: true, t: 0 };
    state.cursors.set(from, cursor);
  }
  return cursor;
}

export function set_local_cursor(world: World, x: number, y: number, hidden: boolean | undefined, down: boolean | undefined): void {
  const cursor = cursor_for(state_of(world), '');
  cursor.x = x;
  cursor.y = y;
  if (hidden != void 0) cursor.hidden = hidden;
  if (down != void 0) cursor.down = down;
  cursor.t = Ditto.Clock.now();
}

function move_cursor(c: CMDS, hidden: boolean | undefined, down?: boolean): IPointerCursor | undefined {
  const from = c.str_arg('--from');
  if (!from) return;
  const cursor = cursor_for(pointer_state(c), from);
  const pos = c.nums_arg('--pos');
  if (pos && Number.isFinite(pos[0]) && Number.isFinite(pos[1])) {
    cursor.x = pos[0];
    cursor.y = pos[1];
  }
  if (hidden != void 0) cursor.hidden = hidden;
  if (down != void 0) cursor.down = down;
  cursor.t = Ditto.Clock.now();
  return cursor;
}

function read_targets(tag: string, c: CMDS, need_points: boolean): IPointerTargets | undefined {
  const paths_raw = c.str_arg('--paths') ?? '';
  const pages_raw = c.str_arg('--pages') ?? '';
  const points_raw = c.str_arg('--points') ?? '';
  const path_parts = paths_raw ? paths_raw.split('|') : [];
  const page_parts = pages_raw ? pages_raw.split('|') : [];
  const point_parts = points_raw ? points_raw.split('|') : [];
  if (path_parts.length !== page_parts.length) {
    Ditto.warn(
      `[${tag}] failed, '--paths' and '--pages' count mismatch: ` +
        `${path_parts.length} paths vs ${page_parts.length} pages, got: ${c.cmd}`,
    );
    return;
  }
  if (point_parts.length !== path_parts.length && (need_points || point_parts.length)) {
    // `--points` 是「每个命中目标各自的命中点」，必须和 `--paths` 一一对应；
    // 只给一个点没有意义（那是 `--pos`，指针位置，无命中时也有）
    if (path_parts.length === 0) {
      Ditto.warn(
        `[${tag}] failed, '--points' needs '--paths'/'--pages': got ` +
          `${point_parts.length} points, 0 paths; use '--pos=<x>,<y>' for the pointer position, ` +
          `got: ${c.cmd}`,
      );
    } else {
      Ditto.warn(
        `[${tag}] failed, '--points' count mismatch: ` +
          `${point_parts.length} points vs ${path_parts.length} paths, got: ${c.cmd}`,
      );
    }
    return;
  }
  const paths: number[][] = [];
  const pages: string[] = [];
  const points: number[][] = [];
  for (let i = 0; i < path_parts.length; i++) {
    const path = path_parts[i].split(',').map(Number);
    const page = page_parts[i];
    const point_raw = i < point_parts.length ? point_parts[i] : void 0;
    const point = point_raw ? point_raw.split(',').map(Number) : void 0;
    if (path.length < 2 || path.some(v => !Number.isInteger(v) || v < 0)) {
      Ditto.warn(`[${tag}] failed, invalid path: '${path_parts[i]}', got: ${c.cmd}`);
      return;
    }
    if (!page) {
      Ditto.warn(`[${tag}] failed, invalid page id: '${page_parts[i]}', got: ${c.cmd}`);
      return;
    }
    if (point && (point.length !== 3 || point.some(v => !Number.isFinite(v)))) {
      Ditto.warn(`[${tag}] failed, invalid point: '${point_raw}', got: ${c.cmd}`);
      return;
    }
    if (paths.length) {
      const first = paths[0];
      if (path[0] !== first[0] || path[1] !== first[1] || page !== pages[0]) {
        Ditto.warn(`[${tag}] failed, entries must target the same page, got: ${c.cmd}`);
        return;
      }
    }
    paths.push(path);
    pages.push(page);
    if (point) points.push(point);
  }
  return { paths, pages, points };
}

function read_button(tag: string, c: CMDS): number | undefined {
  const b = c.num_arg('--b');
  if (b == void 0 || !Number.isFinite(b)) {
    Ditto.warn(`[${tag}] failed, invalid '--b', got: ${c.cmd}`);
    return;
  }
  return b;
}

function read_page(tag: string, c: CMDS, layer_idx: number, page_idx: number, page_id: string): UINode | undefined {
  const layer = c.world.lfw.layers.at(layer_idx);
  if (!layer) {
    Ditto.warn(`[${tag}] layer not found: ${layer_idx}`);
    return;
  }
  const page = layer.at(page_idx);
  if (!page) {
    Ditto.warn(`[${tag}] page not found: ${page_idx}, expected '${page_id}'`);
    return;
  }
  if (page.id !== page_id) {
    Ditto.warn(`[${tag}] page changed, index ${page_idx} is '${page.id}', expected '${page_id}'`);
    return;
  }
  return page;
}

function read_child(tag: string, page: UINode, path: number[]): UINode | undefined {
  let node: UINode | undefined = page;
  for (let i = 2; i < path.length; i++) {
    if (!node) break;
    node = node.children[path[i]];
  }
  if (!node) Ditto.warn(`[${tag}] node not found, path: ${path.join(',')}`);
  return node;
}

CMDS.register(CMD.POINTER_DOWN, help_down, (c) => {
  const targets = read_targets(CMD.POINTER_DOWN, c, true);
  if (!targets) return;
  const b = read_button(CMD.POINTER_DOWN, c);
  if (b == void 0) return;
  move_cursor(c, false, true);
  const { paths, pages, points } = targets;
  const page = paths.length ? read_page(CMD.POINTER_DOWN, c, paths[0][0], paths[0][1], pages[0]) : void 0;
  if (!page) return;
  const state = pointer_state(c);
  for (let i = 0; i < paths.length; i++) {
    const ui = read_child(CMD.POINTER_DOWN, page, paths[i]);
    if (!ui || !ui.visible || ui.disabled) continue;
    state.down_uis.add(ui);
    const [x, y, z] = points[i];
    const event = new LFWPointerEvent(Ditto.vec3(x, y, z), b);
    ui.on_pointer_down(event);
    if (event.stopped) break;
  }
});

CMDS.register(CMD.POINTER_MOVE, help_move, (c) => {
  const targets = read_targets(CMD.POINTER_MOVE, c, true);
  if (!targets) return;
  const b = read_button(CMD.POINTER_MOVE, c);
  if (b == void 0) return;
  move_cursor(c, false);
  const { paths, pages, points } = targets;
  const { on_uis } = pointer_state(c);
  const enter_uis = new Set<UINode>();
  const stay_uis = new Set<UINode>();
  const page = paths.length ? read_page(CMD.POINTER_MOVE, c, paths[0][0], paths[0][1], pages[0]) : void 0;
  if (page) {
    for (let i = 0; i < paths.length; i++) {
      const ui = read_child(CMD.POINTER_MOVE, page, paths[i]);
      if (!ui || !ui.visible || ui.disabled) continue;
      const [x, y, z] = points[i];
      ui.on_pointer_move(new LFWPointerEvent(Ditto.vec3(x, y, z), b));
      if (on_uis.has(ui)) {
        on_uis.delete(ui);
        stay_uis.add(ui);
      } else {
        enter_uis.add(ui);
      }
    }
  }
  for (const ui of on_uis) ui.on_pointer_leave();
  on_uis.clear();
  for (const ui of enter_uis) {
    ui.on_pointer_enter();
    on_uis.add(ui);
  }
  for (const ui of stay_uis) on_uis.add(ui);
});

CMDS.register(CMD.POINTER_UP, help_up, (c) => {
  const targets = read_targets(CMD.POINTER_UP, c, true);
  if (!targets) return;
  const b = read_button(CMD.POINTER_UP, c);
  if (b == void 0) return;
  move_cursor(c, false, false);
  const state = pointer_state(c);
  const { paths, pages, points } = targets;
  const page = paths.length ? read_page(CMD.POINTER_UP, c, paths[0][0], paths[0][1], pages[0]) : void 0;
  if (page) {
    const uis: UINode[] = [];
    const pts: number[][] = [];
    for (let i = 0; i < paths.length; i++) {
      const ui = read_child(CMD.POINTER_UP, page, paths[i]);
      if (!ui || !ui.visible || ui.disabled) continue;
      uis.push(ui);
      pts.push(points[i]);
    }
    for (let i = 0; i < uis.length; i++) {
      const ui = uis[i];
      if (!ui.pointer_down) continue;
      state.down_uis.delete(ui);
      const [x, y, z] = pts[i];
      const event = new LFWPointerEvent(Ditto.vec3(x, y, z), b);
      ui.on_pointer_up(event);
      if (event.stopped) break;
    }
    for (let i = 0; i < uis.length; i++) {
      const ui = uis[i];
      if (!ui.click_flag) continue;
      const [x, y, z] = pts[i];
      const event = new LFWPointerEvent(Ditto.vec3(x, y, z), b);
      ui.on_click(event);
      if (event.stopped) break;
    }
  }
  for (const ui of state.down_uis) {
    const event = new LFWPointerEvent(Ditto.vec3(NaN, NaN, NaN), b);
    ui.on_pointer_cancel(event);
  }
  state.down_uis.clear();
});

CMDS.register(CMD.POINTER_CLICK, help_click, (c) => {
  const targets = read_targets(CMD.POINTER_CLICK, c, true);
  if (!targets) return;
  const b = read_button(CMD.POINTER_CLICK, c);
  if (b == void 0) return;
  const { paths, pages, points } = targets;
  const page = paths.length ? read_page(CMD.POINTER_CLICK, c, paths[0][0], paths[0][1], pages[0]) : void 0;
  if (!page) return;
  for (let i = 0; i < paths.length; i++) {
    const ui = read_child(CMD.POINTER_CLICK, page, paths[i]);
    if (!ui || !ui.visible || ui.disabled) continue;
    const [x, y, z] = points[i];
    const event = new LFWPointerEvent(Ditto.vec3(x, y, z), b);
    ui.on_click(event);
    if (event.stopped) break;
  }
});

CMDS.register(CMD.POINTER_CANCEL, help_cancel, (c) => {
  const b = read_button(CMD.POINTER_CANCEL, c);
  if (b == void 0) return;
  move_cursor(c, void 0, false);
  const state = pointer_state(c);
  for (const ui of state.down_uis) {
    const event = new LFWPointerEvent(Ditto.vec3(NaN, NaN, NaN), b);
    ui.on_pointer_cancel(event);
  }
  state.down_uis.clear();
});

CMDS.register(CMD.POINTER_ENTER, help_enter, (c) => {
  const targets = read_targets(CMD.POINTER_ENTER, c, false);
  if (!targets) return;
  move_cursor(c, false);
  const { paths, pages } = targets;
  const page = paths.length ? read_page(CMD.POINTER_ENTER, c, paths[0][0], paths[0][1], pages[0]) : void 0;
  if (!page) return;
  const state = pointer_state(c);
  for (let i = 0; i < paths.length; i++) {
    const ui = read_child(CMD.POINTER_ENTER, page, paths[i]);
    if (!ui || !ui.visible || ui.disabled) continue;
    ui.on_pointer_enter();
    state.on_uis.add(ui);
  }
});

CMDS.register(CMD.POINTER_LEAVE, help_leave, (c) => {
  const targets = read_targets(CMD.POINTER_LEAVE, c, false);
  if (!targets) return;
  const { paths, pages } = targets;
  const state = pointer_state(c);
  if (!paths.length) {
    move_cursor(c, true);
    for (const ui of state.on_uis) ui.on_pointer_leave();
    state.on_uis.clear();
    return;
  }
  const page = read_page(CMD.POINTER_LEAVE, c, paths[0][0], paths[0][1], pages[0]);
  if (!page) return;
  for (let i = 0; i < paths.length; i++) {
    const ui = read_child(CMD.POINTER_LEAVE, page, paths[i]);
    if (!ui) continue;
    ui.on_pointer_leave();
    state.on_uis.delete(ui);
  }
});
