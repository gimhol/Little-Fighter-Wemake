import { FSM } from "../../../base/FSM";
import { GK } from "../../../defines";
import { supports_platform } from "../../defines/Platform";
import type { IUIKeyEvent } from "../../IUIKeyEvent";
import { UIComponent } from "../UIComponent";
import { DirectorTestCase } from "./DirectorTestCase";
import { TestCase } from "./TestCase";

export class Tests extends UIComponent {
  static override readonly TAGS: string[] = ["Tests"];
  readonly fsm = new FSM<number, TestCase>();
  groups: TestCase[][] = []
  override init(): void { }
  override on_start(): void {
    TestCase.key = -1;
    const groups = this.lfw.datas.directors
      .map(group => group.directors.filter(data => supports_platform(data.platform)))
      .filter(group => group.length > 0);
    if (groups.length) {
      this.groups = groups.map((group, x) => group.map((data, y) => {
        const r = new DirectorTestCase(this, data)
        r.name = `${x}-${y} ${r.name}`
        this.fsm.add(r)
        return r;
      }))
    } else {
      this.groups = [[new TestCase(this)]];
      this.groups.forEach(v => this.fsm.add(...v))
    }
    this.fsm.use(0)
    this.fsm.callbacks.add({
      on_state_changed: (f) => {
        const n = f.state?.name ?? 'None'
        const nn = this.node.search_node('test_case_name')
        nn?.set_text(`Case: ${n}`)
      }
    })
  }

  override on_stop(): void {
    this.world.clear()
  }
  override on_key_down(e: IUIKeyEvent): void {
    const len = this.fsm.states.size;
    if (!len) return;
    const state = this.fsm.state;
    if (state == void 0) this.fsm.use(0)
    else if (GK.R === e.game_key) this.fsm.use((state.key + 1) % len)
    else if (GK.a === e.game_key) this.fsm.use(state.key)
    else if (GK.L === e.game_key) this.fsm.use((state.key + len - 1) % len)
    else if (GK.U === e.game_key) {
      const len = this.groups.length;
      const gid = this.groups.findIndex(v => v.indexOf(state) >= 0)
      const next_gid = (gid + len - 1) % len;
      const cases = this.groups[next_gid]
      this.fsm.use(cases[cases.length - 1].key)
    }
    else if (GK.D === e.game_key) {
      const len = this.groups.length;
      const gid = this.groups.findIndex(v => v.indexOf(state) >= 0)
      const next_gid = (gid + 1) % len;
      const cases = this.groups[next_gid]
      this.fsm.use(cases[0].key)
    }
  }
  override update(dt: number): void {
    this.fsm.update(dt)
  }
}