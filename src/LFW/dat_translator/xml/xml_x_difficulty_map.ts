import { Difficulty, DifficultyList } from "../../defines/Difficulty";
import type { IXMLElement } from "../../ditto/xml";

export type DifficultyMap<T> = { [x in Difficulty]?: T }

export function xml_x_difficulty_map(el: IXMLElement, attr: string, map: DifficultyMap<number> | undefined): void {
  if (!map) return;
  const value = DifficultyList.map((k: Difficulty) => {
    if (!(k in map)) return void 0;
    if (typeof map[k] != 'number') return void 0;
    return `${k}:${map[k]}`;
  }).filter(Boolean).join(",");
  if (!value) return;
  el.set_attr(attr, value);
}

export function xml_2_difficulty_map(el: IXMLElement, attr: string): DifficultyMap<number> | undefined {
  const v = el.attr(attr);
  if (!v) return void 0;

  const ret: DifficultyMap<number> = {};
  for (const str of v.split(',')) {
    const [k, v] = str.split(':').map(Number);
    if (isNaN(k) || isNaN(v)) continue;
    // Is this 'as' ok ? -Gim
    ret[k as Difficulty] = v;
  }
  return Object.keys(ret).length ? ret : void 0;
}
