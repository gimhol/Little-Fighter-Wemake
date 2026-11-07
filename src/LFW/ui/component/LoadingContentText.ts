import type { IPropsMeta } from "../../defines";
import type { UINode } from "../UINode";
import { parse_call_func_expression } from "../utils";
import { FadeOutOpacity } from "./FadeOutOpacity";
import { UIComponent } from "./UIComponent";

export interface ILoadingContentTextProps {
  /**
   * 加载结束后（且未配置跳转页）替换显示的文案（i18n key）。
   *
   * 只有真的还要等别人时才配，比如联网加载页的 `waiting_others_players`；
   * 不配则保持最后一条进度文案，由淡出自行消失。
   */
  waiting_text?: string;
}

export class LoadingContentText extends UIComponent<ILoadingContentTextProps> {
  static override readonly TAGS: string[] = ["LoadingContentText"]
  static override readonly PROPS: IPropsMeta<ILoadingContentTextProps> = {
    waiting_text: { type: String, nullable: true },
  };
  get fade_out_duration() { return this.num(1) ?? 0 };
  get fade_out_delay() { return this.num(2) ?? 0 }
  protected fadeout?: FadeOutOpacity;
  protected failed_reason: string | null = null;

  /**
   * 加载内容区：UI 把前缀（如 `loading:`）与本节点放进同一个 flex 行时，整行算作内容区，
   * 淡出与失败提示都作用于整行；否则只作用于本节点。
   */
  protected get area(): UINode {
    const parent = this.node.parent;
    return parent && parent.is_flex ? parent : this.node;
  }

  override init(): this {
    if (this.fade_out_duration) {
      const expression = FadeOutOpacity.expression(
        this.fade_out_duration,
        this.fade_out_delay
      ).done();
      // TODO: fix it.
      const pr = parse_call_func_expression(expression);
      if (pr) {
        const area = this.area;
        this.fadeout = this.lfw.factory.create_components(area, [{ ...pr, cls: pr.name }])[0] as FadeOutOpacity
        area.add_components(this.fadeout)
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

  /** 失败提示会顶替整行内容，所以同行里的前缀（由 UI 配置）要一起让位/复位 */
  protected set_area_prefix_visible(visible: boolean) {
    const area = this.area;
    if (area === this.node) return;
    for (const child of area.children)
      if (child !== this.node) child.set_visible(visible);
  }

  on_loading_start() {
    this.failed_reason = null;
    this.set_area_prefix_visible(true);
  }

  on_loading_end() {
    this.failed_reason = null;
    const page = this.str(0)
    if (page) {
      this.node.layer?.set({ id: page })
      return
    }
    const waiting_text = this.props.waiting_text
    if (waiting_text) this.on_progress(this.lfw.t(waiting_text), 0);
  }

  on_progress(text: string, progress: number) {
    if (this.failed_reason != null) return;
    this.fadeout?.start();
    this.node.set_text(progress ? `${text}(${progress}%)` : text)
  }

  on_loading_failed(reason: any) {
    this.failed_reason = format_reason(reason);
    if (this.fadeout) {
      this.fadeout.enabled = false;
      this.area.set_opacity(1);
    }
    this.set_area_prefix_visible(false);
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
