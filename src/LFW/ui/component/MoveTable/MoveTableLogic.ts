import { Defines, FacingFlag, GK, StateEnum, type IMoveDemoEnemy, type IMoveInfo, type IMoveListData, type LGK } from "../../../defines";
import { LFW } from "../../../LFW";
import type { Entity } from "../../../entity";
import type { IUIKeyEvent } from "../../IUIKeyEvent";
import type { UINode } from "../../UINode";
import { Picture } from "../Picture";
import { UIComponent } from "../UIComponent";

const DEFAULT_BG = "bg_move_table";
const DEFAULT_ENEMY_DX = 150;
const DEFAULT_ENEMY_HP = 9999;
const DEFAULT_STEP_WAIT = 100;
const MIN_INPUT_TIME = 200;
const MAX_INPUT_TIME = 4000;
const DEMO_MP = 1000000;
const ACTOR_DX = 60;
const ROW_COUNT = 8;
const ROW_CURSOR = "▶ ";
const ROW_INDENT = "   ";
const NO_ENEMIES: IMoveDemoEnemy[] = [];

enum StepKind { Click, Down, Up }

interface IKeyStep {
  at: number;
  kind: StepKind;
  keys: string;
}

export class MoveTableLogic extends UIComponent {
  static override readonly TAGS: string[] = ["MoveTableLogic"];

  private _list_index = 0;
  private _move_index = 0;
  private _actor: Entity | null = null;
  private _enemies: Entity[] = [];
  private _steps: IKeyStep[] = [];
  private _step_index = 0;
  private _move_time = 0;
  private _phase = 0;
  private _loading = false;
  private _char_label: UINode | null = null;
  private _name_label: UINode | null = null;
  private _keys_label: UINode | null = null;
  private _desc_label: UINode | null = null;
  private _face: Picture | null = null;
  private _row_names: UINode[] = [];
  private _row_keys: UINode[] = [];

  private get lists(): IMoveListData[] {
    return this.lfw.datas.moves;
  }
  private get list(): IMoveListData | undefined {
    return this.lists[this._list_index];
  }

  override on_start(): void {
    this._char_label = this.node.search_node("move_table_char") ?? null;
    this._name_label = this.node.search_node("move_table_name") ?? null;
    this._keys_label = this.node.search_node("move_table_keys") ?? null;
    this._desc_label = this.node.search_node("move_table_desc") ?? null;
    this._face = this.node.search_node("move_table_face")?.find_component(Picture) ?? null;
    this._row_names.length = 0;
    this._row_keys.length = 0;
    for (let i = 0; i < ROW_COUNT; i++) {
      const name_node = this.node.search_node(`move_row_${i}`);
      const keys_node = this.node.search_node(`move_row_keys_${i}`);
      if (name_node) this._row_names.push(name_node);
      if (keys_node) this._row_keys.push(keys_node);
    }
    if (this.lists.length) this.enter_list(0);
    else this.load_lists();
  }

  private load_lists(): void {
    if (this._loading) return;
    const zips = LFW.ZIPS.slice(1);
    if (!zips.length) return;
    this._loading = true;
    this._char_label?.set_text(this.lfw.string("now_loading"));
    this.lfw.load(...zips).then(
      () => {
        this._loading = false;
        this.enter_list(0);
      },
      (e) => this.warn(`[MoveTableLogic] failed to load data zips: ${e}`),
    );
  }

  override on_stop(): void {
    this.world.clear();
    this._actor = null;
    this._enemies.length = 0;
  }

  override on_key_down(e: IUIKeyEvent): void {
    if (!this.lists.length) return;
    else if (GK.L === e.game_key) this.enter_list(this._list_index - 1);
    else if (GK.R === e.game_key) this.enter_list(this._list_index + 1);
    else if (GK.U === e.game_key) this.start_move(this._move_index - 1);
    else if (GK.D === e.game_key) this.start_move(this._move_index + 1);
    else if (GK.a === e.game_key) this.start_move(this._move_index);
    else if (GK.j === e.game_key) this.start_move(this._move_index);
  }

  override update(dt: number): void {
    if (this.world.paused) return;
    const list = this.list;
    if (!list || !list.moves?.length) return;
    if (!this._actor || this._actor.hp <= 0) {
      this.start_move(this._move_index);
      return;
    }
    this._move_time += dt;
    if (this._phase === 0) {
      while (
        this._step_index < this._steps.length &&
        this._steps[this._step_index].at <= this._move_time
      ) {
        this.exec_step(this._steps[this._step_index++]);
      }
      if (this._step_index >= this._steps.length && this._move_time >= MIN_INPUT_TIME)
        this._phase = 1;
    } else if (this._phase === 1) {
      const idle =
        this._actor.state === StateEnum.Standing ||
        this._actor.state === StateEnum.Walking;
      if (idle || this._move_time >= MAX_INPUT_TIME) {
        this._phase = 2;
      }
    }
  }

  private enter_list(index: number): void {
    const lists = this.lists;
    if (!lists.length) return;
    const len = lists.length;
    this._list_index = ((index % len) + len) % len;
    const list = lists[this._list_index];
    const data = this.lfw.datas.find(list.oid ?? list.oid);
    this._char_label?.set_text(list.name ?? data?.base.name ?? list.oid);
    this._face?.set_src(data?.base.head ?? Defines.BuiltIn_Imgs.RFACE);
    this.start_move(0);
  }

  private start_move(index: number): void {
    const list = this.list;
    if (!list || !list.moves?.length) return;
    const len = list.moves.length;
    this._move_index = ((index % len) + len) % len;
    const move = list.moves[this._move_index];
    this.rebuild_scene(list, move);
    if (move.frame) this.enter_move_frame(move.frame);
    this.build_steps(move);
    this._step_index = 0;
    this._move_time = 0;
    this._phase = 0;
    this.update_move_labels(list, move);
  }

  private rebuild_scene(list: IMoveListData, move: IMoveInfo): void {
    this.world.clear();
    this.lfw.change_bg(list.bg ?? DEFAULT_BG);
    this.world.camera.undest();
    this.world.camera.unlock();
    this._enemies.length = 0;
    this._actor = this.spawn_actor(list);
    this.spawn_enemies(move.enemies ?? list.enemies ?? NO_ENEMIES);
  }

  private enter_move_frame(id: string): void {
    const actor = this._actor;
    if (!actor) return;
    actor.mp = DEMO_MP;
    actor.enter_frame_by_id(id, true);
  }

  private set_move_name(node: UINode | null, move: IMoveInfo | undefined, prefix = ""): void {
    if (!node) return;
    const key = move?.name;
    node.set_text(key ? prefix + this.lfw.string(key) : "");
  }

  private update_move_labels(list: IMoveListData, move: IMoveInfo): void {
    this.set_move_name(this._name_label, move);
    this._keys_label?.set_text(move.keys ?? "");
    this._desc_label?.set_text(
      move.desc
        ? this.lfw.string(move.desc)
        : move.mp
          ? `${this.lfw.string("move_table.mp")}: ${move.mp}`
          : "",
    );
    const moves = list.moves;
    for (let i = 0; i < this._row_names.length; i++) {
      const row = moves?.[i];
      const current = i === this._move_index;
      const name_node = this._row_names[i];
      const keys_node = this._row_keys[i];
      if (name_node) {
        name_node.visible = !!row;
        name_node.opacity = current ? 1 : 0.55;
        this.set_move_name(name_node, row, current ? ROW_CURSOR : ROW_INDENT);
      }
      if (keys_node) {
        keys_node.visible = !!row;
        keys_node.opacity = current ? 1 : 0.55;
        keys_node.set_text(row?.keys ?? "");
      }
    }
  }

  private build_steps(move: IMoveInfo): void {
    this._steps.length = 0;
    const { seq } = move;
    if (!seq?.length) return;
    let at = 0;
    for (const step of seq) {
      at = step.time ?? (at + DEFAULT_STEP_WAIT);
      if (step.keyups) this._steps.push({ at, kind: StepKind.Up, keys: step.keyups });
      if (step.keydowns) this._steps.push({ at, kind: StepKind.Down, keys: step.keydowns });
      if (step.clicks) this._steps.push({ at, kind: StepKind.Click, keys: step.clicks });
    }
  }

  private exec_step(step: IKeyStep): void {
    const ctrl = this._actor?.ctrl;
    if (!ctrl) return;
    const keys = this.parse_keys(step.keys);
    if (!keys.length) return;
    if (step.kind === StepKind.Click) ctrl.click(...keys);
    else if (step.kind === StepKind.Down) ctrl.key_down(...keys);
    else ctrl.key_up(...keys);
  }

  private parse_keys(str: string): LGK[] {
    const facing = (this._actor?.facing ?? FacingFlag.R) > 0 ? 1 : -1;
    const ret: LGK[] = [];
    for (const c of str) {
      switch (c) {
        case "L": ret.push(GK.L); break;
        case "R": ret.push(GK.R); break;
        case "U": ret.push(GK.U); break;
        case "D": ret.push(GK.D); break;
        case "a": ret.push(GK.a); break;
        case "j": ret.push(GK.j); break;
        case "d": ret.push(GK.d); break;
        case "F": ret.push(facing > 0 ? GK.R : GK.L); break;
        case "B": ret.push(facing > 0 ? GK.L : GK.R); break;
      }
    }
    return ret;
  }

  private spawn_actor(list: IMoveListData): Entity | null {
    const data = this.lfw.datas.find(list.oid ?? list.oid);
    if (!data) {
      this.warn(`[MoveTableLogic] fighter data not found: ${list.oid ?? list.oid}`);
      return null;
    }
    const entity = this.lfw.factory.create_entity(this.world, data);
    if (!entity) return null;
    const { bg } = this.world;
    const x = list.x ?? (bg.left + bg.right) / 2 + ACTOR_DX;
    const z = list.z ?? (bg.near + bg.far) / 2;
    entity.set_position(x, 0, z);
    entity.facing = list.facing ?? FacingFlag.R;
    entity.key_role = false;
    entity.name_visible = false;
    entity.attach();
    entity.mp = DEMO_MP;
    return entity;
  }

  private spawn_enemies(spec: IMoveDemoEnemy[]): void {
    const actor = this._actor;
    if (!actor) return;
    const facing = actor.facing > 0 ? 1 : -1;
    const { x: ax, z: az } = actor.position;
    for (const s of spec) {
      const data = this.lfw.datas.find_object(s.oid);
      if (!data) {
        this.warn(`[MoveTableLogic] enemy data not found: ${s.oid}`);
        continue;
      }
      const entity = this.lfw.factory.create_entity(this.world, data);
      if (!entity) continue;
      const x = s.x ?? ax + (s.dx ?? DEFAULT_ENEMY_DX) * facing;
      const z = s.z ?? az + (s.dz ?? 0);
      entity.set_position(x, s.y ?? 0, z);
      entity.facing = s.facing ?? (x >= ax ? FacingFlag.L : FacingFlag.R);
      entity.key_role = false;
      entity.name_visible = false;
      entity.attach();
      const hp = s.hp ?? DEFAULT_ENEMY_HP;
      entity.hp_max = hp;
      entity.hp = hp;
      if (s.tired) {
        const tired = Object.values(data.frames).find((f) => f.state === StateEnum.Tired);
        if (tired) entity.enter_frame_by_id(tired.id, true);
      }
      this._enemies.push(entity);
    }
  }
}
