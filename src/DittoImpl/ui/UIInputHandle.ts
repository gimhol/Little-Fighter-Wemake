import { set_local_cursor } from "@/LFW/cmds/CMD_POINTER_EVENTS";
import { CMD } from "@/LFW/defines/CMD";
import type { IPointingEvent } from "@/LFW/ditto/pointings";
import type { IUIInputHandle } from "@/LFW/ditto/ui/IEventHandle";
import type { LFW } from "@/LFW/LFW";
import { UINode } from "@/LFW/ui/UINode";
import * as T from "../_t";
import { UINodeRenderer } from "../renderer/UINodeRenderer";
import { WorldRenderer } from "../renderer/WorldRenderer";
interface IIntersection {
  extra: UINode;
  point: T.Vector3;
}
function node_path(node: UINode): string | undefined {
  const layer = node.layer;
  const page = node.root;
  if (!layer || !page.id) return;
  const page_idx = layer.pages.indexOf(page);
  if (page_idx < 0) return;
  const idx: number[] = [];
  let n: UINode | undefined = node;
  while (n && n !== page) {
    const parent: UINode | undefined = n.parent;
    if (!parent) return;
    idx.unshift(parent.children.indexOf(n));
    n = parent;
  }
  return [layer.index, page_idx, ...idx].join(',');
}
export { node_path };
export class UIInputHandle implements IUIInputHandle {
  private lfw: LFW;
  private pointer_vec_2 = new T.Vector2();
  private pointer_raycaster = new T.Raycaster();
  private world_renderer: WorldRenderer
  constructor(lfw: LFW) {
    this.lfw = lfw;
    this.world_renderer = this.lfw.world.renderer as WorldRenderer
  }

  on_pointer_down(e: IPointingEvent) {
    this.update_local_cursor(e, false, true);
    this.push_pointer(CMD.POINTER_DOWN, e);
  }
  on_pointer_move(e: IPointingEvent) {
    this.update_local_cursor(e, false);
    this.push_pointer(CMD.POINTER_MOVE, e);
  }
  on_pointer_up(e: IPointingEvent) {
    this.update_local_cursor(e, false, false);
    this.push_pointer(CMD.POINTER_UP, e);
  }
  on_pointer_cancel(e: IPointingEvent) {
    this.update_local_cursor(e, void 0, false);
    this.lfw.push_cmd(CMD.POINTER_CANCEL, `--b=${e.button}`, this.pos_arg(e));
  }
  on_pointer_enter(e: IPointingEvent) {
    this.update_local_cursor(e, false);
    this.push_pointer(CMD.POINTER_MOVE, e);
  }
  on_pointer_leave(e: IPointingEvent) {
    if (!this.lfw.ui) return;
    this.update_local_cursor(e, true);
    this.lfw.push_cmd(CMD.POINTER_LEAVE, this.pos_arg(e));
  }
  on_click(): void { }
  on_wheel(): void { }

  protected pos_arg(e: IPointingEvent): string {
    const { screen_w, screen_h } = this.lfw.world.dataset;
    const x = Math.round((e.scene_x + 1) / 2 * screen_w * 10) / 10;
    const y = Math.round((1 - e.scene_y) / 2 * screen_h * 10) / 10;
    return `--pos=${x},${y}`;
  }
  protected update_local_cursor(e: IPointingEvent, hidden: boolean | undefined, down?: boolean) {
    const { screen_w, screen_h } = this.lfw.world.dataset;
    const x = (e.scene_x + 1) / 2 * screen_w;
    const y = (1 - e.scene_y) / 2 * screen_h;
    set_local_cursor(this.lfw.world, x, y, hidden, down);
  }
  protected push_pointer(cmd: CMD, e: IPointingEvent) {
    const { ui } = this.lfw; if (!ui) return;
    let page: UINode | undefined;
    let intersections: IIntersection[] = [];
    for (const candidate of this.lfw.layers.pages) {
      const hits = this.intersections(e.scene_x, e.scene_y, candidate);
      if (!hits.length) continue;
      page = candidate;
      intersections = hits;
      break;
    }
    if (!page) return;

    const lpaths: string[] = [];
    const lpoints: string[] = [];

    const paths: string[] = [];
    const points: string[] = [];
    for (const { extra, point } of intersections) {
      const path = node_path(extra);
      const page_id = extra.root.id;
      if (!path || !page_id) continue;
      if (extra.local_only) {
        lpaths.push(path);
        lpoints.push(`${point.x},${point.y},${point.z}`);
      } else {
        paths.push(path);
        points.push(`${point.x},${point.y},${point.z}`);
      }
    }

    if (paths.length) {
      const args = [`--b=${e.button}`, this.pos_arg(e)];
      args.push(`--paths=${paths.join('|')}`);
      args.push(`--points=${points.join('|')}`);
      this.lfw.push_cmd(cmd, ...args);
    }

    if (lpaths.length) {
      const largs = [`--b=${e.button}`, this.pos_arg(e)];
      largs.push(`--paths=${lpaths.join('|')}`);
      largs.push(`--points=${lpoints.join('|')}`);
      this.lfw.push_lcmd(cmd, ...largs);
    }
  }
  protected intersections(x: number, y: number, ui: UINode): IIntersection[] {
    this.pointer_vec_2.x = x;
    this.pointer_vec_2.y = y;
    this.pointer_raycaster.setFromCamera(this.pointer_vec_2, this.world_renderer.camera);
    const ui_sprite = (ui.renderer as UINodeRenderer).mesh

    const ret: IIntersection[] = [];
    const temp = this.pointer_raycaster.intersectObject(ui_sprite);
    temp.sort((a, b) => a.distance - b.distance)

    for (const t of temp) {
      const ui = t.object.userData.owner;
      if (!(ui instanceof UINode)) continue;
      if (!ui.visible || ui.disabled || !ui.touchable) continue;
      const clip = (ui.renderer as UINodeRenderer).effective_clip_rect(true);
      if (clip) {
        const { x: px, y: py } = t.point;
        if (px < clip.x0 || px > clip.x1 || py < clip.y0 || py > clip.y1) continue;
      }
      const item = { extra: ui, point: t.point }
      ret.push(item);
    }
    return ret;
  }
}
