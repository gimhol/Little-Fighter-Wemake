import { Easing } from '../../animation/Easing';
import type { IPropsMeta } from "../../defines/ISchema";
import type { IUIInfo } from '../IUIInfo.dat';
import { UINode } from '../UINode';
import { UIComponent } from './UIComponent';

const BACK_LABEL_ID = 'back_label';
const HOVER_LABEL_ID = 'hover_label';

export interface ILabelButtonProps {
  back_label?: UINode;
  hover_label?: UINode;
  responser?: UINode;
  normal_color?: string;
  hover_color?: string;
  disable_color?: string;
  text?: string;
}
export class LabelButton extends UIComponent<ILabelButtonProps> {
  static override readonly TAGS: string[] = ["LabelButton"];
  static override readonly ITEMS: readonly IUIInfo[] = [
    { id: BACK_LABEL_ID, center: '0.5,0.5', i18n: '$val:text', style: '$val:style_normal' },
    { id: HOVER_LABEL_ID, center: '0.5,0.5', i18n: '$val:text', style: '$val:style_hover' },
  ];

  static override readonly PROPS: IPropsMeta<ILabelButtonProps> = {
    back_label: UINode,
    hover_label: UINode,
    responser: UINode,
    normal_color: String,
    hover_color: String,
    disable_color: String,
    text: String,
  };
  checked: boolean | null = null;
  protected anim = new Easing(0, 1).set_duration(150);

  /** 常态文字节点：props 里指定了就用指定的，否则用 ITEMS 自动创建的 back_label */
  get back_label(): UINode | undefined {
    return this.props.back_label ?? this.node.search_node(BACK_LABEL_ID);
  }
  /** 悬停文字节点，取法同 back_label */
  get hover_label(): UINode | undefined {
    return this.props.hover_label ?? this.node.search_node(HOVER_LABEL_ID);
  }
  get responser(): UINode {
    return this.props.responser ?? this.node;
  }
  get normal_color(): string {
    return this.props.normal_color ?? '#9ba5ce'
  }
  get hover_color(): string {
    return this.props.hover_color ?? 'white'
  }
  get text(): string {
    return this.back_label?.text?.text ?? '';
  }
  set text(v: string) {
    this.set_text(v);
  }
  /**
   * 设置按钮文字
   *
   * back_label（常态）与 hover_label（悬停态）是叠加的两个文字节点，
   * 只改其中一个会导致另一态残留旧文字，因此这里同时更新两者。
   *
   * @param {string} text 文本内容
   * @return {this}
   * @memberof LabelButton
   */
  set_text(text: string): this {
    this.back_label?.set_text(text);
    this.hover_label?.set_text(text);
    return this;
  }
  override update(dt: number): void {
    const { responser } = this;
    const reverse = null == this.checked ?
      (!responser.pointer_over && !responser.focused) || !!responser.is_pointer_down(0) :
      !this.checked

    this.hover_label?.set_opacity(this.anim.auto_trip(reverse, dt).value);
  }
}
