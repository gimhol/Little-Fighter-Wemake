import type { IPointingEvent } from "@/LFW/ditto/pointings";
import type { IUIInputHandle } from "@/LFW/ditto/ui/IEventHandle";
import type { LFW } from "@/LFW/LFW";
import { LF2PointerEvent } from "@/LFW/ui/LF2PointerEvent";
import { UINode } from "@/LFW/ui/UINode";
import * as T from "../_t";
import { UINodeRenderer } from "../renderer/UINodeRenderer";
import { WorldRenderer } from "../renderer/WorldRenderer";
interface IIntersection {
  extra: UINode;
  point: T.Vector3;
}
export class UIInputHandle implements IUIInputHandle {
  private lfw: LFW;
  private pointer_vec_2 = new T.Vector2();
  private pointer_raycaster = new T.Raycaster();
  private world_renderer: WorldRenderer
  private _pointer_down_uis = new Set<UINode>();
  private _pointer_on_uis = new Set<UINode>();
  constructor(lfw: LFW) {
    this.lfw = lfw;
    this.world_renderer = this.lfw.world.renderer as WorldRenderer
  }

  on_pointer_down(e: IPointingEvent) {
    const { ui } = this.lfw; if (!ui) return;
    const intersections = this.intersections(e.scene_x, e.scene_y, ui);
    for (const i of intersections) {
      this._pointer_down_uis.add(i.extra)
      const _e = new LF2PointerEvent(i.point, e.button);
      i.extra.on_pointer_down(_e);
      if (_e.stopped) break;
    }
  }
  on_pointer_move(e: IPointingEvent) {
    const { ui } = this.lfw; if (!ui) return;
    const intersections = this.intersections(e.scene_x, e.scene_y, ui);
    const leave_ui = this._pointer_on_uis;
    const stay_ui = new Set<UINode>();
    const enter_ui = new Set<UINode>();
    for (const { extra: ui, point } of intersections) {
      const _e = new LF2PointerEvent(point, e.button);
      ui.on_pointer_move(_e);
      if (leave_ui.has(ui)) {
        leave_ui.delete(ui)
        stay_ui.add(ui)
      } else {
        enter_ui.add(ui);
      }
    }
    for (const ui of leave_ui) {
      ui.on_pointer_leave();
    }
    this._pointer_on_uis.clear();
    for (const ui of enter_ui) {
      ui.on_pointer_enter();
      this._pointer_on_uis.add(ui)
    }
    for (const ui of stay_ui) {
      this._pointer_on_uis.add(ui)
    }

  }
  on_pointer_up(e: IPointingEvent) {
    const { ui } = this.lfw; if (!ui) return;
    const intersections = this.intersections(e.scene_x, e.scene_y, ui);
    for (const i of intersections) {
      if (i.extra.pointer_down) {
        this._pointer_down_uis.delete(i.extra)
        const _e = new LF2PointerEvent(i.point, e.button);
        i.extra.on_pointer_up(_e);
        if (_e.stopped) break;
      }
    }
    for (const i of intersections) {
      if (i.extra.click_flag) {
        const _e = new LF2PointerEvent(i.point, e.button);
        i.extra.on_click(_e);
        if (_e.stopped) break;
      }
    }
    for (const i of this._pointer_down_uis) {
      const _e = new LF2PointerEvent(new T.Vector3(NaN, NaN, NaN), e.button);
      i.on_pointer_cancel(_e);
    }
    this._pointer_down_uis.clear()
  }
  on_pointer_cancel(e: IPointingEvent) {
    for (const i of this._pointer_down_uis) {
      const _e = new LF2PointerEvent(new T.Vector3(NaN, NaN, NaN), e.button);
      i.on_pointer_cancel(_e);
    }
    this._pointer_down_uis.clear()
  }
  on_click(e: IPointingEvent): void { }
  on_wheel(e: IPointingEvent): void { }
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
      if (!ui.visible || ui.disabled) continue;
      // overflow:hidden 裁剪：命中点落在祖先视口矩形之外的部分不响应指针
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
