import { fields, str } from "../fields";

export enum DatTypeEnum {
  Invalid     /* */ = "",
  Fighter     /* */ = "0",
  WeaponA     /* */ = "1",
  WeaponB     /* */ = "2",
  Ball        /* */ = "3",
  WeaponC     /* */ = "4",
  Criminal    /* */ = "5",
  WeaponD     /* */ = "6",
  Background  /* */ = "bg",
  Stage       /* */ = "stage",
  Bot         /* */ = "bot",
}
export const dat_type_enum_list = [
  DatTypeEnum.Invalid,
  DatTypeEnum.Fighter,
  DatTypeEnum.WeaponA,
  DatTypeEnum.WeaponB,
  DatTypeEnum.Ball,
  DatTypeEnum.WeaponC,
  DatTypeEnum.Criminal,
  DatTypeEnum.WeaponD,
  DatTypeEnum.Background,
  DatTypeEnum.Stage,
  DatTypeEnum.Bot,
]
export const dat_type_enum_list_labels: Record<DatTypeEnum, string> = {
  [DatTypeEnum.Invalid]: "",
  [DatTypeEnum.Fighter]: "",
  [DatTypeEnum.WeaponA]: "",
  [DatTypeEnum.WeaponB]: "",
  [DatTypeEnum.Ball]: "",
  [DatTypeEnum.WeaponC]: "",
  [DatTypeEnum.Criminal]: "",
  [DatTypeEnum.WeaponD]: "",
  [DatTypeEnum.Background]: "",
  [DatTypeEnum.Stage]: "",
  [DatTypeEnum.Bot]: "",
}
export const dat_type_enum_list_descriptions: Record<DatTypeEnum, string> = {
  [DatTypeEnum.Invalid]: "",
  [DatTypeEnum.Fighter]: "",
  [DatTypeEnum.WeaponA]: "",
  [DatTypeEnum.WeaponB]: "",
  [DatTypeEnum.Ball]: "",
  [DatTypeEnum.WeaponC]: "",
  [DatTypeEnum.Criminal]: "",
  [DatTypeEnum.WeaponD]: "",
  [DatTypeEnum.Background]: "",
  [DatTypeEnum.Stage]: "",
  [DatTypeEnum.Bot]: "",
}
export const suffix_map: Record<DatTypeEnum, '' | 'bg' | 'stage' | 'obj' | 'bot'> = {
  [DatTypeEnum.Invalid]: "obj",
  [DatTypeEnum.Fighter]: "obj",
  [DatTypeEnum.WeaponA]: "obj",
  [DatTypeEnum.WeaponB]: "obj",
  [DatTypeEnum.Ball]: "obj",
  [DatTypeEnum.WeaponC]: "obj",
  [DatTypeEnum.Criminal]: "obj",
  [DatTypeEnum.WeaponD]: "obj",
  [DatTypeEnum.Background]: "bg",
  [DatTypeEnum.Stage]: "stage",
  [DatTypeEnum.Bot]: "bot"
}
export interface IDatIndex {
  id: string;
  type: DatTypeEnum;
  file: string;
  hash?: string;
  alias?: string;
  groups?: string[];
  skipped?: string;
  bot?: string;
}
export function dat_index_new(): IDatIndex {
  return { id: "", type: DatTypeEnum.Invalid, file: "" }
}
export const dat_index_fields = fields<IDatIndex>({
  id: str({ nullable: false }),
  type: str({
    nullable: false,
    options: dat_type_enum_list.map(value => ({
      value,
      label: dat_type_enum_list_labels[value],
      desc: dat_type_enum_list_descriptions[value],
    }))
  }),
  file: str({ nullable: false }),
  hash: str({ nullable: true }),
  alias: str({ nullable: true }),
  groups: str({ nullable: true, array: true }),
  skipped: str({ nullable: true }),
  bot: str({ nullable: true }),
})
export interface ITempDatIndex extends IDatIndex {
  src: string
}
