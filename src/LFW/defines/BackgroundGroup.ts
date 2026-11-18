export enum BackgroundGroup {
  /**
   * 常规
   * 属于此组才可被随机到
   */
  Regular = "regular",
  Hidden = "hidden",
  Classic = "classic",
}
export const BackgroundGroupDescriptions: Record<BackgroundGroup, string> = {
  [BackgroundGroup.Regular]: "",
  [BackgroundGroup.Hidden]: "",
  [BackgroundGroup.Classic]: "",
}
export const BGG = BackgroundGroup;
export type BGG = BackgroundGroup;