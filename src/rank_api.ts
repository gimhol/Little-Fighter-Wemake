import type { SurvivalRankItem, SurvivalRankPeriod } from "./LFW/LFW";

const TYPE_OF_PERIOD: Record<SurvivalRankPeriod, string> = {
  all: 'survival_all',
  month: 'survival_month',
  week: 'survival_week',
  day: 'survival_day',
};
const TYPE_OF_PERIOD_2P: Record<SurvivalRankPeriod, string> = {
  all: 'survival_2p_all',
  month: 'survival_2p_month',
  week: 'survival_2p_week',
  day: 'survival_2p_day',
};
const SUBMITTED_KEY = 'rank_api_submitted_max';
const BILI_SUBMITTED_KEY = 'rank_api_bili_submitted_max';
const UID_KEY = 'rank_api_uid';
const LIST_LIMIT = 100;
const BILI_TYPE_OF_PERIOD: Record<SurvivalRankPeriod, string> = {
  all: 'survival_bili_all',
  month: 'survival_bili_month',
  week: 'survival_bili_week',
  day: 'survival_bili_day',
};
const BILI_TYPE_OF_PERIOD_2P: Record<SurvivalRankPeriod, string> = {
  all: 'survival_bili_2p_all',
  month: 'survival_bili_2p_month',
  week: 'survival_bili_2p_week',
  day: 'survival_bili_2p_day',
};

function query_param(name: string): string {
  const params = new URLSearchParams(location.search);
  const qi = location.hash.indexOf('?');
  if (qi >= 0) {
    for (const [k, v] of new URLSearchParams(location.hash.slice(qi + 1)))
      if (!params.has(k)) params.set(k, v);
  }
  return params.get(name)?.trim() ?? '';
}

export function rank_api_base(): string {
  const base = (query_param('RANK_API') || RANK_API_URL || '').trim();
  return base.replace(/\/+$/, '');
}

export function rank_api_available(): boolean {
  return !!rank_api_base();
}

export function rank_api_type(period: SurvivalRankPeriod, two: boolean = false): string {
  const map = two ? TYPE_OF_PERIOD_2P : TYPE_OF_PERIOD;
  return map[period] ?? map.all;
}

export function rank_api_bili_type(period: SurvivalRankPeriod, two: boolean = false): string {
  const map = two ? BILI_TYPE_OF_PERIOD_2P : BILI_TYPE_OF_PERIOD;
  return map[period] ?? map.all;
}

function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${rank_api_base()}${path}`, init);
}

interface IRankEntry {
  name?: string;
  score?: number;
  extra?: { fighter?: string; player?: string; fighter2?: string; player2?: string };
}

function rank_uid(): string {
  try {
    let uid = localStorage.getItem(UID_KEY) ?? '';
    if (!uid) {
      uid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `u${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(UID_KEY, uid);
    }
    return uid;
  } catch {
    return '';
  }
}

async function post_score(type: string, name: string, score: number, fighter: string, player: string, fighter2: string = '', player2: string = '', open_id: string = '', owner_uid: string = '', group: string = ''): Promise<void> {
  const extra: { fighter: string; player: string; fighter2?: string; player2?: string; open_id?: string } = { fighter, player };
  if (fighter2) extra.fighter2 = fighter2;
  if (player2) extra.player2 = player2;
  if (open_id) extra.open_id = open_id;
  const body: { type: string; name: string; score: number; uid: string; extra: typeof extra; group?: string } = { type, name, score, uid: owner_uid || rank_uid(), extra };
  if (group) body.group = group;
  const resp = await api('/api/ranks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`[rank_api] 提交失败: ${resp.status}`);
}

/**
 * 用 B站 toyOpenId 生成稳定的去重键（同一 B站用户跨设备合并成一条记录）。
 * 不能直接传 toyOpenId（文档要求不要外泄），用两段哈希拼一个符合 uid 规则的短标识；
 * 没拿到 open_id 时返回空串 → 调用方回退到本机 uid。
 */
function bili_owner_uid(open_id: string): string {
  const id = open_id.trim();
  if (!id) return '';
  let h1 = 0;
  for (let i = 0; i < id.length; i++) h1 = (Math.imul(h1, 31) + id.charCodeAt(i)) | 0;
  let h2 = 5381;
  for (let i = id.length - 1; i >= 0; i--) h2 = (Math.imul(h2, 33) ^ id.charCodeAt(i)) | 0;
  return `bili_${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}

function submitted_max(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return -1;
    const value = Number(raw);
    return Number.isFinite(value) ? value : -1;
  } catch {
    return -1;
  }
}

function set_submitted_max(key: string, score: number) {
  try {
    localStorage.setItem(key, `${score}`);
  } catch {
    //
  }
}

/** 分组键：单人榜 = 角色名，双人榜 = 两个角色名排序拼接；同一客户端的不同角色各占一行 */
function score_group(two: boolean, fighter: string, fighter2: string): string {
  if (!two) return fighter;
  if (!fighter || !fighter2 || fighter === fighter2) return fighter || fighter2;
  return [fighter, fighter2].sort().join('+');
}

export async function submit_rank_score(score: number, name: string, fighter: string, two: boolean = false, fighter2: string = '', player2: string = ''): Promise<void> {
  const group = score_group(two, fighter, fighter2);
  const key = two ? `${SUBMITTED_KEY}_2p${group ? `_${group}` : ''}` : group ? `${SUBMITTED_KEY}_${group}` : SUBMITTED_KEY;
  if (score <= submitted_max(key)) return;
  await post_score(rank_api_type('all', two), name, score, fighter, name, fighter2, player2, '', '', group);
  set_submitted_max(key, score);
}

export async function get_rank_list(period: SurvivalRankPeriod, two: boolean = false): Promise<SurvivalRankItem[]> {
  const resp = await api(`/api/ranks/${rank_api_type(period, two)}?limit=${LIST_LIMIT}`);
  if (!resp.ok) throw new Error(`[rank_api] 拉取榜单失败: ${resp.status}`);
  const data = await resp.json() as { scores?: IRankEntry[] };
  const entries = Array.isArray(data?.scores) ? data.scores : [];
  const list: SurvivalRankItem[] = [];
  for (const entry of entries) {
    const nickname = `${entry?.name ?? ''}`;
    const score = Number(entry?.score);
    if (!nickname || !Number.isFinite(score)) continue;
    list.push({ rank: list.length + 1, score, nickname, fighter: entry?.extra?.fighter, fighter2: entry?.extra?.fighter2, player: entry?.extra?.player ?? nickname, player2: entry?.extra?.player2 });
  }
  return list;
}

export async function get_my_rank(period: SurvivalRankPeriod, two: boolean = false): Promise<{ rank: number; score: number } | null> {
  const uid = rank_uid();
  if (!uid) return null;
  const resp = await api(`/api/ranks/${rank_api_type(period, two)}?uid=${encodeURIComponent(uid)}&limit=1`);
  if (!resp.ok) throw new Error(`[rank_api] 查询我的排名失败: ${resp.status}`);
  const data = await resp.json() as { best?: { rank?: number; score?: { score?: number } } | null };
  const rank = Number(data?.best?.rank);
  const score = Number(data?.best?.score?.score);
  if (!Number.isFinite(rank) || !Number.isFinite(score)) return null;
  return { rank, score };
}

export async function submit_bili_record(score: number, name: string, fighter: string, player: string, two: boolean = false, fighter2: string = '', player2: string = '', open_id: string = ''): Promise<void> {
  const key = BILI_SUBMITTED_KEY + (two ? '_2p' : '');
  if (!rank_api_available() || !name) return;
  if (score <= submitted_max(key)) return;
  await post_score(rank_api_bili_type('all', two), name, score, fighter, player, fighter2, player2, open_id, bili_owner_uid(open_id));
  set_submitted_max(key, score);
}

export interface IRankCharInfo {
  fighter?: string;
  player?: string;
  fighter2?: string;
  player2?: string;
}

export async function lookup_fighters(period: SurvivalRankPeriod, names: string[], two: boolean = false): Promise<Map<string, IRankCharInfo>> {
  const ret = new Map<string, IRankCharInfo>();
  const wanted = names.filter(Boolean);
  if (!rank_api_available() || !wanted.length) return ret;
  const resp = await api('/api/ranks/lookup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: rank_api_bili_type(period, two), names: wanted }),
  });
  if (!resp.ok) return ret;
  const data = await resp.json() as { chars?: { name?: string; fighter?: string; player?: string; fighter2?: string; player2?: string }[] };
  for (const v of data?.chars ?? []) {
    const name = `${v?.name ?? ''}`;
    const fighter = `${v?.fighter ?? ''}`;
    const player = `${v?.player ?? ''}`;
    const fighter2 = `${v?.fighter2 ?? ''}`;
    const player2 = `${v?.player2 ?? ''}`;
    if (!name || (!fighter && !player)) continue;
    ret.set(name, { fighter: fighter || void 0, player: player || void 0, fighter2: fighter2 || void 0, player2: player2 || void 0 });
  }
  return ret;
}
