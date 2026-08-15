import { O_ID } from "../../../../defines";
import { TestCase } from "../TestCase";

export class BotAvoiding extends TestCase {
  override name: string = 'Bot Chasing/Avoiding';
  override enter(): void {
    this.entities = this.hori_2(O_ID.Bandit)
    this.entities.forEach((e, i) => {
      e.team = '' + (i + 1);
      e.blinking = i ? Number.MAX_SAFE_INTEGER : 0;
      e.key_role = true;
      e.name = i ? 'Chasing' : 'Avoiding'
      e.ctrl = this.lfw.factory.create_ctrl(e.data.id, this.lfw.new_id, e)
    })
  }
}
