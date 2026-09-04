import type { IPropsMeta } from "../../../defines/ISchema";
import { max, round } from "../../../utils/math/base";
import { UINode } from "../../UINode";
import type { IUICompnentCallbacks } from "../IUICompnentCallbacks";
import { Label } from "../Label";
import { SliderHandle, type ISliderHandleProps } from "./SliderHandle";

export interface ISwitcherHandleProps extends ISliderHandleProps {
  /**
   * 选项 label 容器：其前 N 个子节点会被当作选项，均分摆到轨道每个“单元格”中心，
   * 文字设为 items 的第 i 项；超出 N 的子节点自动隐藏。
   * 建议该容器与轨道（handle 的父节点）同宽同原点。
   */
  options?: UINode;
  /** 模板里预置的最大选项槽位数（缺省 = options 的子节点数） */
  slots?: number;
}

export interface ISwitcherHandleCallbacks extends IUICompnentCallbacks {
  on_value_changed?(value: number, component: SwitcherHandle): void;
}

/**
 * 分段切换器（switcher）手柄
 *
 * 相比 SliderHandle 的 "switcher" 模式，额外负责「选项 label 的尺寸与均分布局」：
 * - handle 宽/高 = 轨道尺寸 / N（复用基类逻辑，handle 恰好盖住当前“单元格”）；
 * - `options` 容器内前 N 个子节点摆到各自单元格中心，文字 = items[i]（渲染时会按 i18n 解析），多余的隐藏；
 * - N 变化时（min/max、handle 尺寸、label 布局）自动收敛。
 *
 * 因此 2~5 档切换行可以共用一个模板（模板里预置最大槽位，实例只给 items/values 即可）。
 */
export class SwitcherHandle extends SliderHandle {
  static override readonly TAGS: string[] = ["SwitcherHandle"];
  static override readonly PROPS: IPropsMeta<ISwitcherHandleProps> = {
    mode: String,
    min: Number,
    max: Number,
    precision: Number,
    step: Number,
    container: UINode,
    responser: UINode,
    items_container: UINode,
    handle_label: Label,
    items: String,
    visible_items: Number,
    direction: { type: String, oneof: ["row", "col"], nullable: true },
    options: UINode,
    slots: Number,
  }

  /** SwitcherHandle 默认即分段切换模式 */
  override get mode(): string { return this.props.mode ?? 'switcher'; }
  override set mode(v: string) { this.props.mode = v; }

  protected get options(): UINode | undefined {
    return (this.props as ISwitcherHandleProps).options;
  }
  protected get slots(): number {
    return (this.props as ISwitcherHandleProps).slots ?? this.options?.children.length ?? 0;
  }

  override on_start(): void {
    super.on_start(); // 基类已完成 pointings/container 订阅与 switcher 基础配置
    this.sync_range();
    this.set_value(this.value); // 刷新 handle_label 为当前项
    this.arrange_options(this.value);
  }
  override on_resume(): void {
    super.on_resume?.();
    this.sync_range();
    this.arrange_options(this.value);
  }
  override update(dt: number): void {
    super.update(dt);
    this.sync_range();
    this.arrange_options();
  }

  /** 让 min/max/precision/step 与 items 数量对齐（items 变化时自动收敛） */
  protected sync_range(): void {
    const mx = max(this.items.length - 1, 0);
    if (this.min_value !== 0) this.min_value = 0;
    if (this.max_value !== mx) this.max_value = mx;
    if (this.precision !== 1) this.precision = 1;
    if (this.step !== 1) this.step = 1;
    if (this.value > this.max_value) this.set_value(this.max_value);
  }

  /**
   * 当前被 thumb 盖住的单元格下标
   *
   * thumb 与 options 同为轨道的子节点（options 位于轨道原点），因此 thumb 的
   * 局部 x/y 与 options.cross 同一坐标系：中心落在第 i 格即盖住该格。
   */
  protected cover_index(): number {
    const opts = this.options;
    if (!opts) return -1;
    const n = this.items.length;
    if (!n) return -1;
    const row = this.direction === 'row';
    const track = row ? opts.w : opts.h;
    if (!(track > 0)) return -1;
    const cell = track / n;
    const t = opts.cross;
    const lo = (row ? t.left : t.top) + cell / 2; // 第 0 格中心
    const pos = row ? this.node.x : this.node.y; // thumb 中心当前局部坐标
    const idx = Math.round((pos - lo) / cell);
    return Math.max(0, Math.min(n - 1, idx));
  }

  /**
   * 选项 label 均分布局
   *
   * 单元格宽 = 轨道尺寸 / N；把第 i 个子节点的中心摆到第 i 格中心
   * （容器 local 坐标：左/右/上/下 = opts.cross，子节点 pos 与其同坐标系）。
   *
   * 说明：本渲染器按材质分组绘制（文字永远盖在方块上，方块间按序遮挡），
   * 所以被白色 thumb 盖住那格的灰色 label 需要显式隐藏，否则会透到白块上。
   *
   * @param cover 指定要隐藏的单元格（缺省按 thumb 当前位置推算）
   */
  protected arrange_options(cover?: number): void {
    const opts = this.options;
    if (!opts) return;
    const items = this.items;
    const n = items.length;
    if (!n) return;
    const row = this.direction === 'row';
    const track = row ? opts.w : opts.h;
    if (!(track > 0)) return;
    const cell = track / n;
    const { cross: t } = opts;
    const children = opts.children;
    const total = this.slots;
    const covered = cover ?? this.cover_index();
    for (let i = 0; i < children.length && i < total; i++) {
      const child = children[i];
      const show = i < n && i !== covered;
      if (child.self_visible !== show) child.visible = show;
      if (!show) continue;
      const key = items[i];
      if (child.text?.text !== key) child.set_text(key ?? '');
      const c = child.cross;
      if (row) {
        const center_x = t.left + (i + 0.5) * cell;
        child.move_to(round(center_x - c.mid_x), round(t.mid_y - c.mid_y), child.z);
      } else {
        const center_y = t.top + (i + 0.5) * cell;
        child.move_to(round(t.mid_x - c.mid_x), round(center_y - c.mid_y), child.z);
      }
    }
  }
}
