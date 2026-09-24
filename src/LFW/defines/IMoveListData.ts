export interface IMoveDemoEntity {
  oid: string;
  team?: string;
  time?: number;
  frame?: string;
  x?: number;
  dx?: number;
  y?: number;
  z?: number;
  dz?: number;
  facing?: 1 | -1;
  hp?: number;
  stat_bar?: boolean;
  tired?: boolean;
  seq?: IMoveStep[];
}

export interface IMoveStep {
  time?: number;
  keydowns?: string;
  keyups?: string;
  clicks?: string;
  loop?: number;
  gap?: number;
}

export interface IMoveInfo {
  name?: string;
  frame?: string;
  seq?: IMoveStep[];
  keys?: string;
  desc?: string;
  mp?: number;
  dx?: number;
  hp?: number;
  stat_bar?: boolean;
  start_delay?: number;
  end_delay?: number;
  entities?: IMoveDemoEntity[];
}

export interface IMoveListData {
  oid: string;
  name?: string;
  team?: string;
  bg?: string;
  x?: number;
  z?: number;
  facing?: 1 | -1;
  start_delay?: number;
  end_delay?: number;
  entities?: IMoveDemoEntity[];
  moves?: IMoveInfo[];
}
