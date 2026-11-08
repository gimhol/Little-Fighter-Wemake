import { DifficultyNames } from "../../defines";
import type { IWorldCallbacks } from "../../IWorldCallbacks";
import type { IWorldDataset } from "../../defines/IWorldDataset";
import { UIComponent } from "./UIComponent";

export class PrefixAndDifficultyText extends UIComponent implements IWorldCallbacks {
  static override readonly TAGS: string[] = ["PrefixAndDifficultyText"]
  private _prefix: string = '';

  override on_start(): void {
    super.on_start?.();
    this._prefix = this.str(0) ?? '';
  }
  protected get text(): string {
    return `${this._prefix} (${DifficultyNames[this.world.dataset.difficulty]})`
  }
  override on_resume(): void {
    this.world.callbacks.add(this)
    this.on_dataset_change('difficulty');
  }
  override on_pause(): void {
    this.world.callbacks.del(this)
  }
  /** 文字样式由 UI 文件里的 style 决定，这里只负责内容 */
  on_dataset_change<K extends keyof IWorldDataset>(key: K): void {
    if (key === 'difficulty') this.node.set_text(this.text)
  }
}
