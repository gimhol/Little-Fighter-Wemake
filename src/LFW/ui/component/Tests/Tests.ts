import { Bat_DUJ_3 } from './Bat/Bat_DUJ';
import { BotAvoiding } from './Bot/BotAvoiding';
import { WeaponPicking2 } from './Bot/WeaponPicking2';
import { WeaponPicking1 } from './Bot/WeaponPicking1';
import { BotFollow } from './Others/Follow';
import { FasterSlowerStandUp } from './Others/FasterSlowerStandUp';
import { Firzen_DUA_0, Firzen_DUA_2 } from './Firezen/Firzen_DUA';
import { Henry_DUJ } from './Julian/Julian_DUJ';
import { FSM } from "../../../base/FSM";
import { GK, type IClazz } from "../../../defines";
import type { IUIKeyEvent } from "../../IUIKeyEvent";
import { Label } from "../Label";
import { UIComponent } from "../UIComponent";
import { Bat_DUJ_0, Bat_DUJ_1, Bat_DUJ_2 } from './Bat/Bat_DUJ';
import { MoonTest } from "./Bg/Moon";
import { Firen_DFA } from './Firen/Firen_DFA';
import { Firen_DFJ } from './Firen/Firen_DFJ';
import { Firen_DUJ } from './Firen/Firen_DUJ';
import { Firen_DVJ } from './Firen/Firen_DVJ';
import { Firzen_DUA_1 } from './Firezen/Firzen_DUA';
import { Firzen_FUSION } from './Firezen/Firzen_FUSION';
import { Freeze_DFA } from './Freeze/Freeze_DFA';
import { Freeze_DFJ } from './Freeze/Freeze_DFJ';
import { Freeze_DUJ } from './Freeze/Freeze_DUJ';
import { Freeze_DVJ } from './Freeze/Freeze_DVJ';
import { Jan_DUA, Jan_DUA_2 } from './Jan/Jan_DUA';
import { Jan_DUJ, Jan_DUJ_2 } from './Jan/Jan_DUJ';
import { Julian_DFA } from './Julian/Julian_DFA';
import { Julian_DFJ } from './Julian/Julian_DFJ';
import { Julian_DUJ } from './Julian/Julian_DUJ';
import { LOUIS_JUMP_ATTACK } from './Louis/LOUIS_JUMP_ATTACK';
import { BotCome } from './Others/Come';
import { BottomsUp } from './Others/BottomsUp';
import { MoveStayCome } from './Others/MoveStayCome';
import { AllFighters } from "./Others/AllFighters";
import { Rudolf_DFJ } from './Rudolf/Rudolf_DFJ';
import { TestCase } from "./TestCase";
import { CriminalSaving1 } from './Others/CriminalSaving';
import { ArmorTest1 } from './Others/ArmorTest1';
import { Ball_3000_vs_Ball_3000, Ball_3000_vs_Ball_3005, Ball_3000_vs_Ball_3006, Ball_3000_vs_BurnRun, Ball_3000_vs_JohnShield, Ball_3000_vs_ManyPunch, Ball_3005_vs_Ball_3005, Ball_3005_vs_Ball_3006, Ball_3005_vs_BurnRun, Ball_3005_vs_JohnShield, Ball_3005_vs_ManyPunch, Ball_3006_vs_Ball_3006, Ball_3006_vs_BurnRun, Ball_3006_vs_JohnShield, Ball_3006_vs_ManyPunch } from './Ball/Ball';
import { Boomerang_1_1, Boomerang_1_2, Boomerang_1_3, Boomerang_1_4, Boomerang_1_5, Boomerang_1_6, Boomerang_2_1, Boomerang_2_2, Boomerang_2_3, Boomerang_2_4, Boomerang_2_5, Boomerang_2_6, Boomerang_3_1, Boomerang_3_2, Boomerang_3_3, Boomerang_3_4, Boomerang_3_5, Boomerang_3_6 } from './Weapons/Boomerang';

const CASE_GROUPS: IClazz<TestCase, [Tests]>[][] = [
  [TestCase, AllFighters], [
    Julian_DUJ, Julian_DFJ, Julian_DFA
  ], [
    Firzen_DUA_0, Firzen_DUA_1, Firzen_DUA_2, Firzen_FUSION
  ], [
    Bat_DUJ_0, Bat_DUJ_1, Bat_DUJ_2, Bat_DUJ_3
  ], [
    Jan_DUA,
    Jan_DUA_2,
    Jan_DUJ,
    Jan_DUJ_2
  ], [
    Henry_DUJ
  ], [
    Rudolf_DFJ
  ], [
    Firen_DUJ, Firen_DFA, Firen_DFJ, Firen_DVJ,
  ], [
    Freeze_DUJ, Freeze_DFA, Freeze_DFJ, Freeze_DVJ,
  ], [
    LOUIS_JUMP_ATTACK
  ], [
    MoonTest
  ], [BottomsUp, MoveStayCome, BotCome, BotFollow, FasterSlowerStandUp,
  ], [
    BotAvoiding, WeaponPicking1, WeaponPicking2, CriminalSaving1, ArmorTest1
  ], [
    Ball_3000_vs_Ball_3000, Ball_3000_vs_Ball_3005, Ball_3000_vs_Ball_3006,
    Ball_3005_vs_Ball_3005, Ball_3005_vs_Ball_3006, Ball_3006_vs_Ball_3006,
    Ball_3000_vs_JohnShield, Ball_3005_vs_JohnShield, Ball_3006_vs_JohnShield,
    Ball_3000_vs_ManyPunch, Ball_3005_vs_ManyPunch, Ball_3006_vs_ManyPunch,
    Ball_3000_vs_BurnRun, Ball_3005_vs_BurnRun, Ball_3006_vs_BurnRun,
  ], [
    Boomerang_1_1, Boomerang_1_2, Boomerang_1_3, 
    Boomerang_1_4, Boomerang_1_5, Boomerang_1_6,
    Boomerang_2_1, Boomerang_2_2, Boomerang_2_3, 
    Boomerang_2_4, Boomerang_2_5, Boomerang_2_6,
    Boomerang_3_1, Boomerang_3_2, Boomerang_3_3, 
    Boomerang_3_4, Boomerang_3_5, Boomerang_3_6
  ]
]
export class Tests extends UIComponent {
  static override readonly TAGS: string[] = ["Tests"];
  readonly fsm = new FSM<number, TestCase>();
  groups: TestCase[][] = []
  override init(): void { }
  override on_start(): void {
    TestCase.key = -1;
    this.groups = CASE_GROUPS.map((cases, x) => cases.map((C, y) => {
      const r = new C(this)
      r.name = `${x}-${y} ${r.name}`
      this.fsm.add(r)
      return r;
    }))
    this.fsm.use(0)
    this.fsm.callbacks.add({
      on_state_changed: (f) => {
        const n = f.state?.name ?? 'None'
        const nn = this.node.search_component(Label, v => v.id === 'test_case_name')
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