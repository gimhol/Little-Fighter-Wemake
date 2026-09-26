import { parse_call_func_expression } from "../utils";
import { FadeOutOpacity } from "./FadeOutOpacity";
import { UIComponent } from "./UIComponent";

export class LoadingContentText extends UIComponent {
  static override readonly TAGS: string[] = ["LoadingContentText"]
  get fade_out_duration() { return this.num(1) ?? 0 };
  get fade_out_delay() { return this.num(2) ?? 0 }
  protected fadeout?: FadeOutOpacity;
  protected failed_reason: string | null = null;

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

  on_loading_start() {
    this.failed_reason = null;
  }

  on_loading_end() {
    this.failed_reason = null;
    const page = this.str(0)
    if (page) this.node.layer?.set({ id: page })
    else this.on_progress("waiting_others_players", 0)
  }

  on_progress(text: string, progress: number) {
    if (this.failed_reason != null) return;
    this.fadeout?.start();
    const str = progress ? `loading: ${text}(${progress}%)` : ` loading: ${text}`;
    this.node.set_text(str)
  }

  on_loading_failed(reason: any) {
    this.failed_reason = format_reason(reason);
    if (this.fadeout) {
      this.fadeout.enabled = false;
      this.node.set_opacity(1);
    }
    this.node.set_text(`loading failed: ${this.failed_reason}`)
  }
}

function format_reason(reason: any): string {
  const texts: string[] = [];
  const push = (v: any, fallback_url?: unknown) => {
    if (v == null) return;
    const msg = v instanceof Error ? (v.message || v.name) : String(v);
    const url = v?.config?.url ?? fallback_url;
    const text = typeof url === 'string' && url && !msg.includes(url) ? `${msg} (${url})` : msg;
    if (text && !texts.includes(text)) texts.push(text);
  };
  const pairs = reason?.url_err_pair_list;
  if (Array.isArray(pairs) && pairs.length) for (const [url, e] of pairs) push(e, url);
  else push(reason);
  if (!texts.length) push(reason);
  return texts.join('; ') || 'unknown error';
}
