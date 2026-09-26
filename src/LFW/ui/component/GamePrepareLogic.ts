import { LocalController } from "../../controller/LocalController";
import { Defines, FacingFlag, SurvivalRankOids, TeamEnum } from "../../defines";
import type { IPropsMeta } from "../../defines/ISchema";
import { Ditto } from "../../ditto";
import { StatBarType } from "../../entity/StatBarType";
import type { ILFWCallback } from "../../ILFWCallback";
import type { SurvivalRankItem, SurvivalRankMy } from "../../LFW";
import { WorldDataset } from "../../WorldDataset";
import { BackgroundSwitcher } from "./BackgroundSwitcher";
import { CharMenuLogic } from "./CharMenu/CharMenuLogic";
import { Picture } from "./Picture";
import { ScrollView } from "./ScrollView";
import { StageSwitcher } from "./StageSwitcher";
import { UIComponent } from "./UIComponent";
export interface IGamePrepareLogicProps {
  stage_switcher: StageSwitcher | null,
  bg_switcher: BackgroundSwitcher | null,
  game_mode: string | null,
  players: number | null,
}
const GAME_MODE_VS = "vs_mode"
const GAME_MODE_STAGE = "stage_mode"
const GAME_MODE_SURVIVAL = "survival"
const RANK_PERIODS = ['all', 'month', 'week', 'day'] as const
type RankPeriod = typeof RANK_PERIODS[number]
/** 单次展示的榜单条数（SDK limit 上限约 100） */
const RANK_LIMIT = 100
/** 请求外部(宿主)按当前周期拉取生存排行；外部拉到后经 set_survival_rank_data 下发 */
const BROADCAST_RANK_REQUEST = 'rank_request'
/** 榜单行高与行间距（列表不使用 Flex，行位置由 GamePrepareLogic 固定） */
const RANK_ROW_H = 36
const RANK_ROW_GAP = 8
/** 偶数行（排名 2、4、6…）的极淡白色底（斑马纹） */
const RANK_ROW_EVEN_BG = 'rgba(255,255,255,0.04)'
/** 未选角色时的背景大头像 */
const DEFAULT_BG_FACE = 'sprite/MENU_BACK0.png'
/** 把词条模板里的 %N 依次替换为参数（%1=第 1 个…）；用于带插值的本地化文案 */
const i18n_fmt = (template: string, ...args: (string | number)[]): string =>
  template.replace(/%\d+/g, (m) => {
    const i = Number(m.slice(1)) - 1
    return String(args[i] ?? '')
  })
export class GamePrepareLogic extends UIComponent<IGamePrepareLogicProps> {
  static override readonly TAGS: string[] = ["GamePrepareLogic"];
  static override readonly PROPS: IPropsMeta<IGamePrepareLogicProps> = {
    stage_switcher: { type: StageSwitcher, nullable: true },
    bg_switcher: { type: BackgroundSwitcher, nullable: true },
    game_mode: String,
    players: { type: Number, nullable: true },
  }

  /** 本准备页的玩家数（生存排行双人页为 2，缺省 1） */
  get player_count(): number { return this.props.players ?? 1 }

  override on_start(): void {
    super.on_start?.();
    this.lfw.callbacks.add(this._lf2_callbacks)
  }
  override on_resume(): void {
    const background_row = this.node.search_node("background_row");
    const stage_row = this.node.search_node("stage_row");
    const char_menu_logic = this.node.search_component(CharMenuLogic)
    if (this.props.game_mode === GAME_MODE_SURVIVAL) {
      background_row?.set_visible(false).set_disabled(true);
      stage_row?.set_visible(false).set_disabled(true);
      if (char_menu_logic) {
        char_menu_logic.teams = [TeamEnum.Team_1]
        char_menu_logic.min_player = this.player_count;
        char_menu_logic.max_player = this.player_count;
        char_menu_logic.oids = [...SurvivalRankOids];
      }
    } else if (this.props.game_mode === GAME_MODE_STAGE) {
      stage_row?.set_visible(true).set_disabled(false);
      background_row?.set_visible(false).set_disabled(true);
      if (char_menu_logic) char_menu_logic.teams = [TeamEnum.Team_1]
      if (char_menu_logic) char_menu_logic.min_player = 1;
    } else {
      background_row?.set_visible(true).set_disabled(false);
      stage_row?.set_visible(false).set_disabled(true);
      if (char_menu_logic) char_menu_logic.min_player = 2;
    }
    // 生存排行准备页：右侧刷新排行榜
    this.refresh_survival_rank()
    // 背景大头像/随机问号：跟随选角（未选默认 Julian）
    this.refresh_selection_face()
  }

  /** 每帧跟随选角刷新背景大头像/随机问号（无变化时零开销） */
  override update(dt: number): void {
    super.update?.(dt)
    if (this.props.game_mode === GAME_MODE_SURVIVAL)
      this.refresh_selection_face()
  }

  /** 背景大头像 + 随机“?”：随机/未选 → Julian 背景；明确选中 → 角色 bg_face；随机态在选人框显示问号 */
  protected refresh_selection_face(): void {
    const char_menu_logic = this.node.search_component(CharMenuLogic)
    if (!char_menu_logic) return
    const count = Math.max(1, this.player_count)
    const slots = Array.from(char_menu_logic.players.values())
    const counting = !!this.node.search_node('countdown_text')?.visible
    for (let i = 0; i < count; i++) {
      const slot = slots[i]
      const random = !!slot?.random
      // 随机状态不泄露抽到的角色 → 背景回退 Julian
      const bg_face = !random ? slot?.fighter?.base?.bg_face : undefined
      const next = bg_face || DEFAULT_BG_FACE
      if (next !== this._bg_face_cur[i]) {
        this._bg_face_cur[i] = next
        const face_node = this.node.search_node(i === 0 ? 'survival_bg_face' : 'survival_bg_face_r')
        face_node?.search_component(Picture)?.set_src(next)
      }
      // 随机“?”占位（固定 RFACE 图）：仅 random 且未倒计时时显示
      const mark = char_menu_logic.slots[i]?.head?.node.find_child('random_head')
      if (!mark) continue
      const show_mark = random && !counting
      if (show_mark !== this._random_mark_visible[i]) {
        this._random_mark_visible[i] = show_mark
        mark.set_visible(show_mark)
      }
      if (show_mark && !this._random_src_done[i]) {
        this._random_src_done[i] = true
        mark.search_component(Picture)?.set_src(Defines.BuiltIn_Imgs.RFACE)
      }
      if (!show_mark) this._random_src_done[i] = false
    }
  }

  protected rank_period: RankPeriod = 'all'
  /** 最近一次拉到的榜单/我的成绩与可见状态（语言切换时据此重绘文字，不重新拉取） */
  protected _rank_entries: SurvivalRankItem[] = []
  protected _rank_mine: SurvivalRankMy | null = null
  protected _rank_loaded = false
  protected _rank_board_shown = false
  /** 当前应用到的背景大头像（避免每帧重复 set_src；按槽位） */
  protected _bg_face_cur: string[] = []
  /** 随机“?”占位的可见状态与是否已 set_src（按槽位） */
  protected _random_mark_visible: boolean[] = []
  protected _random_src_done: boolean[] = []

  /** 生存排行列表不使用 Flex：把 100 行按固定行距一次性排好（ScrollView 只整体平移列表） */
  protected layout_rank_rows(): void {
    const list = this.node.search_node("survival_rank_list")
    if (!list) return
    let y = 0
    for (const row of list.children) {
      row.move_to(0, y, 0)
      y += RANK_ROW_H + RANK_ROW_GAP
    }
  }

  /** 生存排行准备页：左侧选角、右侧展示排行榜（外部未注入数据能力时隐藏） */
  protected refresh_survival_rank(): void {
    if (this.props.game_mode !== GAME_MODE_SURVIVAL) return
    this.layout_rank_rows()
    const title = this.node.search_node("survival_rank_title")
    const tabs = this.node.search_node("rank_period_tabs")
    const refresh = this.node.search_node("survival_rank_refresh")
    const scroll = this.node.search_node("survival_rank_scroll")
    const list = this.node.search_node("survival_rank_list")
    const my_node = this.node.search_node("survival_rank_my")
    if (!title && !scroll && !list) return
    const available = this.lfw.survival_rank_available
    title?.set_visible(available)
    tabs?.set_visible(available)
    refresh?.set_visible(available)
    scroll?.set_visible(available)
    my_node?.set_visible(available)
    this._rank_board_shown = available
    if (!available) {
      this.clear_rank_rows()
      this.node.search_node("rank_sel_underline")?.set_visible(false)
      return
    }
    this.update_rank_period_tabs()
    // 用外部最近一次下发的数据渲染（尚未下发时隐藏全部行）
    if (this._rank_loaded) this.render_rank_rows_text()
    else this.clear_rank_rows()
    // 请求外部(宿主 App)按当前周期拉取最新数据；数据到达后经 on_survival_rank_changed 更新本页
    this.lfw.survival_rank_period = this.rank_period
    this.lfw.survival_rank_2p = this.player_count >= 2
    this.lfw.broadcast(BROADCAST_RANK_REQUEST)
  }

  /**
   * 用最近一次榜单数据 + 当前语言重绘榜单行/空榜文案/我的排名（含偶数行底色）。
   * 语言切换时由 on_lang_changed 调用：不重新拉取、不改滚动。
   */
  protected render_rank_rows_text(): void {
    const list = this.node.search_node("survival_rank_list")
    const my_node = this.node.search_node("survival_rank_my")
    if (!list || !this._rank_loaded || !this._rank_board_shown) return
    const rows = [...list.children]
    const entries = this._rank_entries
    const empty = entries.length === 0
    const shown = empty ? 1 : entries.length
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const visible = i < shown
      row.set_visible(visible)
      // 偶数行（i 为 0 基 → 排名 i+1 为偶数）加极淡白底
      row.color = (i & 1) ? RANK_ROW_EVEN_BG : ''
      if (!visible) continue
      const cells = row.children
      const cell = (idx: number) => cells[idx]
      if (empty) {
        for (let c = 0; c < cells.length; c++) cell(c)?.set_text("", cell(c)?.text?.style)
        cell(1)?.set_text(this.lfw.string('survival.board_empty'), cell(1)?.text?.style)
        continue
      }
      const v = entries[i]!
      cell(0)?.set_text(`${v.rank}.`, cell(0)?.text?.style)
      cell(1)?.set_text([v.nickname, v.player2].filter(Boolean).join(' & '), cell(1)?.text?.style)
      const fighters = [v.fighter, v.fighter2]
        .filter((x): x is string => !!x)
        .map(x => this.lfw.string(x))
        .filter(Boolean)
      cell(2)?.set_text(fighters.join(' & '), cell(2)?.text?.style)
      cell(3)?.set_text(
        i18n_fmt(this.lfw.string('survival.floor_reached'), v.score),
        cell(3)?.text?.style,
      )
    }
    if (my_node) {
      my_node.set_visible(true)
      my_node.set_text(
        this._rank_mine
          ? i18n_fmt(
            this.lfw.string('survival.my_rank_ranked'),
            this._rank_mine.rank,
            i18n_fmt(this.lfw.string('survival.floor_reached'), this._rank_mine.score),
          )
          : this.lfw.string('survival.my_rank_unranked'),
        my_node.text?.style,
      )
    }
  }

  /** 隐藏所有榜单行与“我的排名” */
  protected clear_rank_rows(): void {
    const list = this.node.search_node("survival_rank_list")
    if (list) for (const row of list.children) row.set_visible(false)
    this.node.search_node("survival_rank_my")?.set_visible(false)
  }

  /** 四个周期标签：全榜/月榜/周榜/日榜；选中项高亮，未选中半透明 */
  protected update_rank_period_tabs(): void {
    const under = this.node.search_node("rank_sel_underline")
    let any_selected = false
    for (const p of RANK_PERIODS) {
      const node = this.node.search_node(`survival_rank_period_${p}`)
      if (!node) continue
      const selected = p === this.rank_period
      const style = node.style
      style.fill_style = selected ? '#ffffff' : '#9b9bff'
      const txt = this.lfw.string(`survival.rank_period_${p}`)
      node.set_text(txt, style)
      node.set_opacity(selected ? 1 : 0.5)
      if (!selected) continue
      any_selected = true
      if (under) {
        const g = node.geo
        const w = Math.max((g.right - g.left) || 8, 8)
        under.size.set(w, 2, 0)
        under.move_to_global((g.left + g.right) / 2 - w / 2, g.bottom + 2, 0)
      }
    }
    under?.set_visible(any_selected)
  }

  /** 直接切换到指定周期标签 */
  protected set_survival_rank_period(p: RankPeriod): void {
    if (this.rank_period === p) return
    this.rank_period = p
    this.refresh_survival_rank()
  }

  /** B站生存排行：把 world dataset 重置为默认值（保留难度选择） */
  protected reset_world_dataset(): void {
    const ds = this.world.dataset
    const difficulty = ds.difficulty
    Object.assign(ds, new WorldDataset().dump_dataset())
    ds.difficulty = difficulty
    ds.playrate = 1
  }

  /** 单人固定设置模式（生存排行）：角色就绪倒计时结束后直接开始，不弹设置菜单 */
  get auto_start_when_ready(): boolean {
    return this.props.game_mode === GAME_MODE_SURVIVAL
  }

  protected _lf2_callbacks: ILFWCallback = {
    // 语言切换：纯词条节点由 LFW.set_lang 自动刷新；这里补刷拼合的榜单文字
    on_lang_changed: () => this.render_rank_rows_text(),
    on_broadcast: (message) => {
      if (message === 'start_game') return this.start_game();
      if (message === 'rank_refresh') return this.refresh_survival_rank();
      if (message.startsWith('rank_period_set_')) {
        const p = message.substring('rank_period_set_'.length) as RankPeriod
        if ((RANK_PERIODS as readonly string[]).includes(p))
          return this.set_survival_rank_period(p)
      }
    },
    on_survival_rank_changed: (data) => {
      if (this.props.game_mode !== GAME_MODE_SURVIVAL) return
      if (!data) {
        this._rank_entries = []
        this._rank_mine = null
        this._rank_loaded = false
        this.clear_rank_rows()
        return
      }
      this._rank_entries = data.list.slice(0, RANK_LIMIT)
      this._rank_mine = data.mine
      this._rank_loaded = true
      this.render_rank_rows_text()
      this.node.search_node("survival_rank_scroll")?.find_component(ScrollView)?.scroll_to_start()
    }
  }
  override on_stop(): void {
    this.lfw.change_stage('')
    this.lfw.change_bg('')
    this.lfw.callbacks.del(this._lf2_callbacks)
  }
  start_game() {
    const char_menu_logic = this.node.search_component(CharMenuLogic)
    if (!char_menu_logic) return;
    // 战斗数据包可能尚未加载完(随机池为空)：此时不换场景，避免进到空场地
    for (const [, slot_info] of char_menu_logic.players) {
      if (slot_info.fighter) continue;
      Ditto.warn(`[${GamePrepareLogic.TAG}::start_game] fighter data missing, start canceled`);
      return;
    }

    const { bg_switcher, stage_switcher } = this.props
    const is_survival_rank = this.props.game_mode === GAME_MODE_SURVIVAL
    if (is_survival_rank) this.reset_world_dataset()
    const survival_stage = is_survival_rank
      ? (this.lfw.datas.stages.find(v => v.chapter === 'survival' && v.is_starting)
        ?? this.lfw.datas.stages.find(v => v.id === '50'))
      : undefined
    if (survival_stage) {
      const bdt = this.lfw.datas.backgrounds.find(v => v.id === survival_stage.bg)
      this.lfw.change_bg(bdt?.id ?? '')
    } else if (stage_switcher?.node.visible && !stage_switcher.node.disabled)
      this.lfw.change_bg(stage_switcher.stage.bg ?? "");
    else if (bg_switcher?.node.visible && !bg_switcher.node.disabled)
      this.lfw.change_bg(bg_switcher.background.id);

    const { far, near, left, right } = this.lfw.world.bg;
    const is_stage_mode = this.props.game_mode === GAME_MODE_STAGE || is_survival_rank
    const is_vs_mode = this.props.game_mode === GAME_MODE_VS

    this.lfw.survival_rank_mode = false
    this.lfw.mt.mark = 'gpl_start_game_cam_x';
    let cam_x = is_stage_mode ? 0 : this.lfw.mt.range(left, right - Defines.MODERN_SCREEN_WIDTH)

    for (const [player, slot_info] of char_menu_logic.players) {
      const { fighter: fighter_data } = slot_info;
      if (!fighter_data) {
        Ditto.warn(`[${GamePrepareLogic.TAG}::start_game] failed to create fighter. figher data: ${fighter_data}`);
        debugger;
        continue;
      }
      const fighter = this.lfw.factory.create_entity(this.world, fighter_data)
      if (!fighter) {
        Ditto.warn(`[${GamePrepareLogic.TAG}::start_game] failed to create fighter. figher data: ${fighter_data}`);
        debugger;
        continue;
      }
      fighter.team = slot_info.team || this.lfw.new_team;
      fighter.stat_bar_type = StatBarType.None;
      fighter.facing = is_stage_mode ?
        FacingFlag.Right :
        this.lfw.mt.pick([FacingFlag.Left, FacingFlag.Right])!;
      if (player.is_com) {
        fighter.ctrl = this.lfw.factory.create_ctrl(fighter_data.id, player.id, fighter);
      } else {
        fighter.ctrl = new LocalController(player.id, fighter);
      }
      const xx1 = is_stage_mode ? 40 : 1 * Defines.MODERN_SCREEN_WIDTH / 3;
      const xx2 = is_stage_mode ? 80 : 2 * Defines.MODERN_SCREEN_WIDTH / 3;

      this.lfw.mt.mark = 'gpl_fighter_x';
      const x = this.lfw.mt.range(xx1, xx2) + cam_x;
      this.lfw.mt.mark = 'gpl_fighter_z';
      const z = this.lfw.mt.range(far, near)
      const seg = this.world.ground.segment(x, z)
      const y = this.world.ground.y(seg, x, z);
      fighter.set_position(x, y, z);
      fighter.blinking = this.world.dataset.begin_blink_time;
      fighter.invulnerable = this.world.dataset.begin_blink_time;
      if (is_vs_mode) fighter.mp = (fighter.mp_max * 2 / 5)
      fighter.attach();
    }

    if (is_survival_rank) {
      this.lfw.change_stage(survival_stage?.id ?? '50');
      this.lfw.survival_rank_mode = true;
      this.node.layer?.push({ id: "stage_mode_page" });
    } else if (is_stage_mode) {
      if (stage_switcher)
        this.lfw.change_stage(stage_switcher.stage.id ?? "");
      this.node.layer?.push({ id: "stage_mode_page" });
    } else {
      this.node.layer?.push({ id: "vs_mode_page" });
    }
    this.world.camera.jump_x(cam_x);
  }
}

