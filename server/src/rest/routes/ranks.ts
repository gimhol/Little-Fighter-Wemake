import { RANK_TYPE_PATTERN, type IRankStore } from '../RankMgr';
import { RestError } from '../RestError';
import type { Rest } from '../index';
import { body_of, str_of } from '../read_body';
import { query_int, query_str } from '../utils';

const MAX_LOOKUP_NAMES = 200;
const NAME_MAX = 32;
const EXTRA_VALUE_MAX = 64;
const UID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;
/** 提交时只保留这些 extra 字段，避免任意 JSON 无限增长 */
const EXTRA_KEYS = ['fighter', 'player', 'fighter2', 'player2', 'open_id'] as const;
/** 控制符 / 零宽 / 方向控制：常被用来伪造重名，直接剔除 */
const NAME_STRIP_PATTERN = /[\p{Cc}\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/gu;

function uid_of(raw: string | undefined): string | undefined {
  const uid = raw?.trim();
  return uid && UID_PATTERN.test(uid) ? uid : void 0;
}

/** 公开响应里剔除敏感/内部字段：不对外暴露 uid，避免被拿来顶掉别人的记录 */
function public_score<T extends { extra?: unknown }>(value: T): Record<string, unknown> {
  const ret: Record<string, unknown> = { ...value };
  delete ret.uid;
  delete ret.client_id;
  delete ret.address;
  const extra = ret.extra;
  if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
    const src = extra as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    // B站 toyOpenId 仅本地存储用，不外泄
    for (const key of Object.keys(src)) if (key !== 'open_id') out[key] = src[key];
    ret.extra = out;
  }
  return ret;
}

/** 名字归一化：NFC + 去控制符/零宽/方向控制 + 折叠空白 + 截断 */
function clean_name(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(NAME_STRIP_PATTERN, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, NAME_MAX);
}

function clean_extra(extra: unknown): Record<string, string> | undefined {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return void 0;
  const src = extra as Record<string, unknown>;
  const ret: Record<string, string> = {};
  for (const key of EXTRA_KEYS) {
    const value = str_of(src[key]);
    if (value) ret[key] = value.slice(0, EXTRA_VALUE_MAX);
  }
  return Object.keys(ret).length ? ret : void 0;
}

function require_type(ranks: IRankStore, type: string) {
  if (!RANK_TYPE_PATTERN.test(type))
    throw RestError.bad_request(`排行类型只能包含字母、数字、下划线、点和短横线（最长 64 字符）：${type}`);
  if (ranks.allows(type)) return;
  const allowed = ranks.allowed_types;
  throw RestError.bad_request(`排行类型不允许：${type}${allowed ? `（允许的类型：${allowed.join(', ')}）` : ''}`);
}

export function register_rank_routes(rest: Rest) {
  const { router, ranks, ranks_guard: guard } = rest;

  // 封禁管理必须注册在 /api/ranks/:type/:uid 之前，否则 'bans' 会被当成 :type
  router.get('/api/ranks/bans', { access: 'admin' }, () => guard.bans);

  router.post('/api/ranks/bans', { access: 'admin' }, (c) => {
    const body = body_of(c.req.body);
    const uid = uid_of(str_of(body?.uid));
    const token = str_of(body?.token);
    const reason = str_of(body?.reason)?.slice(0, 200);
    if (!uid && !token) throw RestError.bad_request('需要 uid 或 token');
    if (uid) guard.ban_uid(uid, reason);
    if (token) guard.ban_token(token, reason);
    guard.audit({ event: 'ban', uid, token: guard.hash_token(token), note: reason });
    return { ok: true, ...guard.bans };
  });

  router.delete('/api/ranks/bans/:uid', { access: 'admin' }, (c) => {
    const uid = uid_of(c.req.params.uid);
    if (!uid) throw RestError.bad_request('uid 不合法');
    const ok = guard.unban_uid(uid);
    guard.audit({ event: 'unban', uid });
    return { ok };
  });

  router.post('/api/ranks', { access: 'player' }, (c) => {
    const address = c.req.raw.socket.remoteAddress ?? void 0;
    const agent = `${c.req.raw.headers['user-agent'] ?? ''}`.slice(0, 256) || void 0;
    // 限流放在最前面：被刷时不浪费后续解析
    guard.check_submit(c.auth, address);

    const body = body_of(c.req.body);
    const type = str_of(body?.type)?.slice(0, 64);
    const raw_name = str_of(body?.name);
    if (!type) throw RestError.bad_request('缺少 type');
    if (!raw_name) throw RestError.bad_request('缺少 name');
    require_type(ranks, type);

    const name = clean_name(raw_name);
    if (!name) throw RestError.bad_request('name 不合法');

    const raw_score = body?.score;
    const score = typeof raw_score === 'number' ? raw_score : Number(str_of(raw_score) ?? NaN);
    if (!Number.isFinite(score) || !Number.isInteger(score))
      throw RestError.bad_request('score 必须是整数');
    if (score < 0 || score > guard.max_score)
      throw RestError.bad_request(`score 超出允许范围（0 ~ ${guard.max_score}）`, 'score_out_of_range');

    const uid = uid_of(str_of(body?.uid));
    guard.assert_uid_not_banned(uid);

    const result = ranks.submit({
      type,
      name,
      score,
      uid,
      group: str_of(body?.group)?.slice(0, 64),
      extra: clean_extra(body?.extra),
      client_id: c.client?.id,
      address,
    });

    guard.audit({
      event: 'submit',
      type,
      name,
      score,
      uid,
      group: result.score.group,
      token: guard.hash_token(c.auth.token),
      address,
      agent,
      rank: result.rank,
      total: result.total,
      kept: result.kept,
    });

    return { rank: result.rank, total: result.total, kept: result.kept, ...public_score(result.score) };
  });

  router.post('/api/ranks/lookup', (c) => {
    const body = body_of(c.req.body) as { type?: unknown; names?: unknown } | undefined;
    const type = str_of(body?.type);
    if (!type) throw RestError.bad_request('缺少 type');
    require_type(ranks, type);
    const raw_names = Array.isArray(body?.names) ? body.names.slice(0, MAX_LOOKUP_NAMES) : [];
    const names: string[] = [];
    for (const raw of raw_names) {
      const name = str_of(raw);
      if (name) names.push(name);
    }
    return { type, chars: ranks.char_lookup(type, names) };
  });

  router.get('/api/ranks/:type', (c) => {
    const type = c.req.params.type;
    require_type(ranks, type);
    const limit = query_int(c.req.query, 'limit', 50, 1, 500);
    const name = query_str(c.req.query, 'name');
    const uid = uid_of(query_str(c.req.query, 'uid'));
    const result = ranks.scores(type, limit, name);
    const best = name || uid ? ranks.find(type, { name, uid }) ?? null : void 0;
    return { type, limit, total: result.total, scores: result.scores.map(public_score), best: best && { ...best, score: public_score(best.score) } };
  });

  router.delete('/api/ranks/:type/:uid', { access: 'admin' }, (c) => {
    const type = c.req.params.type;
    require_type(ranks, type);
    const uid = uid_of(c.req.params.uid);
    if (!uid) throw RestError.bad_request('uid 不合法');
    const removed = ranks.remove(type, { uid });
    guard.audit({ event: 'remove', type, uid, note: `removed=${removed}` });
    return { type, uid, removed };
  });
}
