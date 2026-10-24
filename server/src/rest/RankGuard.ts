import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { IAuth } from './AuthMgr';
import { RestError } from './RestError';

export const DEFAULT_MAX_SCORE = 10000;
export const DEFAULT_RATE_WINDOW_MS = 60_000;
export const DEFAULT_RATE_PER_TOKEN = 60;
export const DEFAULT_RATE_PER_IP = 240;
export const DEFAULT_RATE_TOKEN_PER_IP = 30;
const AUDIT_ROTATE_BYTES = 32 * 1024 * 1024;

export interface IRankGuardOptions {
  /** 排行数据所在目录：审计与封禁文件默认放这里 */
  dir?: string;
  max_score?: number;
  audit_path?: string;
  bans_path?: string;
  rate_window_ms?: number;
  rate_per_token?: number;
  rate_per_ip?: number;
  rate_token_per_ip?: number;
}

export interface IRankAudit {
  event: 'submit' | 'remove' | 'ban' | 'unban';
  type?: string;
  name?: string;
  score?: number;
  uid?: string;
  group?: string;
  /** token 的哈希，不落明文 */
  token?: string;
  address?: string;
  agent?: string;
  rank?: number;
  total?: number;
  kept?: boolean;
  note?: string;
  at: number;
}

export interface IBanInfo {
  value: string;
  reason?: string;
  at: number;
}

interface IBansFile {
  version?: number;
  uids?: Record<string, { reason?: string; at?: number }>;
  tokens?: Record<string, { reason?: string; at?: number }>;
}

function positive_int(value: number | undefined, fallback: number): number {
  const v = Number(value);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

function ban_info(value: string, raw: { reason?: string; at?: number } | undefined): IBanInfo {
  const reason = typeof raw?.reason === 'string' && raw.reason ? raw.reason.slice(0, 200) : void 0;
  const at = Number(raw?.at);
  return { value, reason, at: Number.isFinite(at) ? at : 0 };
}

/**
 * 排行提交的准入控制：限流、封禁、审计。
 *
 * 这是「提高作弊成本 + 可追溯」，不是身份认证：player token 本身是公开可申请的，
 * 真正的防作弊要靠分数上限、提交节奏与事后按审计日志清理。
 */
export class RankGuard {
  static readonly TAG = 'RankGuard';
  readonly max_score: number;
  readonly rate_window_ms: number;
  readonly rate_per_token: number;
  readonly rate_per_ip: number;
  readonly rate_token_per_ip: number;
  readonly audit_path: string;
  readonly bans_path: string;
  protected _hits = new Map<string, number[]>();
  protected _hits_total = 0;
  protected _banned_uids = new Map<string, IBanInfo>();
  protected _banned_tokens = new Map<string, IBanInfo>();

  constructor(options: IRankGuardOptions = {}) {
    const dir = options.dir?.trim() || process.cwd();
    this.max_score = positive_int(options.max_score, DEFAULT_MAX_SCORE);
    this.rate_window_ms = positive_int(options.rate_window_ms, DEFAULT_RATE_WINDOW_MS);
    this.rate_per_token = positive_int(options.rate_per_token, DEFAULT_RATE_PER_TOKEN);
    this.rate_per_ip = positive_int(options.rate_per_ip, DEFAULT_RATE_PER_IP);
    this.rate_token_per_ip = positive_int(options.rate_token_per_ip, DEFAULT_RATE_TOKEN_PER_IP);
    this.audit_path = options.audit_path?.trim() || join(dir, 'ranks_audit.jsonl');
    this.bans_path = options.bans_path?.trim() || join(dir, 'ranks_bans.json');
    this.load_bans();
  }

  get bans(): { uids: IBanInfo[]; tokens: IBanInfo[] } {
    return {
      uids: Array.from(this._banned_uids.values()),
      tokens: Array.from(this._banned_tokens.values()),
    };
  }

  /** token 只以哈希形式出现在审计与日志里 */
  hash_token(token: string | undefined): string {
    const v = `${token ?? ''}`.trim();
    return v ? createHash('sha256').update(v).digest('hex').slice(0, 16) : '';
  }

  /** 提交前的准入检查（限流 + 封禁） */
  check_submit(auth: IAuth, address: string | undefined) {
    const token = this.hash_token(auth.token);
    if (token && this._banned_tokens.has(token))
      throw RestError.forbidden('该账号已被禁止提交排行', 'rank_banned');
    if (token) this.consume(`token:${token}`, this.rate_per_token, '提交');
    if (address) this.consume(`ip:${address}`, this.rate_per_ip, '提交');
  }

  check_token_issue(address: string | undefined) {
    if (address) this.consume(`issue:${address}`, this.rate_token_per_ip, '申请 token');
  }

  assert_uid_not_banned(uid: string | undefined) {
    if (uid && this._banned_uids.has(uid))
      throw RestError.forbidden('该 uid 已被禁止上榜', 'rank_banned');
  }

  ban_uid(uid: string, reason?: string) {
    this._banned_uids.set(uid, { value: uid, reason: reason || void 0, at: Date.now() });
    this.save_bans();
  }

  unban_uid(uid: string): boolean {
    const removed = this._banned_uids.delete(uid);
    if (removed) this.save_bans();
    return removed;
  }

  ban_token(token: string, reason?: string) {
    const hash = this.hash_token(token);
    if (!hash) return;
    this._banned_tokens.set(hash, { value: hash, reason: reason || void 0, at: Date.now() });
    this.save_bans();
  }

  unban_token(token: string): boolean {
    const removed = this._banned_tokens.delete(this.hash_token(token));
    if (removed) this.save_bans();
    return removed;
  }

  /** 追加一行 JSONL 审计（超过 32MB 轮转为 .1） */
  audit(entry: Omit<IRankAudit, 'at'> & { at?: number }) {
    const line = `${JSON.stringify({ ...entry, at: entry.at ?? Date.now() })}\n`;
    try {
      this.rotate_audit();
      mkdirSync(dirname(this.audit_path), { recursive: true });
      appendFileSync(this.audit_path, line, 'utf8');
    } catch (error) {
      console.warn(`[${RankGuard.TAG}] 审计日志写入失败: ${this.audit_path}`, error instanceof Error ? error.message : error);
    }
  }

  protected consume(key: string, limit: number, label: string) {
    const now = Date.now();
    const window = this.rate_window_ms;
    let hits = this._hits.get(key);
    if (!hits) this._hits.set(key, hits = []);
    while (hits.length && now - hits[0]! >= window) hits.shift();
    if (hits.length >= limit) {
      const wait = Math.max(1, Math.ceil((hits[0]! + window - now) / 1000));
      throw RestError.too_many_requests(`${label}过于频繁，请 ${wait} 秒后再试`, 'rate_limited');
    }
    hits.push(now);
    if (++this._hits_total % 2048 === 0) this.sweep(now);
  }

  protected sweep(now: number) {
    for (const [key, hits] of this._hits) {
      while (hits.length && now - hits[0]! >= this.rate_window_ms) hits.shift();
      if (!hits.length) this._hits.delete(key);
    }
  }

  protected rotate_audit() {
    try {
      if (statSync(this.audit_path).size < AUDIT_ROTATE_BYTES) return;
    } catch {
      return;
    }
    try { renameSync(this.audit_path, `${this.audit_path}.1`) } catch { /* 目标已存在时跳过轮转 */ }
  }

  protected load_bans() {
    if (!existsSync(this.bans_path)) return;
    try {
      const raw = JSON.parse(readFileSync(this.bans_path, 'utf8')) as IBansFile;
      for (const [uid, info] of Object.entries(raw?.uids ?? {})) this._banned_uids.set(uid, ban_info(uid, info));
      for (const [token, info] of Object.entries(raw?.tokens ?? {})) this._banned_tokens.set(token, ban_info(token, info));
      console.log(`[${RankGuard.TAG}] 已加载封禁名单: uid ${this._banned_uids.size} / token ${this._banned_tokens.size}`);
    } catch (error) {
      console.warn(`[${RankGuard.TAG}] 封禁名单读取失败: ${this.bans_path}`, error instanceof Error ? error.message : error);
    }
  }

  protected save_bans() {
    try {
      const data: IBansFile = {
        version: 1,
        uids: Object.fromEntries(Array.from(this._banned_uids, ([k, v]) => [k, { reason: v.reason, at: v.at }])),
        tokens: Object.fromEntries(Array.from(this._banned_tokens, ([k, v]) => [k, { reason: v.reason, at: v.at }])),
      };
      mkdirSync(dirname(this.bans_path), { recursive: true });
      const tmp = `${this.bans_path}.tmp`;
      writeFileSync(tmp, JSON.stringify(data, null, 2));
      renameSync(tmp, this.bans_path);
    } catch (error) {
      console.warn(`[${RankGuard.TAG}] 封禁名单写入失败: ${this.bans_path}`, error instanceof Error ? error.message : error);
    }
  }
}
