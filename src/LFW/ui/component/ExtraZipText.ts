import type { ILFWCallback } from '../../ILFWCallback';
import type { LFW } from '../../LFW';
import { UIComponent } from "./UIComponent";


export class ExtraZipText extends UIComponent {
  static override readonly TAGS: string[] = ["ExtraZipText"];
  private _lf2_cbs: ILFWCallback = {
    on_extra_zips_changed: (lfw) => this.render(lfw),
    on_lang_changed: (_lang, _prev, lfw) => this.render(lfw),
  };
  protected render(lfw: LFW): void {
    const extra_zips = lfw.t('DATA_LIST')
    if (extra_zips) {
      const text = lfw.t('extra_data') + ':\n' + extra_zips
      this.node.set_text(text)
    } else {
      this.node.set_text(' ')
    }
  }
  override on_start(): void {
    super.on_start?.();
    this.lfw.callbacks.add(this._lf2_cbs);
    this.render(this.lfw);
  }
  override on_stop(): void {
    super.on_stop?.();
    this.lfw.callbacks.del(this._lf2_cbs);
  }
}
