export enum BotStateEnum {
  Idle = 'Idle',
  Avoiding = 'Avoiding',
  Chasing = 'Chasing',
  Following = 'Following',
  StageEnd = 'StageEnd',
  Lying = 'Lying',
  Dead = 'Dead'
}
export const BotStateEnumDescriptions: Record<BotStateEnum, string> = {
  [BotStateEnum.Idle]: "",
  [BotStateEnum.Avoiding]: "",
  [BotStateEnum.Chasing]: "",
  [BotStateEnum.Following]: "",
  [BotStateEnum.StageEnd]: "",
  [BotStateEnum.Lying]: "",
  [BotStateEnum.Dead]: "",
}
export type BSE = BotStateEnum;
export const BSE = BotStateEnum;


