/**
 * 模式(Stage/Vs/Demo)的 FSM 状态枚举
 */
export enum ModeState {
  Invalid = '',
  Running = 'Running',
  BeforeEnd = 'BeforeEnd',
  End = 'End',
  Restart = 'Restart',
}
