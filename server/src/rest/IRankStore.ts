export interface IRankScore {
  type: string;
  name: string;
  score: number;
  extra?: unknown;
  date: number;
  uid?: string;
  group?: string;
  client_id?: string;
  address?: string;
}

export interface IRankSubmit {
  type: string;
  name: string;
  score: number;
  extra?: unknown;
  uid?: string;
  group?: string;
  client_id?: string;
  address?: string;
}

export interface IRankResult {
  rank: number;
  total: number;
  kept: boolean;
  score: IRankScore;
}

export interface IRankLookup {
  name: string;
  score: number;
  fighter?: string;
  player?: string;
  fighter2?: string;
  player2?: string;
}

export interface IRankOptions {
  max_per_type?: number;
  allowed_types?: string[];
  dir?: string;
}

export interface IRankStore {
  readonly kind: string;
  readonly path: string;
  readonly max_per_type: number;
  readonly allowed_types?: string[];
  allows(type: string): boolean;
  total(type: string): number;
  find(type: string, opts: { name?: string; uid?: string }): { rank: number; score: IRankScore } | undefined;
  scores(type: string, limit?: number, name?: string): { total: number; scores: IRankScore[] };
  extra_fighter(extra: unknown): string | undefined;
  extra_player(extra: unknown): string | undefined;
  extra_fighter2(extra: unknown): string | undefined;
  extra_player2(extra: unknown): string | undefined;
  char_lookup(type: string, names: string[]): IRankLookup[];
  submit(info: IRankSubmit): IRankResult;
}

export const DEFAULT_RANKS_FILE = 'ranks.json';
export const RANK_FILE_EXT = '.json';
export const MAX_PER_TYPE = 10000;
export const SAVE_DELAY = 500;
export const RANK_TYPE_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
export const PERIOD_SUFFIXES = ['_all', '_month', '_week', '_day'] as const;

export function owner_key(v: { uid?: string; name: string; group?: string }): string {
  if (!v.uid) return `name:${v.name}`;
  const group = v.group?.trim();
  return group ? `uid:${v.uid}:${group}` : `uid:${v.uid}`;
}

/**
 * 从 extra 推出「角色」分组：单人榜 = 角色名，双人榜 = 两个角色名（排序后拼接，与客户端提交的 group 一致）。
 * B站旁路记录（type 含 bili）按昵称回查角色，不分角色。
 */
export function group_of(type: string, extra: unknown): string | undefined {
  if (type.includes('bili')) return void 0;
  const fighter = extra_fighter(extra);
  if (!fighter) return void 0;
  if (!type.includes('2p')) return fighter;
  const fighter2 = extra_fighter2(extra);
  if (!fighter2 || fighter2 === fighter) return fighter;
  return [fighter, fighter2].sort().join('+');
}

export function family_of(type: string): string[] {
  for (const suffix of PERIOD_SUFFIXES) {
    if (!type.endsWith(suffix)) continue;
    const base = type.slice(0, -suffix.length);
    if (!base) break;
    return PERIOD_SUFFIXES.map(v => `${base}${v}`);
  }
  return [];
}

export function extra_fighter(extra: unknown): string | undefined {
  const fighter = (extra as { fighter?: unknown } | undefined)?.fighter;
  return typeof fighter === 'string' && fighter ? fighter : void 0;
}

export function extra_player(extra: unknown): string | undefined {
  const player = (extra as { player?: unknown } | undefined)?.player;
  return typeof player === 'string' && player ? player : void 0;
}

export function extra_fighter2(extra: unknown): string | undefined {
  const fighter = (extra as { fighter2?: unknown } | undefined)?.fighter2;
  return typeof fighter === 'string' && fighter ? fighter : void 0;
}

export function extra_player2(extra: unknown): string | undefined {
  const player = (extra as { player2?: unknown } | undefined)?.player2;
  return typeof player === 'string' && player ? player : void 0;
}

export function max_of(value: number | undefined): number {
  const max = value ?? MAX_PER_TYPE;
  return max > 0 ? max : Infinity;
}

export function allowed_of(value?: string[]): string[] | undefined {
  const allowed = value?.map(v => `${v}`.trim()).filter(Boolean);
  return allowed?.length ? Array.from(new Set(allowed)) : void 0;
}

export function submit_to_family(store: IRankStore, submit: (info: IRankSubmit) => IRankResult, info: IRankSubmit): IRankResult {
  const result = submit(info);
  for (const type of family_of(info.type)) {
    if (type !== info.type && store.allows(type)) submit({ ...info, type });
  }
  return result;
}
