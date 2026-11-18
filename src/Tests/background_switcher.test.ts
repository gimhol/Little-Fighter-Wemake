import { BGG, Defines, type IBgData, type IWorldDataset } from "../LFW/defines";
import { arrange_switcher_backgrounds } from "../LFW/ui/component/background_switcher_order";

function bg(id: string, group?: string[]): IBgData {
  return { id, type: "background", base: { name: id, group } };
}

function ids(backgrounds: IBgData[]) {
  return backgrounds.map(v => v.id);
}

const regular_a = bg("regular_a", [BGG.Regular]);
const regular_b = bg("regular_b", [BGG.Regular, BGG.Classic]);
const hidden = bg("hidden", [BGG.Hidden]);
const dev = bg("castle_crypt", [BGG.Dev]);
const no_group = bg("no_group");

function arrange(dataset: Partial<IWorldDataset>) {
  return arrange_switcher_backgrounds(
    [hidden, dev, no_group, regular_a, regular_b],
    dataset,
  );
}

test("选图列表：随机在最前，常规地图按数据顺序", () => {
  expect(ids(arrange({}))).toEqual([
    Defines.RANDOM_BG.id,
    "regular_a",
    "regular_b",
  ]);
});

test("选图列表：hidden 只在联机模式出现，且排在常规地图之后", () => {
  expect(ids(arrange({ LF2_NET: 1 }))).toEqual([
    Defines.RANDOM_BG.id,
    "regular_a",
    "regular_b",
    "hidden",
  ]);
});

test("选图列表：dev 组只在 GIM_INK 下出现，且排在最后", () => {
  expect(ids(arrange({ GIM_INK: 1 }))).toEqual([
    Defines.RANDOM_BG.id,
    "regular_a",
    "regular_b",
    "castle_crypt",
    "no_group",
  ]);
});

test("选图列表：net + GIM_INK 时顺序为 常规 > hidden > dev", () => {
  expect(ids(arrange({ LF2_NET: 1, GIM_INK: 1 }))).toEqual([
    Defines.RANDOM_BG.id,
    "regular_a",
    "regular_b",
    "hidden",
    "castle_crypt",
    "no_group",
  ]);
});

test("选图列表：不包含 VOID_BG", () => {
  const ret = arrange_switcher_backgrounds(
    [Defines.VOID_BG, regular_a],
    { GIM_INK: 1, LF2_NET: 1 },
  );
  expect(ids(ret)).toEqual([Defines.RANDOM_BG.id, "regular_a"]);
});
