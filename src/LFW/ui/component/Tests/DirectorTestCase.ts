import type { IDirectorData } from "../../../defines/IDirectorData";
import { Director } from "../../../director/Director";
import { TestCase } from "./TestCase";
import type { Tests } from "./Tests";

export class DirectorTestCase extends TestCase {
  readonly data: IDirectorData;
  readonly playback: Director;

  constructor(owner: Tests, data: IDirectorData) {
    super(owner);
    this.data = data;
    this.playback = new Director(owner.world, data);
    this.name = data.name;
  }

  override enter(): void {
    this.playback.start();
  }

  override update(dt: number): void {
    this.playback.update(dt);
  }

  override leave(): void {
    this.playback.stop();
    super.leave();
  }
}
