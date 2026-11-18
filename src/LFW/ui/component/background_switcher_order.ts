import { BGG, Defines, type IBgData, type IWorldDataset } from "../../defines";

export function arrange_switcher_backgrounds(
  backgrounds: IBgData[],
  dataset: Partial<IWorldDataset>,
): IBgData[] {
  const { LF2_NET, GIM_INK } = dataset;
  const regular: IBgData[] = [];
  const hidden: IBgData[] = [];
  const dev: IBgData[] = [];
  for (const bg of backgrounds) {
    if (bg.id === Defines.VOID_BG.id) continue;
    const groups = bg.base.group;
    if (groups?.includes(BGG.Regular)) {
      regular.push(bg);
    } else if (groups?.includes(BGG.Hidden)) {
      if (LF2_NET) hidden.push(bg);
    } else if (GIM_INK) {
      dev.push(bg);
    }
  }
  return [Defines.RANDOM_BG, ...regular, ...hidden, ...dev];
}
