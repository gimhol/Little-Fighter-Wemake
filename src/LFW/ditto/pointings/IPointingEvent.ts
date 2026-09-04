export interface IPointingEvent {
  readonly x: number;
  readonly y: number;
  readonly scene_x: number;
  readonly scene_y: number;
  readonly is_pointing_event: true;
  readonly button: number;
  readonly delta_x: number;
  readonly delta_y: number;
}
