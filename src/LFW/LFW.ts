import { Callbacks } from './base/Callbacks';
import { make_debugging, type IDebugging } from "./base/Debugging";
import { get_short_file_size_txt } from './base/get_short_file_size_txt';
import { Graves } from "./base/Graves";
import { regist_buffs } from './buff/_';
import type { Collision } from './collision/Collision';
import type { IDataInfo } from './defines';
import * as D from "./defines";
import { CMD, CMD_NAMES } from "./defines/CMD";
import { AGK } from './defines/GameKey';
import type { IGameZipInfo } from "./defines/IFullGameZipInfo";
import * as I from "./ditto";
import { Entity } from './entity/Entity';
import { is_ball_data, is_entity_data, is_fighter, is_fighter_data, is_weapon_data } from './entity/type_check';
import { Factory } from "./Factory";
import * as Helper from "./helper";
import { I18N } from "./I18N";
import type { ILFWCallback } from "./ILFWCallback";
import { Keys } from "./Keys";
import { DatMgr } from "./loader/DatMgr";
import { PlayerInfo } from "./PlayerInfo";
import { Resources } from "./Resources";
import * as UI from "./ui";
import { regist_components } from './ui/component/_';
import { loop_offset } from './utils/container_help/loop_offset';
import { MersenneTwister } from './utils/math/MersenneTwister';
import { is_str } from './utils/type_check/is_str';
import { World } from "./World";
import { ZipMgr, type ILoadedZip } from "./ZipMgr";

/** 生存排行周期 */
export type SurvivalRankPeriod = 'all' | 'month' | 'week' | 'day'

/** 生存排行榜单条目（轻量，仅展示用） */
export interface SurvivalRankItem {
  rank: number
  score: number
  nickname: string
  /** 使用角色（B站榜单不提供；自有服务存于 extra.fighter） */
  fighter?: string
  player?: string
  /** 双人榜：玩家二的角色/名字（extra.fighter2 / extra.player2） */
  fighter2?: string
  player2?: string
}

/** 我的生存排行成绩（未上榜为 null） */
export interface SurvivalRankMy {
  rank: number
  score: number
}

/** 外部(宿主 App)一次下发的生存排行数据（UI 按此渲染，值变化时更新） */
export interface SurvivalRankBoardData {
  period: SurvivalRankPeriod
  list: SurvivalRankItem[]
  mine: SurvivalRankMy | null
}

const DEFAULT_INFO: Readonly<IGameZipInfo> = {
  type: "FULL",
  version: 0,
  title: "Little Fighter Wemake Origin Full Game",
  description: "Little Fighter Wemake Origin Full Game Zip",
  author: "Gim",
  paths: ["prel.zip.json", "data.zip.json"],
}
export class LFW implements I.IKeyboardCallback, IDebugging {
  static readonly TAG = "LFW";
  static readonly instances: LFW[] = []
  static VERSION_NAME: string = `v0.0.0`;
  static readonly DATA_VERSION: number = D.Defines.DATA_VERSION;
  static readonly DATA_TYPE: string = 'DataZip';
  private static _INFO: Readonly<IGameZipInfo> = DEFAULT_INFO;
  private static _ZIPS: (I.IZip | string)[] = [...DEFAULT_INFO.paths];
  static get IS_DEFAULT_INFO() { return this._INFO == DEFAULT_INFO; }
  static get INFO(): Readonly<IGameZipInfo> { return this._INFO }
  static set INFO(v: Readonly<IGameZipInfo> | null | undefined) {
    // NOTE: is it stupid? - Gim
    const next = v ?? DEFAULT_INFO;
    if (next == this._INFO) return;
    this._INFO = next;
    this._ZIPS = this._INFO.paths;
  }

  static get ZIPS() { return this._ZIPS }
  static set ZIPS(v: (I.IZip | string)[]) {
    this._ZIPS = v;
    this.instances.forEach(v => v.update_zip_names())
  }
  static get instance() { return LFW.instances[0] }
  static get world() { return this.instance?.world }
  static get objects() { return this.instance?.objects }
  static get entities() { return this.instance?.entities }
  static get fighters() { return this.instance?.fighters }
  static get weapons() { return this.instance?.weapons }
  static get balls() { return this.instance?.balls }
  static get bg() { return this.world?.bg }
  static get stage() { return this.world?.stage }
  static get phase() { return this.stage?.phase }

  static get ui() { return this.instance.ui }
  static get ditto() { return I.Ditto }
  static get uis() { return this.instance.uis }
  static get DATA_INFOS() { return this.instance.zips.data_infos; }

  /**
   * 收集本客户端完整的数据包信息（已加载 + 即将加载）
   *
   * 已加载的取自 `data_infos`；尚未加载但声明在 `LFW.ZIPS` 中的数据包，
   * 读取其 info json 以获取 MD5 等元数据。
   * 用于联机时校验双方将要使用的完整数据集合是否一致。
   *
   * @returns {Promise<D.IDataInfo[]>}
   */
  static async collect_data_infos(): Promise<D.IDataInfo[]> {
    const inst = LFW.instance;
    if (!inst) return [];
    const loaded = inst.zips.data_infos;
    const loaded_md5s = new Set(loaded.map(v => v?.md5));
    const ret: D.IDataInfo[] = [...loaded];
    for (const a of LFW.ZIPS) {
      if (!is_str(a)) continue; // IZip 对象已包含在 loaded 中
      let info: D.IDataInfo;
      try {
        const [raw] = await I.Ditto.Importer.import_as_json<Record<string, unknown>>([no_cache_url(a)]);
        info = pick_data_info(raw);
      } catch (e) {
        I.Ditto.warn(`[LFW::collect_data_infos] 读取数据包信息失败: ${a}`, e)
        continue;
      }
      if (info.md5 && !loaded_md5s.has(info.md5)) ret.push(info);
    }
    return ret;
  }
  static IgnoreDisposed(e: any) {
    I.Ditto.warn(e);
    if (e.is_disposed_error === true) return;
    throw e;
  }


  get lang(): string { return this._i18n.lang }
  set lang(v: string) { this.set_lang(v) }

  /**
   * 把语言码（可为地区码/别名，如 'zh-cn'、'en-us'）解析成规范码
   * （'zh-hans' / 'zh-hant' / '' 等，沿别名表解析到无别名为止）。
   */
  canonical_lang(lang: string = this.lang): string {
    return this._i18n.canonical(lang);
  }

  set_lang(lang: string): void {
    if (!is_str(lang)) {
      this.warn('set_lang', `lang should be string, but got ${lang}`)
      return;
    }
    const prev = this._i18n.lang;
    if (prev === lang) return;

    const recs: { node: UI.UINode, key: string, resolved: boolean }[] = [];
    const collect = (node: UI.UINode): void => {
      const txt = node.text;
      if (txt?.text && typeof txt.text === 'string') {
        const t = txt.text;
        const translated = this._i18n.string(t, prev);
        if (translated !== t) {
          recs.push({ node, key: t, resolved: false });
        } else {
          const key = node.data.i18n;
          if (key && t === this._i18n.string(key, prev))
            recs.push({ node, key, resolved: true });
        }
      }
      for (const child of node.children) collect(child);
    };
    for (const layer of this.layers.all)
      for (const ui of layer.pages)
        collect(ui);

    this._i18n.lang = lang;

    for (const { node, key, resolved } of recs) {
      if (resolved) {
        const style = node.text?.style;
        node.text = this.images.measure_text(this.string(key), style);
      } else {
        node.set_text(key, node.text?.style);
      }
    }

    this.callbacks.call('on_lang_changed', lang, prev, this);
  }
  dev: boolean = false;
  __debugging = false
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  debug(..._1: any[]): void { };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  warn(..._1: any[]): void { };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  log(..._1: any[]): void { };

  readonly callbacks = new Callbacks<ILFWCallback>();
  readonly factory: Factory = new Factory();
  readonly bgms: string[] = []
  readonly layers: UI.UILayers;

  /** @deprecated 使用 `layers` */
  get ui_stacks(): UI.UILayers { return this.layers }

  protected __id = 100;
  protected __team = Number(D.TeamEnum.Max);
  protected _disposed: boolean = false;
  protected _loading: boolean = false;
  protected _playable: boolean = false;
  protected _mt = new MersenneTwister(Date.now())
  protected _ui_loaded = false;
  protected _i18n = new I18N();
  protected _strings = new Map<string, { [x in string]?: string }>()
  protected _strings_list = new Map<string, { [x in string]?: string[] }>();
  protected _cheat_keys = ''
  protected _cheat_gkeys = new Map<string, string>()
  protected _cheat_gkeys_matchs = new Set<string>()
  protected _keys_graves: Graves<Keys> = new Graves();
  protected _collision_graves: Graves<Collision> = new Graves();

  first_page: string = 'init';
  readonly _keys: Keys[] = [];

  /** 是否运行在 B站 Toy 容器环境（由外部 App 注入；主菜单“生存排行”入口仅在此环境显示） */
  toy_env: boolean = false;
  danmu_available: boolean = false;
  /** B站生存排行模式：开启时每进入一个新的 Survival 阶段触发 on_survival_rank_phase */
  survival_rank_mode: boolean = false;
  /** 每进入一个 Survival 阶段时回调（phase_reached = 当前阶段编号，从 0 起） */
  on_survival_rank_phase?: (phase_reached: number) => void;
  /** 外部(宿主 App)是否注入了生存排行数据能力（未注入表示不可用/不显示） */
  survival_rank_available: boolean = false;
  /** 当前准备页是否为双人生存排行（榜单/榜位与单人分开） */
  survival_rank_2p: boolean = false;
  /** 当前展示的排行周期（准备页切标签时更新；外部按此周期拉取） */
  survival_rank_period: SurvivalRankPeriod = 'all';
  /** 外部最近一次下发的生存排行数据（未下发为 undefined） */
  survival_rank_data?: SurvivalRankBoardData | null;
  /** 外部(宿主 App)下发最新排行数据；值变化时通知 on_survival_rank_changed（UI 据此更新） */
  set_survival_rank_data(data: SurvivalRankBoardData | null): void {
    this.survival_rank_data = data;
    this.callbacks.call('on_survival_rank_changed', data, this);
  }
  /** B站生存排行：是否使用了秘籍（任一 cheat code） */
  get survival_rank_cheated(): boolean {
    return (
      this.is_cheat(D.CheatEnum.LF2_NET) ||
      this.is_cheat(D.CheatEnum.HERO_FT) ||
      this.is_cheat(D.CheatEnum.GIM_INK)
    )
  }
  /** B站生存排行：是否添加了额外模组（基础数据包只有 2 个） */
  get survival_rank_modded(): boolean {
    return LFW.ZIPS.length > 2
  }
  /** B站生存排行：本局是否因“使用秘籍/额外模组”而不会被计入排行榜 */
  get survival_rank_invalid(): boolean {
    return this.survival_rank_cheated || this.survival_rank_modded
  }

  cmds: string[] = [];
  events: UI.LFWKeyEvent[] = [];
  broadcasts: string[] = [];
  push_cmd(...words: string[]) {
    this.cmds.push(words.join(' '));
    return this;
  }
  get loading(): boolean {
    return this._loading;
  }
  get playable(): boolean {
    return this._playable;
  }
  get need_load(): boolean {
    return !this._playable && !this._loading;
  }
  get ui(): UI.UINode | undefined {
    return this.layers.ui;
  }
  get mt(): MersenneTwister {
    return this._mt
  }
  get ui_loaded(): boolean {
    return this._ui_loaded;
  }
  get new_id() { return `${++this.__id}` }

  get new_team() { return `team_${++this.__team}` }

  readonly world: World;
  readonly players: Map<string, PlayerInfo> = new Map([
    ["1", new PlayerInfo("1")],
    ["2", new PlayerInfo("2")],
    ["3", new PlayerInfo("3")],
    ["4", new PlayerInfo("4")],
    ["5", new PlayerInfo("5")],
    ["6", new PlayerInfo("6")],
    ["7", new PlayerInfo("7")],
    ["8", new PlayerInfo("8")],
  ]);
  readonly fighters = new Helper.CharactersHelper(this);
  readonly weapons = new Helper.WeaponsHelper(this);
  readonly entities = new Helper.ObjectsHelper(this);
  readonly objects = new Helper.ObjectsHelper(this);
  readonly balls = new Helper.BallsHelper(this);
  readonly uis = new Helper.UIHelper(this)
  readonly zips = new ZipMgr();
  readonly datas: DatMgr;
  readonly resources: Resources;
  readonly sounds: I.ISounds;
  readonly images: I.IImageMgr;
  readonly keyboard: I.IKeyboard;
  readonly pointings: I.IPointings;

  reset_new_team() {
    this.__team = Number(D.TeamEnum.Max);
    return this;
  }

  reset_new_id() {
    this.__id = 100;
    return this;
  }
  /**
   * 获取玩家信息
   * 
   * 当玩家信息不存在，创建之
   * 
   * @param {string} player_id 玩家ID 
   * @returns {PlayerInfo} 玩家信息
   */
  player(player_id: string): PlayerInfo {
    let ret = this.players.get(player_id)
    if (!ret) this.players.set(player_id, ret = new PlayerInfo(player_id))
    return ret
  }

  constructor(dev = false) {
    regist_components()
    regist_buffs();
    this.dev = dev;
    make_debugging(this)
    this.debug(`constructor`)
    this.resources = new Resources(this.zips)
    this.datas = new DatMgr(this);
    this.sounds = new I.Ditto.Sounds(this);
    this.images = new I.Ditto.ImageMgr(this);
    this.keyboard = new I.Ditto.Keyboard(this);
    this.keyboard.callback.add(this);
    this.pointings = new I.Ditto.Pointings();
    I.Ditto.Cache.forget(LFW.DATA_TYPE, LFW.DATA_VERSION).catch(e => {
      I.Ditto.warn(e)
    })
    I.Ditto.Cache.forget(PlayerInfo.DATA_TYPE, PlayerInfo.DATA_VERSION).catch(e => {
      I.Ditto.warn(e)
    })
    I.Ditto.Zip.forget_stored(LFW.DATA_TYPE, LFW.DATA_VERSION).catch(e => {
      I.Ditto.warn(e)
    })
    this.world = new World(this);
    this.world.start_update();
    this.world.start_render();
    LFW.instances.push(this)
    this.pointings.callback.add(new I.Ditto.UIInputHandle(this));

    this.layers = new UI.UILayers(this);
    this.layers.push().callback.add({
      on_set: (curr, prev) => this.callbacks.call("on_ui_changed", curr, prev),
      on_push: (curr, prev) => this.callbacks.call("on_ui_changed", curr, prev),
      on_pop: (curr, poppeds) => this.callbacks.call("on_ui_changed", curr, poppeds[0]),
    })

    this._i18n.add({
      '': {
        VERSION_NAME: LFW.VERSION_NAME,
        DATA_LIST: '',
      }
    })
    this.update_zip_names()
  }

  random_entity_info(e: Entity) {
    const { left: l, right: r, near: n, far: f } = this.world;
    e.id = this.new_id;
    e.facing = this.mt.range(0, 100) % 2 ? -1 : 1;
    e.position.set(
      this.mt.range(l, r),
      550,
      this.mt.range(f, n),
    )
    return e;
  }

  is_cheat(name: string | D.CheatEnum): boolean {
    if (!D.is_cheat_type(name)) return false;
    return !!this.world.dataset[name];
  }

  set_cheat(name: string | D.CheatEnum, enable: boolean = !this.is_cheat(name)) {
    if (enable == this.is_cheat(name)) return;
    this.push_cmd(name, enable ? '1' : '');
    this._cheat_keys = "";
    this._cheat_gkeys.clear();
  }

  on_key_down(e: I.IKeyEvent) {
    this.debug('on_key_down', e)
    const key_code = e.key.toLowerCase();
    if (key_code in CMD_NAMES) {
      this.push_cmd(key_code as CMD);
      e.interrupt();
    }

    if (e.times === 0) {
      for (const key_name of AGK) {
        for (const [pid, player] of this.players) {
          if (!player.local) continue;
          if (player.keys[key_name] !== key_code) continue;
          if (e.device_type == 'controller') this.callbacks.call('controller_detected', player)
          if (e.device_type == 'keyboard') this.callbacks.call('keyboard_detected', player)
          this._cheat_gkeys.set(pid, (this._cheat_gkeys.get(pid) || '') + key_name)
          this.events.push(new UI.LFWKeyEvent(pid, true, key_name, key_code));
        }
      }
    }

    let match = false;
    this._cheat_gkeys_matchs.clear()
    this._cheat_keys += key_code;
    for (const [cheat_name, { keys: k, gkeys: g }] of D.Defines.CheatInfos) {
      for (const [pid, gkeys] of this._cheat_gkeys) {
        if (g.startsWith(gkeys)) this._cheat_gkeys_matchs.add(pid);
        if (g === gkeys) this.set_cheat(cheat_name)
      }
      if (k.startsWith(this._cheat_keys)) match = true;
      if (k === this._cheat_keys) this.set_cheat(cheat_name)
    }
    for (const [k] of this._cheat_gkeys)
      if (!this._cheat_gkeys_matchs.has(k))
        this._cheat_gkeys.delete(k)
    if (!match) this._cheat_keys = "";
  }

  on_key_up(e: I.IKeyEvent) {
    const key_code = e.key?.toLowerCase() ?? "";
    for (const key_name of AGK) {
      for (const [pid, player] of this.players) {
        if (!player.local) continue;
        if (player.keys[key_name] !== key_code) continue
        this.events.push(new UI.LFWKeyEvent(pid, false, key_name, key_code))
      }
    }
  }

  private on_loading_file(url: string, progress: number, full_size: number) {
    const txt = `${url}(${get_short_file_size_txt(full_size)})`;
    this.emit_progress(txt, progress);
  }

  protected async _load_zip_from_url(info_url: string): Promise<ILoadedZip> {
    const check = this.dispose_guard('load_zip_from_url');
    this.emit_progress(`${info_url}`, 0);
    const [raw] = await I.Ditto.Importer.import_as_json<Record<string, unknown>>([no_cache_url(info_url)]);
    check()

    const info = pick_data_info(raw);
    if (!info.url)
      throw new Error(`[LFW::load_zip_from_url] info json url got: ${info_url}`);

    let zip: I.IZip | null = null;

    const { url, md5 } = info;
    // zip 地址附加内容标识：内容变 → URL 变（CDN 边缘缓存必然回源）；内容不变 → URL 稳定（本地缓存复用）
    const zip_url = zip_content_url(full_zip_url(info_url, url), md5)

    if (md5) {
      const stored = await I.Ditto.Zip.get_stored(zip_url, md5);
      check()
      if (stored) {
        zip = await I.Ditto.Zip.read_blob(md5, stored, md5);
        check()
      }
    }

    if (!zip) {
      const exists = md5 ? await I.Ditto.Cache.get(md5) : undefined;
      if (exists) check()

      if (exists?.data) {
        zip = await I.Ditto.Zip.read_buf(exists.name, exists.data);
        check()
      } else if (exists?.blob) {
        zip = await I.Ditto.Zip.read_blob(exists.name, exists.blob, md5);
        check()
      }
    }

    if (!zip) {
      const downloaded = await I.Ditto.Zip.download(zip_url, (progress, full_size) =>
        this.on_loading_file(zip_url, progress, full_size), {
        md5,
        aborted: () => this._disposed,
        type: LFW.DATA_TYPE,
        version: LFW.DATA_VERSION,
      });
      check()

      await I.Ditto.Cache.del(info_url, "");
      check()

      if (downloaded.stored) {
        zip = await I.Ditto.Zip.read_blob(md5 ?? zip_url, downloaded.blob, downloaded.md5);
      } else if (md5) {
        await I.Ditto.Cache.put({
          name: md5,
          version: LFW.DATA_VERSION,
          type: LFW.DATA_TYPE,
          blob: downloaded.blob,
          data: null,
        });
        check()

        const cached = await I.Ditto.Cache.get(md5);
        zip = cached?.blob
          ? await I.Ditto.Zip.read_blob(cached.name, cached.blob, md5)
          : await I.Ditto.Zip.read_blob(md5, downloaded.blob, downloaded.md5);
      } else {
        zip = await I.Ditto.Zip.read_blob(zip_url, downloaded.blob, downloaded.md5);
      }
      check()
    }

    this.emit_progress(`${url}`, 100);
    return { zip, info };
  }

  private async _load_zip_from_object(zip: I.IZip): Promise<ILoadedZip> {
    const check = this.dispose_guard('_load_zip_from_object');
    const info = await this._pick_zip_info(zip)
    check();

    return { zip, info }
  }

  private async _pick_zip_info(zip: I.IZip): Promise<IDataInfo> {
    let raw: Record<string, unknown> | undefined;
    for (const name of ['__info.json', '__info.json5']) {
      const file = zip.file(name)
      if (!file) continue;
      const v = await file.json().catch(() => undefined);
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        raw = v as Record<string, unknown>;
        break;
      }
    }
    const picked = raw ? pick_data_info(raw) : {};
    return {
      type: picked.type ?? LFW.INFO?.type,
      url: picked.url,
      title: picked.title ?? LFW.INFO?.title ?? zip.name,
      description: picked.description ?? LFW.INFO?.description,
      author: picked.author ?? LFW.INFO?.author,
      version: picked.version ?? LFW.INFO?.version,
      time: picked.time,
      md5: zip.md5,
    };
  }

  /**
   * 加载游戏资源包
   *
   * 依次加载每个 zip（本地文件或远程 URL），对每个 zip：
   * 1. 加载字符串表（strings.json / strings.json5）
   * 2. 加载数据索引并注册 fighter / weapon / ball 快捷方法
   * 3. 加载 UI
   *
   * 首次调用（`zips.length === 0`）时：
   * - 加载内置字符串和内置 UI
   * - 加载完成后触发 `on_prel_loaded`
   *
   * @param arg1 - 资源包路径或 IZip 实例列表
   * @returns 加载完成或失败（失败时 reject）
   *
   * @emits on_loading_start - 加载开始
   * @emits on_prel_loaded  - 首次加载完成（仅首次）
   * @emits on_loading_end   - 所有资源加载完成
   * @emits on_loading_failed - 任一步骤失败
   */
  async load(...arg1: (I.IZip | string)[]): Promise<void> {
    const is_first = this.zips.length === 0;
    const check = this.dispose_guard('load');
    this._loading = true;
    this.callbacks.call("on_loading_start");
    if (is_first) {
      const { data } = await this.resources.import_json("builtin_data/launch/strings.json")
      check()
      this._i18n.add(data)

      await this.load_builtin_ui()
      check()
      const ui = this.uis.all.find(v => v.id === this.first_page)
      this.layers.set_page({ id: ui?.id }, 0)
    }

    try {
      for (const a of arg1) {
        const zip = is_str(a) ?
          await this._load_zip_from_url(a) :
          await this._load_zip_from_object(a)
        check()

        await this.load_data(zip);
        check()
      }
      if (is_first) this.callbacks.call("on_prel_loaded", this);
      this._playable = true;
      this.callbacks.call("on_loading_end");
    } catch (e) {
      if (this._disposed) check()
      this.callbacks.call("on_loading_failed", e);
      return await Promise.reject(e);
    } finally {
      this._loading = false;
    }
  }

  private dispose_guard = (fn: string) => {
    const ret = () => {
      if (!this._disposed) return;
      const error = Object.assign(
        new Error(`[${LFW.TAG}::${fn}] instance disposed.`),
        { is_disposed_error: true }
      )
      throw error;
    }
    ret();
    return ret;
  }

  private async load_data({ zip, info }: ILoadedZip) {
    const check = this.dispose_guard('load_data');

    let r = await zip.file("strings.json")?.json();
    if (r) this._i18n.add(r)

    check()
    r = await zip.file("strings.json5")?.json()
    if (r) this._i18n.add(r)

    check()
    const i18n_files = zip.file(/\.(i18n|strings)\.json5?$/)
    for (const file of i18n_files) {
      const i18n_words = await file.json().catch(() => null);
      check()
      if (i18n_words) this._i18n.add(i18n_words)
    }

    check()
    this.zips.add({ zip, info });
    this.callbacks.call("on_zips_changed", this.zips.zips);

    const index_files = zip.file(/\.index\.(json5|xml)$/).map(v => v.name)
    const is_base_index = (v: string) => /(^|\/)data\/data\.index\./i.test(v)
    await this.datas.load([
      ...index_files.filter(is_base_index),
      ...index_files.filter((v) => !is_base_index(v)),
    ]);

    check()
    const regist = (helper: any, d: D.IEntityData) => {
      const name = d.base.name?.toLowerCase() ?? d.type + "_id_" + d.id;
      Object.defineProperty(helper, `add_${name}`, {
        configurable: true, enumerable: false, writable: true,
        value: (num?: number, team?: string) => helper.add(d, num, team),
      });
    }

    for (const d of this.datas.objects) {
      if (is_fighter_data(d)) regist(this.fighters, d);
      if (is_ball_data(d)) regist(this.balls, d);
      if (is_weapon_data(d)) regist(this.weapons, d);
      if (is_entity_data(d)) regist(this.entities, d);
      regist(this.objects, d);
    }

    const bgms = zip.file(/bgm\/.*?\.mp3$/)
    for (const bgm of bgms) {
      if (!this.bgms.some(v => v === bgm.name)) {
        this.bgms.push(bgm.name)
      }
    }
    await this.load_ui(zip);
  }

  dispose() {
    this.debug('dispose')
    this._disposed = true;
    this.callbacks.call("on_dispose");
    this.callbacks.clear()
    this.world.dispose();
    this.datas.dispose();
    this.sounds.dispose();
    this.keyboard.dispose();
    this.pointings.dispose();
    this.layers.dispose()
    const i = LFW.instances.indexOf(this);
    if (i >= 0) LFW.instances.splice(i, 1);
  }

  change_bg(bg: string): void {
    this.world.change_bg(bg);
  }

  change_stage(stage: string): void {
    this.world.change_stage(stage);
  }

  goto_next_stage() {
    this.debug(`goto_next_stage`)
    const next = this.world.stage.data.next;
    if (!next) return;
    if (next === 'end') {
      this.layers.set_page({ id: "ending_page" }, 0)
      return;
    }
    const next_stage = this.datas.stages?.find((v) => v.id === next);
    if (!next_stage) {
      this.world.stage.stop_bgm();
      this.sounds.play_with_load(D.Defines.Sounds.StagePass);
      this.callbacks.call("on_stage_pass");
    }
    if (next_stage?.is_starting) {
      for (const e of this.world.entities) {
        if (is_fighter(e) && this.players.has(e.ctrl.player_id)) continue;
        e.release();
      }
    }
    const time = this.world.stage.time;
    this.change_stage(next_stage?.id || '');
    this.world.stage.time = time;
    this.callbacks.call("on_enter_next_stage");
  }

  string(name: string): string { return this._i18n.string(name) }
  strings(name: string): string[] { return this._i18n.strings(name) }

  protected async load_builtin_ui(): Promise<UI.ICookedUIInfo[]> {
    const check = this.dispose_guard('load_builtin_ui');
    const { data: paths } = await this.resources.import_json<string[]>("builtin_data/launch/_index.json")
    const ret: UI.ICookedUIInfo[] = []
    for (const path of paths) {
      const cooked_ui_info = await UI.cook_ui_info(this, path);
      check()
      ret.unshift(cooked_ui_info);
    }
    this.uis.add(...ret);
    return ret
  }

  async load_ui(zip: I.IZip): Promise<ReadonlyArray<UI.ICookedUIInfo>> {
    const check = this.dispose_guard('load_ui');
    const files = zip.file(/^ui\/.*?\.ui\.(json5?|xml)$/)
    const ret: UI.ICookedUIInfo[] = []

    for (const file of files) {
      const is_xml = file.name.endsWith('.xml');
      if (is_xml) {
        const text = await file.text().catch(() => null);
        check()
        if (!text) continue;
        const root = I.Ditto.XML.parse(text);
        if (!root) continue;
        const ui_info = UI.xml_to_ui_info(root);
        if (!ui_info || !Object.keys(ui_info).length) continue;
        const cooked_ui_info = await UI.cook_ui_info(this, ui_info);
        check()
        ret.push(cooked_ui_info);
      } else {
        const json = await file.json().catch(() => null);
        check()
        if (!json || Array.isArray(json)) continue;
        const cooked_ui_info = await UI.cook_ui_info(this, json);
        check()
        ret.push(cooked_ui_info);
      }
    }

    if (this._disposed) {
      this.uis.clear()
      return this.uis.all;
    }
    this._ui_loaded = true;
    this.uis.add(...ret)
    this.callbacks.call("on_ui_loaded", ret);
    return ret;
  }

  ui_val_getter = (item: UI.UINode, word: string) => {
    if (word === "mouse_on_me") return '' + item.pointer_over;
    if (word === "pointer_on_me") return '' + item.pointer_over;
    if (word === "paused") return this.world.paused ? 1 : 0;
    return word;
  };

  /**
   * 触发进度回调
   *
   * @param {string} content 加载内容
   * @param {number} progress 加载进度 [0~100]
   */
  emit_progress(content: string, progress: number): void {
    this.callbacks.call("on_progress", content, progress);
  }

  broadcast(message: string): void {
    this.broadcasts.push(message);
    this.callbacks.call("on_broadcast", message, this);
  }
  on_component_broadcast(component: UI.UIComponent, message: string) {
    this.callbacks.call("on_component_broadcast", component, message);
  }
  switch_difficulty(offset: number = 1): void {
    const list = [
      D.Difficulty.Easy,
      D.Difficulty.Normal,
      D.Difficulty.Difficult,
    ]
    if (this.is_cheat(D.CheatEnum.LF2_NET))
      list.push(D.Difficulty.Crazy)
    const next = loop_offset(list, this.world.dataset.difficulty, offset)
    this.push_cmd(CMD.SET_DIFFICULTY, '' + next)
  }
  private update_zip_names() {
    const DATA_LIST = LFW._ZIPS.slice(2).map(v => typeof v === 'string' ? v : v.name)
    if (!LFW.IS_DEFAULT_INFO)
      DATA_LIST.unshift(LFW.INFO?.title)
    this._i18n.add({ '': { DATA_LIST } })

    this.callbacks.call('on_extra_zips_changed', this)
  }

  create_keys(): Keys {
    const r = this._keys_graves.take() ?? new Keys(this);
    r.mount();
    return r
  }

  regist_keys(keys: Keys): void {
    const idx = this._keys.indexOf(keys);
    if (idx >= 0) return this.warn('regist_keys', `keys already registered`);
    this._keys.push(keys);
  }

  recycle_keys(keys: Keys): void {
    const idx = this._keys.indexOf(keys);
    if (idx >= 0) this._keys.splice(idx, 1);
    this._keys_graves.add(keys);
  }

  acquire_collision(): Collision | undefined {
    return this._collision_graves.take();
  }
  recycle_collision(c: Collision) {
    return this._collision_graves.add(c);
  }
}

/**
 * 从数据包 info json 中提取用于联机校验的元数据（过滤掉庞大的文件树等无用字段）
 *
 * @param {unknown} raw 数据包 info json 内容
 * @returns {D.IDataInfo}
 */
function pick_data_info(raw: unknown): D.IDataInfo {
  const v = (raw ?? {}) as Record<string, unknown>
  const str = (x: unknown): string | undefined => typeof x === 'string' ? x : void 0
  const num = (x: unknown): number | undefined => typeof x === 'number' ? x : void 0
  return {
    type: str(v.type),
    url: str(v.url),
    title: str(v.title),
    description: str(v.description),
    author: str(v.author),
    version: num(v.version),
    time: str(v.time),
    md5: str(v.md5),
  }
}

function no_cache_url(url: string) {
  return `${url}${url.includes('?') ? '&' : '?'}time=${Date.now()}`
}

function zip_content_url(zip_url: string, md5?: string) {
  if (!md5) return zip_url
  return `${zip_url}${zip_url.includes('?') ? '&' : '?'}md5=${md5}`
}

function full_zip_url(info_url: string, zip_url: string) {
  if (
    zip_url.startsWith('http://') ||
    zip_url.startsWith('https://')
  ) return zip_url
  if (
    !info_url.startsWith('http://') &&
    !info_url.startsWith('https://')
  ) return zip_url;
  const s_idx = info_url.indexOf('?');
  const h_idx = info_url.indexOf('#');
  const end = (s_idx > 0 && h_idx > 0) ? Math.min(s_idx, h_idx) : s_idx > 0 ? s_idx : h_idx;
  const part_a = end > 0 ? info_url.substring(0, end) : info_url;
  if (!part_a.endsWith('.zip.json')) return zip_url;
  const part_b = end > 0 ? info_url.substring(end) : '';
  const ttt = part_a.lastIndexOf('/')
  return part_a.substring(0, ttt) + '/' + zip_url + part_b;
}