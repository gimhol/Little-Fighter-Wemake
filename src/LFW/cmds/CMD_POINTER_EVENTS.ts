import type { IVector3 } from "../defines";
import { CMD } from "../defines/CMD";
import { Ditto } from "../ditto/Instance";
import { LFWPointerEvent } from "../ui/LFWPointerEvent";
import { type UINode } from "../ui/UINode";
import { type World } from "../World";
import { CMDS } from "./CMDS";

const help_down = `Usage: POINTER_DOWN --paths=<layer>,<index>,<child>,... --points=<x,y,z> --b=<button>

Replay a pointer-down hit list on the local UI, near to far / 按近到远在本地 UI 上重放一次指针按下命中列表

Options:
  --paths   <layer>,<页面栈下标>,<子节点索引>...，多项以 | 分隔 / node paths, '|' separated
  --points  每项命中点 x,y,z，与 --paths 一一对应（只给指针位置用 --pos）/ hit point of each entry, pairs with '--paths' (use '--pos' for the pointer position)
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --b       0 left / 1 middle / 2 right
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally`;

const help_move = `Usage: POINTER_MOVE --paths=<layer>,<index>,<child>,... --points=<x,y,z> --b=<button>

Replay a pointer-move on the local UI, enter/leave are derived by diff; omit '--paths' / '--pages' for no hits / 在本地 UI 上重放一次指针移动，enter/leave 由差异推导；省略 '--paths'/'--pages' 表示无命中（全体 leave）

Options:
  --paths   <layer>,<页面栈下标>,<子节点索引>...，多项以 | 分隔 / node paths, '|' separated
  --points  每项命中点 x,y,z，与 --paths 一一对应（只给指针位置用 --pos）/ hit point of each entry, pairs with '--paths' (use '--pos' for the pointer position)
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --b       0 left / 1 middle / 2 right
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally`;

const help_up = `Usage: POINTER_UP --paths=<layer>,<index>,<child>,... --points=<x,y,z> --b=<button>

Replay a pointer-up on the local UI, then click and cancel leftovers; omit '--paths' / '--pages' for no hits / 重放指针抬起，随后派发 click 并取消未收到 up 的按下节点；省略 '--paths'/'--pages' 表示无命中（取消全部按下）

Options:
  --paths   <layer>,<页面栈下标>,<子节点索引>...，多项以 | 分隔 / node paths, '|' separated
  --points  每项命中点 x,y,z，与 --paths 一一对应（只给指针位置用 --pos）/ hit point of each entry, pairs with '--paths' (use '--pos' for the pointer position)
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --b       0 left / 1 middle / 2 right
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally`;

const help_click = `Usage: POINTER_CLICK --paths=<layer>,<index>,<child>,... --points=<x,y,z> --b=<button>

Replay one atomic click on the local UI, dispatch 'on_click' only, near to far / 在本地 UI 上重放一次原子点击，只派发 on_click（近到远）

Options:
  --paths   <layer>,<页面栈下标>,<子节点索引>...，多项以 | 分隔 / node paths, '|' separated
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

const help_enter = `Usage: POINTER_ENTER --paths=<layer>,<index>,<child>,...

Dispatch pointer-enter on the local UI / 在本地 UI 上派发指针进入

Options:
  --paths   <layer>,<页面栈下标>,<子节点索引>...，多项以 | 分隔 / node paths, '|' separated
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally`;

const help_leave = `Usage: POINTER_LEAVE --paths=<layer>,<index>,<child>,...

Dispatch pointer-leave on the local UI; omit '--paths' / '--pages' when the pointer leaves the surface, leaving every hovered node and marking the initiator's cursor hidden / 在本地 UI 上派发指针离开；省略 '--paths'/'--pages' 表示指针离开画面：所有悬停节点 leave，并标记该发起方光标隐藏

Options:
  --paths   <layer>,<页面栈下标>,<子节点索引>...，多项以 | 分隔 / node paths, '|' separated
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally`;

interface IPointerTargets {
  nodes: UINode[];
  points: IVector3[];
  button: number | undefined;
  from: string | undefined;
  me: string | undefined;
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

function read_targets(tag: string, c: CMDS): IPointerTargets | undefined {
  const button = c.num_arg('--b');
  const from = c.str_arg('--from');
  const me = c.str_arg('--me');
  const paths_raw = c.str_arg('--paths') ?? '';
  const points_raw = c.str_arg('--points') ?? '';
  const path_parts = paths_raw ? paths_raw.split('|') : [];
  const point_parts = points_raw ? points_raw.split('|') : [];

  const nodes: UINode[] = []
  const points: IVector3[] = [];
  for (let i = 0; i < path_parts.length; i++) {
    const path = path_parts.at(i)?.split(',').map(Number);
    const point = point_parts.at(i)?.split(',').map(Number);
    if (!path || path.length < 2 || path.some(v => !Number.isInteger(v) || v < 0)) {
      Ditto.warn(`[${tag}] failed, invalid path: '${path_parts.at(i)}', got: ${c.cmd}`);
      return;
    }
    if (point?.some(v => !Number.isFinite(v))) {
      Ditto.warn(`[${tag}] failed, invalid point: '${point_parts.at(i)}', got: ${c.cmd}`);
      return;
    }
    const node = read_node(tag, c, path)
    if (!node) return;
    nodes.push(node);
    points.push(Ditto.vec3(point?.at(0), point?.at(1), point?.at(2)))
  }
  return { nodes, points, from, button, me };
}


function read_node(tag: string, c: CMDS, path: number[]): UINode | undefined {
  if (path.length < 0) return;
  const [layer_idx, page_idx] = path;
  const layer = c.world.lfw.layers.at(layer_idx);
  if (!layer) {
    Ditto.warn(`[${tag}] layer not found: ${layer_idx}`);
    return;
  }
  let node = layer.at(page_idx);
  if (!node) {
    Ditto.warn(`[${tag}] page not found: ${page_idx}`);
    return;
  }
  for (let i = 2; i < path.length; i++) {
    if (!node) break;
    node = node.children[path[i]];
  }
  return node;
}

CMDS.register(CMD.POINTER_DOWN, help_down, (c) => {
  const targets = read_targets(CMD.POINTER_DOWN, c);
  if (!targets || targets.button == void 0) return;
  move_cursor(c, false, true);
  const { nodes, points } = targets;
  const state = pointer_state(c);
  for (let i = 0; i < nodes.length; i++) {
    const ui = nodes[i]
    if (!ui.visible || ui.disabled) continue;
    if (ui.is_local && targets.from !== targets.me) continue;
    state.down_uis.add(ui);
    const event = new LFWPointerEvent(points[i], targets.button);
    ui.on_pointer_down(event);
    if (event.stopped) break;
  }
});

CMDS.register(CMD.POINTER_MOVE, help_move, (c) => {
  const targets = read_targets(CMD.POINTER_MOVE, c);
  if (!targets || !targets.button) return;
  move_cursor(c, false);
  const { nodes, points } = targets;

  const { on_uis } = pointer_state(c);
  const enter_uis = new Set<UINode>();
  const stay_uis = new Set<UINode>();

  for (let i = 0; i < nodes.length; i++) {
    const ui = nodes[i];
    if (!ui.visible || ui.disabled) continue;
    if (ui.is_local && targets.from !== targets.me) continue;
    ui.on_pointer_move(new LFWPointerEvent(points[i], targets.button));

    if (on_uis.has(ui)) {
      on_uis.delete(ui);
      stay_uis.add(ui);
    } else {
      enter_uis.add(ui);
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
  const targets = read_targets(CMD.POINTER_UP, c);
  if (!targets || targets.button == void 0) return;

  move_cursor(c, false, false);
  const state = pointer_state(c);
  const { nodes, points, button } = targets;

  const uis: UINode[] = [];
  const pts: IVector3[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const ui = nodes[i]
    if (!ui.visible || ui.disabled) continue;
    if (ui.is_local && targets.from !== targets.me) continue;
    uis.push(ui);
    pts.push(points[i]);
  }

  for (let i = 0; i < uis.length; i++) {
    const ui = uis[i];
    if (!ui.is_pointer_down(button)) continue;
    state.down_uis.delete(ui);
    const event = new LFWPointerEvent(pts[i], button);
    ui.on_pointer_up(event);
    if (event.stopped) break;
  }
  for (let i = 0; i < uis.length; i++) {
    const ui = uis[i];
    if (!ui.click_flag) continue;
    const event = new LFWPointerEvent(pts[i], button);
    ui.on_click(event);
    if (event.stopped) break;
  }

  for (const ui of state.down_uis) {
    const event = new LFWPointerEvent(Ditto.vec3(), button);
    ui.on_pointer_cancel(event);
  }
  state.down_uis.clear();
});

CMDS.register(CMD.POINTER_CLICK, help_click, (c) => {
  const targets = read_targets(CMD.POINTER_CLICK, c);
  if (!targets || targets.button == void 0) return;
  const { nodes, points, button } = targets;
  for (let i = 0; i < nodes.length; i++) {
    const ui = nodes[i];
    if (!ui || !ui.visible || ui.disabled) continue;
    if (ui.is_local && targets.from !== targets.me) continue;
    const event = new LFWPointerEvent(points[i], button);
    ui.on_click(event);
    if (event.stopped) break;
  }
});

CMDS.register(CMD.POINTER_CANCEL, help_cancel, (c) => {
  const targets = read_targets(CMD.POINTER_CANCEL, c);
  if (!targets || targets.button == void 0) return;

  move_cursor(c, void 0, false);
  const state = pointer_state(c);
  const { nodes, points, button } = targets;

  for (let i = 0; i < nodes.length; i++) {
    const ui = nodes[i];
    if (ui.is_local && targets.from !== targets.me) continue;
    const event = new LFWPointerEvent(points[i], button);
    ui.on_pointer_cancel(event);
    state.down_uis.delete(ui);
  }
});

CMDS.register(CMD.POINTER_ENTER, help_enter, (c) => {
  const targets = read_targets(CMD.POINTER_ENTER, c);
  if (!targets) return;
  move_cursor(c, false);
  const { nodes } = targets;
  const state = pointer_state(c);
  for (let i = 0; i < nodes.length; i++) {
    const ui = nodes[i];
    if (ui.is_local && targets.from !== targets.me) continue;
    if (!ui || !ui.visible || ui.disabled) continue;
    ui.on_pointer_enter();
    state.on_uis.add(ui);
  }
});

CMDS.register(CMD.POINTER_LEAVE, help_leave, (c) => {
  const targets = read_targets(CMD.POINTER_LEAVE, c);
  if (!targets) return;
  const { nodes } = targets;
  const state = pointer_state(c);

  for (let i = 0; i < nodes.length; i++) {
    const ui = nodes[i];
    if (!ui) continue;
    if (ui.is_local && targets.from !== targets.me) continue;
    ui.on_pointer_leave();
    state.on_uis.delete(ui);
  }
});
