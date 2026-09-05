import { Defines } from "../../defines/defines";
import type { IWorldCallbacks } from "../../IWorldCallbacks";
import type { IWorldDataset } from "../../defines/IWorldDataset";
import { UIComponent } from "./UIComponent";

export class DifficultyText extends UIComponent implements IWorldCallbacks {
  static override readonly TAGS: string[] = ["DifficultyText", "difficulty_text"];
  override on_resume(): void {
    this.world.callbacks.add(this);
    this.on_dataset_change('difficulty');
  }
  override on_pause(): void {
    this.world.callbacks.del(this);
  }
  on_dataset_change<K extends keyof IWorldDataset>(key: K): void {
    if (key !== 'difficulty') return;
    this.node.set_text(Defines.DifficultyLabels[this.world.dataset.difficulty]);
  }
}
