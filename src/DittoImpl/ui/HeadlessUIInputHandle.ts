import { set_local_cursor } from "@/LFW/cmds/CMD_POINTER_EVENTS";
import { CMD } from "@/LFW/defines/CMD";
import type { IPointingEvent } from "@/LFW/ditto/pointings";
import type { IUIInputHandle } from "@/LFW/ditto/ui/IEventHandle";
import type { LFW } from "@/LFW/LFW";
import { UINode } from "@/LFW/ui/UINode";
import { node_path } from "./UIInputHandle";
import type { WorldRenderer } from "../renderer/WorldRenderer";

/** 命中结果：模型节点 + 世界坐标下的命中点 */
interface IHeadlessHit {
  extra: UINode;
  point: { x: number; y: number; z: number };
  /** 排序键：z 越大越靠近镜头 */
  z: number;
  /** 深度优先遍历序，用于同 z 时保持稳定顺序 */
  order: number;
}

/**
 * 不依赖 three.js 的 UIInputHandle：直接在 UINode 模型上做矩形命中测试。
 *
 * 与 `UIInputHandle` 的语义对齐（`--paths/--pages/--points`，近→远）：
 * - 命中判定用 `UINode.geo`（累加了父链 pos 的绝对矩形），不需要 mesh / raycast；
 * - 祖先 `clip_children` 用矩形包含裁剪（模型是轴对齐的，比世界空间矩形求交更直接）；
 * - 过滤 `!visible || disabled`；
 * - 排序：z 降序（近→远），同 z 保持深度优先遍历序（对齐 raycast 稳定排序的行为）；
 * - `--points` 换算回世界坐标（与 `ui_fg_container` 的位置一致）。
 *
 * 用途：给 `?headless_ui=1` 配对，让无头模式下也能真的点 UI。
 */
export class HeadlessUIInputHandle implements IUIInputHandle {
  private readonly lfw: LFW;
  private readonly world_renderer: WorldRenderer;
  private _empty_move = false;

  constructor(lfw: LFW) {
    this.lfw = lfw;
    this.world_renderer = lfw.world.renderer as WorldRenderer;
  }

  on_pointer_down(e: IPointingEvent): void {
    this.update_local_cursor(e, false, true);
    this.push_pointer(CMD.POINTER_DOWN, e);
  }
  on_pointer_move(e: IPointingEvent): void {
    this.update_local_cursor(e, false);
    this.push_pointer(CMD.POINTER_MOVE, e);
  }
  on_pointer_up(e: IPointingEvent): void {
    this.update_local_cursor(e, false, false);
    this.push_pointer(CMD.POINTER_UP, e);
  }
  on_pointer_cancel(e: IPointingEvent): void {
    this.update_local_cursor(e, void 0, false);
    this.lfw.push_cmd(CMD.POINTER_CANCEL, `--b=${e.button}`, this.pos_arg(e));
  }
  on_pointer_enter(e: IPointingEvent): void {
    this._empty_move = false;
    this.update_local_cursor(e, false);
    this.push_pointer(CMD.POINTER_MOVE, e);
  }
  on_pointer_leave(e: IPointingEvent): void {
    if (!this.lfw.ui) return;
    this._empty_move = true;
    this.update_local_cursor(e, true);
    this.lfw.push_cmd(CMD.POINTER_LEAVE, this.pos_arg(e));
  }
  on_click(): void { }
  on_wheel(): void { }

  protected push_empty_move(e: IPointingEvent): void {
    if (this._empty_move) return;
    this._empty_move = true;
    this.lfw.push_cmd(CMD.POINTER_MOVE, `--b=${e.button}`, this.pos_arg(e));
  }

  protected pos_arg(e: IPointingEvent): string {
    const { x, y } = this.lfw.world.ui_from_scene(e.scene_x, e.scene_y);
    return `--pos=${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
  }

  protected update_local_cursor(e: IPointingEvent, hidden: boolean | undefined, down?: boolean): void {
    const { x, y } = this.lfw.world.ui_from_scene(e.scene_x, e.scene_y);
    set_local_cursor(this.lfw.world, x, y, hidden, down);
  }

  /** scene(NDC -1~1) → UI 坐标（左上为原点，y 向下），与 pos_arg 同一套换算 */
  protected to_ui(e: IPointingEvent): { x: number; y: number } {
    return this.lfw.world.ui_from_scene(e.scene_x, e.scene_y);
  }

  /** UI 坐标 → 世界坐标（ui_bg/ui_fg 容器的位置） */
  protected to_world(node: UINode, x: number, y: number): { x: number; y: number; z: number } {
    const off = this.world_renderer.ui_offset;
    const cam = this.world_renderer.camera.position;
    const { world } = this.lfw;
    return {
      x: cam.x + world.ui_left + off.x + x,
      y: cam.y + world.view_h - world.ui_top + off.y - y,
      z: off.z + node.global_pos.z,
    };
  }

  /** 祖先的 clip_children 视口是否包含该点（模型是轴对齐的，直接矩形判定） */
  protected inside_clips(node: UINode, x: number, y: number): boolean {
    let p: UINode | undefined = node.parent;
    while (p) {
      if (p.clip_children) {
        const g = p.geo;
        if (x < g.left || x > g.right || y < g.top || y > g.bottom) return false;
      }
      p = p.parent;
    }
    return true;
  }

  protected intersections(e: IPointingEvent, page: UINode): IHeadlessHit[] {
    const { x: px, y: py } = this.to_ui(e);
    const hits: IHeadlessHit[] = [];
    let order = 0;

    const walk = (node: UINode): void => {
      const my_order = order++;
      if (node.visible && !node.disabled) {
        const g = node.geo;
        if (px >= g.left && px <= g.right && py >= g.top && py <= g.bottom &&
          this.inside_clips(node, px, py)) {
          hits.push({
            extra: node,
            point: this.to_world(node, px, py),
            z: node.global_pos.z,
            order: my_order,
          });
        }
      }
      const children = node.children;
      for (let i = 0; i < children.length; i++) walk(children[i]);
    };
    walk(page);

    hits.sort((a, b) => (a.z !== b.z ? b.z - a.z : a.order - b.order));
    return hits;
  }

  protected push_pointer(cmd: CMD, e: IPointingEvent): void {
    const { ui } = this.lfw;
    if (!ui) return;
    const hits = this.intersections(e, ui);
    const paths: string[] = [];
    const pages: string[] = [];
    const points: string[] = [];
    for (const { extra, point } of hits) {
      const path = node_path(extra);
      const page_id = extra.root.id;
      if (!path || !page_id) continue;
      paths.push(path);
      pages.push(page_id);
      points.push(`${point.x},${point.y},${point.z}`);
    }
    const empty = !paths.length;
    if (empty && cmd == CMD.POINTER_DOWN) return;
    if (cmd == CMD.POINTER_MOVE) {
      if (empty) {
        this.push_empty_move(e);
        return;
      }
      this._empty_move = false;
    }
    const args = [`--b=${e.button}`, this.pos_arg(e)];
    if (!empty) {
      args.push(`--paths=${paths.join('|')}`);
      args.push(`--pages=${pages.join('|')}`);
      args.push(`--points=${points.join('|')}`);
    }
    this.lfw.push_cmd(cmd, ...args);
  }
}
