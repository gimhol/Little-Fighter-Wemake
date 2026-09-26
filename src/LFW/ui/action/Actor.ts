import { LFW } from "../../../LFW";
import { Ditto } from "../../ditto";
import type { IUIAction } from "../IUIAction";
import { UIActionEnum } from "../UIActionEnum";
import type { UINode } from "../UINode";

interface IUIActionHandler {
  (layout: UINode, ...args: string[]): void;
}
/** 页面动作（旧写法 set_ui/push_ui/pop_ui 仍注册为别名） */
const act_set_page: IUIActionHandler = ({ lfw }, layout_id, index) => lfw.layers.set_page({ id: layout_id }, Number(index) || 0)
const act_push_page: IUIActionHandler = ({ lfw }, layout_id, index) => lfw.layers.push_page({ id: layout_id }, Number(index) || 0)
const act_pop_page: IUIActionHandler = (n) => n.layer?.pop()
class UIActor {
  static readonly TAG: string = "Actor";
  private _handler_map = new Map<string, IUIActionHandler>([
    [UIActionEnum.SetPage, act_set_page],
    [UIActionEnum.PushPage, act_push_page],
    [UIActionEnum.PopPage, act_pop_page],
    [UIActionEnum.SetUI, act_set_page],
    [UIActionEnum.PushUI, act_push_page],
    [UIActionEnum.PopUI, act_pop_page],
    [UIActionEnum.LoadData, ({ lfw }, url) => {

      lfw.load(...(url ? [url] : LFW.ZIPS.slice(1)))
        .catch(e => Ditto.warn('Failed to load, reason', e))
    }],
    [UIActionEnum.Broadcast, ({ lfw }, msg) => lfw.broadcast(msg)],
    [UIActionEnum.Sound, ({ lfw }, name, _x, _y, _z) => {
      const x = Number(_x);
      const y = Number(_y);
      const z = Number(_z);
      lfw.sounds.play_preset(name, isNaN(x) ? void 0 : x, isNaN(y) ? void 0 : y, isNaN(z) ? void 0 : z)
    }],
    [UIActionEnum.SwitchDifficulty, ({ lfw }, v) => lfw.switch_difficulty(v ? Number(v) : void 0)],
    [UIActionEnum.DestoryStage, ({ lfw }) => lfw.change_stage('')],
    [UIActionEnum.RemoveAllEntities, ({ lfw }) => lfw.entities.del_all()]
  ]);

  add(key: UIActionEnum, handler: IUIActionHandler): this {
    this._handler_map.set(key, handler);
    return this;
  }

  act(layout: UINode, action: undefined | null | IUIAction | IUIAction[]): void {
    if (!action) return;

    if (Array.isArray(action)) {
      for (let i = 0; i < action.length; i++) {
        this.act(layout, action[i])
      }
      return;
    }

    const { name, args = [] } = action;
    const handler = this._handler_map.get(name);
    if (!handler) Ditto.warn(`[${UIActor.TAG}::act] failed to act, handler not found by name, expression: ${name}(${args})`)
    handler?.(layout, ...args);
    return;

  }
}
export const actor = new UIActor();
