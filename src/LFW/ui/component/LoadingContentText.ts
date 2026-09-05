import { parse_call_func_expression } from "../utils";
import { FadeOutOpacity } from "./FadeOutOpacity";
import { UIComponent } from "./UIComponent";

export class LoadingContentText extends UIComponent {
  static override readonly TAGS: string[] = ["LoadingContentText"]
  get fade_out_duration() { return this.num(1) ?? 0 };
  get fade_out_delay() { return this.num(2) ?? 0 }
  protected fadeout?: FadeOutOpacity;

  override init(): this {
    if (this.fade_out_duration) {
      const expression = FadeOutOpacity.expression(
        this.fade_out_duration,
        this.fade_out_delay
      ).done();
      // TODO: fix it.
      const pr = parse_call_func_expression(expression);
      if (pr) {
        this.fadeout = this.lfw.factory.create_components(this.node, [{ ...pr, cls: pr.name }])[0] as FadeOutOpacity
        this.node.add_components(this.fadeout)
      }
    }
    return this;
  }

  override on_resume(): void {
    this.lfw.callbacks.add(this);
  }

  override on_pause(): void {
    this.lfw.callbacks.del(this);
  }

  on_loading_end() {
    const page = this.str(0)
    if (page) this.lfw.set_ui({ id: page })
    else this.on_progress("waiting_others_players", 0)
  }

  on_progress(text: string, progress: number) {
    this.fadeout?.start();
    const str = progress ? `loading: ${text}(${progress}%)` : ` loading: ${text}`;
    this.node.set_text(str)
  }
}
