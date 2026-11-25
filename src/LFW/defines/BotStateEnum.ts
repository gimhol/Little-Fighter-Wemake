export enum BotStateEnum {
  Idle = 'Idle',
  Avoiding = 'Avoiding',
  /** 追敌人 */
  Chasing = 'Chasing',
  /** 捡武器 */
  Picking = 'Picking',
  Following = 'Following',
  StageEnd = 'StageEnd',
  Lying = 'Lying',
  Dead = 'Dead'
}
export const BotStateEnumDescriptions: Record<BotStateEnum, string> = {
  [BotStateEnum.Idle]: "",
  [BotStateEnum.Avoiding]: "",
  [BotStateEnum.Chasing]: "",
  [BotStateEnum.Picking]: "捡武器",
  [BotStateEnum.Following]: "",
  [BotStateEnum.StageEnd]: "",
  [BotStateEnum.Lying]: "",
  [BotStateEnum.Dead]: "",
}
export type BSE = BotStateEnum;
export const BSE = BotStateEnum;


