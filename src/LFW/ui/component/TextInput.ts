import { UIComponent } from "./UIComponent";

export class TextInput extends UIComponent {
  static override readonly TAGS: string[] = ["TextInput"];
  protected _text: string = '';

  get maxLength() { return this.props_holder.num('maxLength') }
  get defaultValue() { return this.props_holder.str('defaultValue') }
  get placeholder() { return this.props_holder.str('placeholder') }
  get fontSize() { return this.props_holder.num('fontSize') }

  get text(): string { return this._text; }
  set text(text: string) { this._text = text; }

  on_submit?: () => void;
}


