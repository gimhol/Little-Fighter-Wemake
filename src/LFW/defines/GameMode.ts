/** 对局模式 */
export enum GameMode {
  Vs = 'vs',
  Stage = 'stage',
  SurvivalRank1P = 'survival_rank_1p',
  SurvivalRank2P = 'survival_rank_2p',
}

/** 是否为生存排行模式（单人/双人） */
export function is_survival_rank_mode(mode: GameMode | undefined): boolean {
  return mode === GameMode.SurvivalRank1P || mode === GameMode.SurvivalRank2P;
}
