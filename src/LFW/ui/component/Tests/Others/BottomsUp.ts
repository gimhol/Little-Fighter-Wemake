import { GK, O_ID } from "../../../../defines";
import { Entity } from "../../../../entity";
import { ActionDirector } from "../ActionDirector";
import { TestCase } from "../TestCase";

export class BottomsUp extends TestCase {
  override name: string = 'Bottoms Up Drop Test (Alcohol Abuse Results in Harm to Your Health)'
  figters: Entity[] = []
override readonly director = new ActionDirector()
    .offset(1000,
      () => {
        this.figters.forEach(v => v.ctrl.click(GK.Attack))
      },
      () => {
        this.figters.forEach(v => v.ctrl.click(GK.Attack))
      }
    )
    .sort()


  override enter(): void {
    this.director.reset();
    this.figters = [
      ...this.circle(O_ID.Bandit, this.midX, this.midZ, 100, 100, 8),
      ...this.circle(O_ID.Bandit, this.midX, this.midZ, 200, 200, 8),
    ]
    this.circle(O_ID.Weapon_Beer, this.midX, this.midZ, 100, 100, 8)
    this.circle(O_ID.Weapon_milk, this.midX, this.midZ, 200, 200, 8)
  }
}
