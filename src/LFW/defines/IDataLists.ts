import type { IDatIndex, ITempDatIndex } from "./IDatIndex";

export interface IDataLists {
  objects: IDatIndex[];
  backgrounds: IDatIndex[];
  stages: IDatIndex[];
  bots: IDatIndex[];
  moves?: IDatIndex[];
}

export interface ITempDataLists {
  objects: ITempDatIndex[];
  backgrounds: ITempDatIndex[];
  stages: ITempDatIndex[];
  bots: ITempDatIndex[];
  moves?: ITempDatIndex[];
}
