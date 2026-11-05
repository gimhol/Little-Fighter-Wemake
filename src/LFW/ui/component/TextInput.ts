import type { IPropsMeta } from "../../defines";
import { UIComponent } from "./UIComponent";
export interface ITextInputProps {
  text?: string;
  maxLength?: number;
  defaultValue?: string;
  placeholder?: string;
  fontSize?: number;
  fontFamily?: string;
}
export class TextInput extends UIComponent<ITextInputProps> {
  static override readonly TAGS: string[] = ["TextInput"];
  static override readonly PROPS: IPropsMeta<ITextInputProps> = {
    text: { type: String, nullable: true },
    maxLength: { type: Number, nullable: true },
    defaultValue: { type: String, nullable: true },
    placeholder: { type: String, nullable: true },
    fontSize: { type: Number, nullable: true },
    fontFamily: { type: String, nullable: true },
  };

  get text(): string { return this.props.text ?? ''; }
  set text(text: string) { this.set_text(text) }
  set_text(text: string) {
    if (this.props.text == text) return;
    this.props.text = text;
    this.node.renderer.set_input_value?.(text);
  }
  on_submit?: () => void;
  on_cancel?: () => void;
}


