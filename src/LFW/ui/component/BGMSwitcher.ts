import { loop_offset } from "../../utils/container_help/loop_offset";
import { LF2PointerEvent } from "../LF2PointerEvent";
import { UIComponent } from "./UIComponent";

export class BGMSwitcher extends UIComponent {
  static override readonly TAGS: string[] = ["BGMSwitcher"];
  private _which: 'Silent' | 'Random' | '' = '';
  get which(): string { return this._which || this.lfw.sounds.bgm() || "Silent"; }
  get offset(): number { return this.num(0) ?? 0; }
  private _sounds_cbs = {
    on_bgm_changed: () => this.node.set_text('BGM: ' + this.which)
  }
  override on_resume(): void {
    if (this.lfw.sounds.is_random)
      this._which = 'Random'
    if (this.offset == 0) {
      this.lfw.sounds.callbacks.add(this._sounds_cbs)
      this._sounds_cbs.on_bgm_changed()
    }
  }
  override on_pause(): void {
    this.lfw.sounds.callbacks.del(this._sounds_cbs)
  }
  override on_click(e: LF2PointerEvent): void {
    super.on_click?.(e)
    e.stop_immediate_propagation()
    e.stop_propagation();
    const { offset } = this;
    const list = ['Silent', 'Random', ...this.lfw.bgms]
    let next: string | undefined = void 0;
    if (offset) next = loop_offset(list, this.which, offset)
    else if (e.button === 0) next = loop_offset(list, this.which, 1)
    else if (e.button === 1) next = this.which === 'Silent' ? 'Random' : 'Silent'
    else if (e.button === 2) next = loop_offset(list, this.which, -1)
    else return;

    switch (next) {
      case 'Random':
        this._which = 'Random';
        this.lfw.sounds.play_bgm('?');
        break;
      case 'Silent':
        this._which = 'Silent';
        this.lfw.sounds.stop_bgm();
        break;
      default:
        this._which = '';
        if (next) this.lfw.sounds.play_bgm(next)
        break;
    }
  }
}

