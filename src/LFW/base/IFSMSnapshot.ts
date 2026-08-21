export interface IFSMSnapshot<K extends string | number = string | number> {
  /** FSM 名称 */
  name: string;
  /** 当前状态 key */
  state_key: K | undefined;
  /** 上一个状态 key */
  prev_state_key: K | undefined;
  /** 累计时间 */
  time: number;
  /** 当前状态持续时间 */
  state_time: number;
}
