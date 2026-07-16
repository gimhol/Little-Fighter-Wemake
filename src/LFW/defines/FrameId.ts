
export enum FrameId {
  None = "",
  Auto = "auto",
  Self = "self",
  Gone = "gone",
  Invisible_Min = "1100",// 1100 ~ 1299 隐身
  Invisible_Max = "1299",
  Respawn = "respawn"
}
export const FrameIdDescriptions: Record<FrameId, string> = {
  [FrameId.None]: "",
  [FrameId.Auto]: "",
  [FrameId.Self]: "",
  [FrameId.Gone]: "",
  [FrameId.Invisible_Min]: "",
  [FrameId.Invisible_Max]: "",
  [FrameId.Respawn]: "",
}
export type FID = FrameId;
export const FID = FrameId;