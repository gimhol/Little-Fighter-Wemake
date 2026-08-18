
export enum Difficulty {
  Easy = 1,
  Normal = 2,
  Difficult = 3,
  Crazy = 4,

  MIN = 1,
  MAX = 4,
}
export function is_difficulty(v: any): v is Difficulty {
  return v === 1 || v === 2 || v === 3 || v === 4;
}
export const DifficultyList = [
  Difficulty.Easy,
  Difficulty.Normal,
  Difficulty.Difficult,
  Difficulty.Crazy,
]
export const DifficultyDescriptions: Record<Difficulty, string> = {
  [Difficulty.Easy]: "",
  [Difficulty.Normal]: "",
  [Difficulty.Difficult]: "",
  [Difficulty.Crazy]: "",
}
export const DifficultyNames: Record<Difficulty, string> = {
  [Difficulty.Easy]: "Easy",
  [Difficulty.Normal]: "Normal",
  [Difficulty.Difficult]: "Difficult",
  [Difficulty.Crazy]: "Crazy!",
};
