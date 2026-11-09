export interface IUIAction {
  name: string;
  args?: string[];
}

export function ui_action_clone(v: IUIAction): IUIAction {
  return {
    name: v.name,
    args: v.args ? [...v.args] : void 0
  }
}