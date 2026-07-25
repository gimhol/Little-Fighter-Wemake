import { fields, str } from "../fields";

export interface IModelInfo {
  id: string;
  path: string;
  variants?: string[];
}
export function model_info_new(): IModelInfo {
  const ret: IModelInfo = {
    id: "",
    path: ""
  }
  return ret
}
export const model_info_fields = fields<Partial<IModelInfo>>({
  id: str('模型ID'),
  path: str('路径'),
  variants: str('变体', { array: true }),
});