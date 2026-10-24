import { GameMode, type LFW, type SurvivalRankItem, type SurvivalRankPeriod } from "./LFW";
import { current_connection } from "./Net/current_connection";
import {
  get_my_rank as get_my_rank_api,
  get_rank_list as get_rank_list_api,
  lookup_fighters as lookup_fighters_api,
  rank_api_available,
  submit_bili_record,
  submit_rank_score as submit_rank_score_api,
} from "./rank_api";
import {
  get_my_rank,
  get_rank_list,
  get_user_profile,
  is_toy_env,
  SURVIVAL_RANK_BOARD,
  SURVIVAL_RANK_BOARD_2P,
  submit_rank_score,
} from "./toy_sdk";

/**
 * 生存排行：分数上报 + 榜单拉取 + B站旁路记录（角色/名字/toyOpenId）。
 *
 * 两种环境互斥：
 * - B站（toy）：分数走 `toy.submitScore`，角色等额外信息走自有服务器的旁路记录（榜单按昵称回查补全）；
 * - 自有服务器：分数与额外信息一起提交到 RANK_API。
 */

// ---------------------------------------------------------------------------
// B站：昵称 / toyOpenId / 上次游玩角色（都是旁路记录的用户标识，只存本机）
// ---------------------------------------------------------------------------

/** B站昵称（榜单接口不提供角色信息，用提成绩时就近记下的昵称维护旁路记录） */
const BILI_NICKNAME_KEY = 'survival_bili_nickname'
function get_bili_nickname(): string {
  try { return localStorage.getItem(BILI_NICKNAME_KEY) ?? '' } catch { return '' }
}
function set_bili_nickname(name: string) {
  if (!name || name === get_bili_nickname()) return
  try { localStorage.setItem(BILI_NICKNAME_KEY, name) } catch { }
}

/** B站当前 Toy 内的用户标识（toyOpenId）：仅本机缓存 + 随旁路记录上报，不对外暴露 */
const BILI_OPEN_ID_KEY = 'survival_bili_open_id'
function get_bili_open_id(): string {
  try { return localStorage.getItem(BILI_OPEN_ID_KEY) ?? '' } catch { return '' }
}
function set_bili_open_id(id: string) {
  if (!id || id === get_bili_open_id()) return
  try { localStorage.setItem(BILI_OPEN_ID_KEY, id) } catch { }
}

let bili_profile_requested = false
/**
 * 申请一次 B站用户资料（拿到昵称 + toyOpenId）。
 * 首次需用户操作触发（平台数据确认弹窗）；未开启 OpenID 模式/用户拒绝/不支持时静默返回，
 * 不影响原有“从榜单学昵称”的回退链路。
 */
function request_bili_profile_once(lfw: LFW) {
  if (bili_profile_requested) return
  bili_profile_requested = true
  get_user_profile().then(profile => {
    if (!profile) return
    if (profile.toyOpenId) set_bili_open_id(profile.toyOpenId)
    if (profile.nickname) {
      set_bili_nickname(profile.nickname)
      apply_bili_player_name(lfw)
    }
  }).catch(() => { })
}

/** B站：上次成绩上报时的角色/名字（学到昵称前无法写旁路记录，先存本地） */
const BILI_LAST_CHARS_KEY = 'survival_bili_last_chars'
interface IBiliLastChars { score: number; fighter: string; player: string; fighter2: string; player2: string; two: boolean }
function save_bili_last_chars(v: IBiliLastChars) {
  try { localStorage.setItem(BILI_LAST_CHARS_KEY, JSON.stringify(v)) } catch { }
}
function get_bili_last_chars(): IBiliLastChars | null {
  try {
    const raw = localStorage.getItem(BILI_LAST_CHARS_KEY)
    return raw ? JSON.parse(raw) as IBiliLastChars : null
  } catch { return null }
}

/** 学到 B站昵称后（首次游玩时名字还未知）：用本地记下的角色补写一次旁路记录 */
function retro_bili_record(): void {
  const last = get_bili_last_chars()
  if (!last) return
  submit_bili_record(last.score, get_bili_nickname(), last.fighter, last.player, last.two, last.fighter2, last.player2, get_bili_open_id()).catch(() => { })
}

/** 上次自动写入 Player1 名字的昵称（用于区分玩家是否手动改过） */
const BILI_APPLIED_NAME_KEY = 'survival_bili_name_applied'
function get_bili_applied_name(): string {
  try { return localStorage.getItem(BILI_APPLIED_NAME_KEY) ?? '' } catch { return '' }
}
function set_bili_applied_name(name: string) {
  if (!name || name === get_bili_applied_name()) return
  try { localStorage.setItem(BILI_APPLIED_NAME_KEY, name) } catch { }
}

/** B站环境：Player1 的名字默认跟随 B站昵称；玩家手动改过则不再覆盖 */
function apply_bili_player_name(lfw: LFW) {
  const nickname = get_bili_nickname()
  if (!nickname) return
  const player = lfw.players.get('1')
  if (!player) return
  const name = `${player.name ?? ''}`.trim()
  const applied = get_bili_applied_name()
  if (name && name !== player.id && name !== applied) return
  if (name !== nickname) player.set_name(nickname, true).save()
  set_bili_applied_name(nickname)
  const puppet = lfw.world.puppets.get(player.id)
  if (puppet && puppet.name !== nickname) puppet.name = nickname
}

// ---------------------------------------------------------------------------
// 提交用：谁在玩、房主判定
// ---------------------------------------------------------------------------

/** 联机时只有房主负责提交排行（不在房间里则自己提交） */
function rank_is_host(): boolean {
  const { conn } = current_connection
  if (!conn?.room) return true
  return conn.room.owner?.id === conn.client?.id
}

/** 本地真人玩家（在场上的优先，最多两个）：双人榜提交两个人的名字与角色；联机时包括其他客户端的玩家 */
function rank_players(lfw: LFW) {
  const players = Array.from(lfw.players.values()).filter(v => !v.is_com)
  const on_field = players.filter(v => v.fighter)
  return (on_field.length ? on_field : players.filter(v => v.local)).slice(0, 2)
}

/** 玩家所在键位的名字（当前在场上的人优先；都没有时退回键位 1） */
function rank_player_name(lfw: LFW, player = rank_players(lfw)[0]): string {
  return `${player?.name ?? ''}`.trim() || '玩家'
}

/** 玩家创建时的原始角色名（变身/换数据后仍取原角色） */
function rank_player_fighter(lfw: LFW, player = rank_players(lfw)[0]): string {
  const fighter = player?.fighter
  const data = fighter
    ? lfw.datas.find(fighter.origin_data_id) ?? fighter.data
    : void 0
  return `${data?.base?.name ?? ''}`
}

/** 双人榜：玩家二的名字与角色（没有第二个玩家时为空字符串） */
function rank_player2(lfw: LFW): { name: string; fighter: string } {
  if (lfw.game_mode !== GameMode.SurvivalRank2P) return { name: '', fighter: '' }
  const player = rank_players(lfw)[1]
  if (!player) return { name: '', fighter: '' }
  return { name: rank_player_name(lfw, player), fighter: rank_player_fighter(lfw, player) }
}

// ---------------------------------------------------------------------------
// 榜单拉取
// ---------------------------------------------------------------------------

/** 自有服务器榜单不含角色时，按昵称查旁路记录补全（B站榜单用） */
async function merge_fighters(list: SurvivalRankItem[], period: SurvivalRankPeriod, two: boolean = false): Promise<SurvivalRankItem[]> {
  if (!rank_api_available() || !list.length) return list
  const chars = await lookup_fighters_api(period, list.map(v => v.nickname), two).catch(() => null)
  if (!chars?.size) return list
  return list.map(v => {
    const info = chars.get(v.nickname)
    return {
      ...v,
      fighter: info?.fighter ?? v.fighter,
      fighter2: info?.fighter2 ?? v.fighter2,
      player: info?.player ?? v.nickname,
      player2: info?.player2 ?? v.player2,
    }
  })
}

/** B站：拉取“榜单+我的排名”后一次性下发（limit≈SDK 上限 100），并顺带学习昵称 */
async function fetch_toy_rank(lfw: LFW, period: SurvivalRankPeriod): Promise<void> {
  const two = lfw.game_mode === GameMode.SurvivalRank2P
  const board = two ? SURVIVAL_RANK_BOARD_2P : SURVIVAL_RANK_BOARD
  const list = await get_rank_list({ board, period, limit: 100 })
  const mine = await get_my_rank({ board, period })
  const prev_nickname = get_bili_nickname()
  if (mine && mine.ranked) {
    const my_row = list.find(v => v.rank === mine.rank)
    if (my_row?.nickname) set_bili_nickname(my_row.nickname)
  }
  apply_bili_player_name(lfw)
  // 首次学到昵称：此前上报的成绩没写旁路记录（角色信息缺失），补一次
  if (get_bili_nickname() && get_bili_nickname() !== prev_nickname) retro_bili_record()
  lfw.set_survival_rank_data({
    period,
    list: await merge_fighters(list, period, two),
    mine: mine && mine.ranked ? { rank: mine.rank, score: mine.score } : null,
  })
}

/** 非 B站环境：从自己的服务器拉取“榜单+我的排名”后下发 */
async function fetch_api_rank(lfw: LFW, period: SurvivalRankPeriod): Promise<void> {
  const two = lfw.game_mode === GameMode.SurvivalRank2P
  const [list, mine] = await Promise.all([
    get_rank_list_api(period, two),
    get_my_rank_api(period, two),
  ])
  lfw.set_survival_rank_data({
    period,
    list,
    mine: mine ? { rank: mine.rank, score: mine.score } : null,
  })
}

// ---------------------------------------------------------------------------
// 分数上报
// ---------------------------------------------------------------------------

/** B站：每进入一个新的 Survival 阶段上报当前阶段编号（平台分数 + 旁路记录） */
function submit_toy_phase(lfw: LFW, reached: number): void {
  if (lfw.survival_rank_invalid) return
  if (!rank_is_host()) return
  const p2 = rank_player2(lfw)
  const fighter = rank_player_fighter(lfw)
  const player = rank_player_name(lfw)
  const two = lfw.game_mode === GameMode.SurvivalRank2P
  save_bili_last_chars({ score: reached, fighter, player, fighter2: p2.fighter, player2: p2.name, two })
  submit_rank_score(reached, two ? SURVIVAL_RANK_BOARD_2P : SURVIVAL_RANK_BOARD).catch(() => { })
  submit_bili_record(reached, get_bili_nickname(), fighter, player, two, p2.fighter, p2.name, get_bili_open_id()).catch(() => { })
}

/** 非 B站环境：同样上报当前阶段编号，提交到自己的服务器 */
function submit_api_phase(lfw: LFW, reached: number): void {
  if (lfw.survival_rank_invalid) return
  if (!rank_is_host()) return
  const p2 = rank_player2(lfw)
  submit_rank_score_api(reached, rank_player_name(lfw), rank_player_fighter(lfw), lfw.game_mode === GameMode.SurvivalRank2P, p2.fighter, p2.name).catch(() => { })
}

// ---------------------------------------------------------------------------
// 对 App 暴露的入口
// ---------------------------------------------------------------------------

/** App 启动时的 0 分提交只做一次（React StrictMode 开发模式会重复执行 effect） */
let rank_startup_submitted = false

/** 初始化生存排行：分数上报回调、可用标志、B站启动确认提交与用户资料申请 */
export function init_survival_rank(lfw: LFW): void {
  if (is_toy_env()) {
    lfw.on_survival_rank_phase = (reached) => submit_toy_phase(lfw, reached)
    lfw.survival_rank_available = true
    // 启动时先提交一次 0：尽早完成平台首次用户数据确认，并让“已提交最高分”记录对齐服务端；
    // 已有记录（≥0）会被 submit_rank_score 去重跳过
    if (!rank_startup_submitted) {
      rank_startup_submitted = true
      submit_rank_score(0).catch(() => { })
    }
    // Player1 的名字默认跟随 B站昵称（等玩家资料加载完再应用，避免被覆盖）
    lfw.players.get('1')?.loaded.then(() => apply_bili_player_name(lfw)).catch(() => { })
    return
  }
  if (rank_api_available()) {
    lfw.on_survival_rank_phase = (reached) => submit_api_phase(lfw, reached)
    lfw.survival_rank_available = true
  }
}

/** 榜单页请求数据（rank_request）：按环境拉“榜单+我的排名”后一次性下发 */
export function fetch_survival_rank(lfw: LFW, period: SurvivalRankPeriod): void {
  if (is_toy_env()) {
    // 第一次进入生存排行（点入口→准备页打开时的 rank_request）顺便申请一次 B站用户资料；
    // 未开启 OpenID 模式/用户拒绝/不支持则静默回退（不重试）
    request_bili_profile_once(lfw)
    fetch_toy_rank(lfw, period).catch(() => { })
  } else if (rank_api_available()) {
    fetch_api_rank(lfw, period).catch(() => { })
  }
}
