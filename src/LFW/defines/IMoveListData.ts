export interface IMoveDemoEnemy {
  oid: string;
  x?: number;
  dx?: number;
  y?: number;
  z?: number;
  dz?: number;
  facing?: 1 | -1;
  hp?: number;
  tired?: boolean;
}

export interface IMoveStep {
  time?: number;
  keydowns?: string;
  keyups?: string;
  clicks?: string;
}

export interface IMoveInfo {
  name?: string;
  frame?: string;
  seq?: IMoveStep[];
  keys?: string;
  desc?: string;
  mp?: number;
  enemies?: IMoveDemoEnemy[];
}

export interface IMoveListData {
  oid: string;
  name?: string;
  bg?: string;
  x?: number;
  z?: number;
  facing?: 1 | -1;
  enemies?: IMoveDemoEnemy[];
  moves?: IMoveInfo[];
}
