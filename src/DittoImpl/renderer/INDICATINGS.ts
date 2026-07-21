import type { Indicating } from "./FrameIndicators";

export const ENTITY_INDICATINGS: Record<Indicating, number> = {
  frame: 1,
  bdy: 2,
  itr: 4,
  ft: 8,
  opoint: 16,
  wpoint: 32,
  cpoint: 64,
  bpoint: 128,
  ctrl: 256,
};
export const BG_INDICATINGS = {
  terrain: 1,
} as const;