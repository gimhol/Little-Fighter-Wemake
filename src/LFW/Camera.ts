import { Ditto } from '.';
import { type IVector2, Defines } from './defines';
import { abs, clamp, is_num, max, min, round, sign } from './utils';
import type { World } from './World';

export class Camera {
  readonly world: World;
  readonly destination: IVector2;
  readonly position: IVector2;
  readonly velocity: IVector2;
  lock_position?: IVector2 | null = null;
  dest_position?: IVector2 | null = null;
  constructor(world: World) {
    this.world = world;
    this.destination = Ditto.vec2();
    this.position = Ditto.vec2();
    this.velocity = Ditto.vec2();
  }
  update() {
    const { stage, bg, dataset: { atom_time, screen_w, screen_h } } = this.world;
    do {
      const { cam_l, left, cam_r, right } = stage;
      const min_cam_l = is_num(this.lock_position?.x) ? left : cam_l;
      const max_cam_r = is_num(this.lock_position?.x) ? right : cam_r;
      const max_cam_x = max_cam_r - screen_w;
      let max_vx_ratio = 50;
      let acc_x_ratio = 1;
      this.destination.x = clamp(this.lock_position?.x ?? this.dest_position?.x ?? this.destination.x,
        min_cam_l,
        max_cam_r - screen_w
      );
      if (this.position.x < min_cam_l || this.position.x > max_cam_x) {
        this.velocity.x = 0;
        this.position.x = clamp(this.position.x, min_cam_l, max_cam_x);
        break;
      }
      if (round(this.position.x) == round(this.destination.x)) break;

      const acc_x = min(
        atom_time * acc_x_ratio,
        atom_time * 0.7 * (acc_x_ratio * abs(this.position.x - this.destination.x)) / screen_w
      );
      const direction_x = this.position.x > this.destination.x ? -1 : 1;
      const max_vx = direction_x * max_vx_ratio * acc_x;
      if (sign(this.velocity.x) !== direction_x)
        this.velocity.x = 0;
      if (abs(this.velocity.x) < abs(max_vx))
        this.velocity.x += acc_x * direction_x;

      else
        this.velocity.x = max_vx;
      if (direction_x < 0)
        this.position.x = max(this.destination.x, this.position.x + this.velocity.x);

      else
        this.position.x = min(this.destination.x, this.position.x + this.velocity.x);
    } while (0);

    do {
      const { height } = bg;
      if (height <= Defines.MODERN_SCREEN_HEIGHT) {
        this.position.y = this.destination.y = 0;
        break;
      }
      const { far } = this.world.stage;
      let max_vy_ratio = 50;
      let acc_y_ratio = 1;
      const cam_y = this.lock_position?.y ?? this.dest_position?.y ?? this.destination.y;
      const cam_max_y = min(-0.5 * far, height - Defines.MODERN_SCREEN_HEIGHT);
      this.destination.y = clamp(cam_y, 0, cam_max_y);
      const acc_y = min(
        atom_time * acc_y_ratio,
        atom_time * 0.7 * (acc_y_ratio * abs(this.position.y - this.destination.y)) / screen_h
      );
      if (round(this.position.y) == round(this.destination.y)) break;
      const direction_y = this.position.y > this.destination.y ? -1 : 1;
      const max_vy = direction_y * max_vy_ratio * acc_y;
      if (sign(this.velocity.y) !== direction_y)
        this.velocity.y = 0;
      if (abs(this.velocity.y) < abs(max_vy))
        this.velocity.y += acc_y * direction_y;

      else
        this.velocity.y = max_vy;
      if (direction_y < 0)
        this.position.y = max(this.destination.y, this.position.y + this.velocity.y);
      else
        this.position.y = min(this.destination.y, this.position.y + this.velocity.y);
    } while (0);
  }
}
