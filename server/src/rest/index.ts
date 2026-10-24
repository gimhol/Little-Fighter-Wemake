import type { Server as HttpServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import { resolve, dirname } from 'node:path';
import { to_list, to_num, to_str } from '../config';
import type { Context } from '../Context';
import { AuthMgr } from './AuthMgr';
import type { TTokenList } from './AuthMgr';
import { DEFAULT_RANKS_FILE, RankMgr } from './RankMgr';
import type { IRankStore } from './IRankStore';
import { RankGuard } from './RankGuard';
import { SqliteRankMgr } from './SqliteRankMgr';
import { RestError } from './RestError';
import { RestResponse } from './RestResponse';
import { Router } from './Router';
import { parse_body, read_body } from './read_body';
import { register_routes } from './routes/index';
import type { IAuth } from './AuthMgr';
import type { IRestCall, IRestReq, TAccess } from './types';
import { split_url } from './utils';

export * from './AuthMgr';
export * from './IRankStore';
export * from './RankGuard';
export * from './RankMgr';
export * from './SqliteRankMgr';
export * from './RestError';
export * from './RestResponse';
export * from './Router';
export * from './read_body';
export * from './types';
export * from './utils';

export const DEFAULT_MAX_BODY_SIZE = 1024 * 1024;

export type TRestServer = HttpServer | HttpsServer;

export interface IRestOptions {
  admin_tokens?: TTokenList | TTokenList[];
  max_body_size?: number;
  log?: boolean;
  info?: Record<string, unknown>;
  ranks_path?: string;
  ranks_dir?: string;
  ranks_db?: string;
  ranks_types?: string[] | string;
  ranks_max_per_type?: number;
  /** 排行分数上限（防作弊：超过直接拒绝） */
  ranks_max_score?: number;
  /** 排行提交审计日志（JSONL），缺省放在排行数据同目录 */
  ranks_audit_path?: string;
  /** 封禁名单文件，缺省放在排行数据同目录 */
  ranks_bans_path?: string;
  ranks_rate_window_ms?: number;
  ranks_rate_per_token?: number;
  ranks_rate_per_ip?: number;
  ranks_rate_token_per_ip?: number;
}

export class Rest {
  static readonly TAG = 'Rest';
  readonly ctx: Context;
  readonly router = new Router();
  readonly auth: AuthMgr;
  readonly ranks: IRankStore;
  readonly ranks_guard: RankGuard;
  readonly options: IRestOptions;
  readonly started_at = Date.now();

  constructor(ctx: Context, options: IRestOptions = {}) {
    this.ctx = ctx;
    this.auth = ctx.auth;
    this.options = options;
    this.ranks = create_rank_store(options);
    this.ranks_guard = create_rank_guard(this.ranks, options);
    this.auth.add_admin_token(...(Array.isArray(options.admin_tokens) ? options.admin_tokens : [options.admin_tokens]));
    register_routes(this);
  }

  get max_body_size(): number { return this.options.max_body_size ?? DEFAULT_MAX_BODY_SIZE }
  get log(): boolean { return this.options.log ?? true }

  handle = async (raw: IncomingMessage, raw_res: ServerResponse): Promise<void> => {
    const started = Date.now();
    const res = new RestResponse(raw_res);
    const method = `${raw.method ?? 'GET'}`.toUpperCase();
    const { path, query } = split_url(raw.url);
    let route_path = '-';
    try {
      if (method !== 'OPTIONS') {
        const { route, params, allowed } = this.router.match(method === 'HEAD' ? 'GET' : method, path);
        if (!route) {
          if (allowed.length) {
            res.header('allow', allowed.join(', '));
            throw RestError.method_not_allowed(`方法不被允许：${method} ${path}（可用：${allowed.join(', ')}）`);
          }
          throw RestError.not_found(`接口不存在：${method} ${path}`);
        }
        route_path = `${route.method} ${route.path}`;
        const text = method === 'GET' || method === 'HEAD' ? '' : await read_body(raw, this.max_body_size);
        const req: IRestReq = {
          raw,
          method,
          path,
          query,
          params,
          text,
          body: parse_body(text, raw.headers['content-type']),
        };
        const auth = this.auth.resolve(this.auth.token_of(raw, query));
        this.check_access(route.access, auth);
        const call: IRestCall = { ctx: this.ctx, req, res, auth, client: auth.client };
        const result = await route.handler(call);
        if (result !== undefined && !res.responded) res.json(result);
      }
      if (!res.responded) res.status(204).end();
    } catch (error) {
      const rest_error = error instanceof RestError ? error : void 0;
      if (!rest_error)
        console.error(`[${Rest.TAG}] ${method} ${path} 处理失败:`, error);
      if (!res.responded) {
        const err = rest_error ?? RestError.internal(error instanceof Error ? error.message : `${error}`);
        res.status(err.status).json({ status: err.status, error: err.message, code: err.code });
      }
    } finally {
      if (this.log)
        console.log(`[${Rest.TAG}] ${method} ${path} (${route_path}) -> ${res.status_code} ${Date.now() - started}ms`);
    }
  };

  protected check_access(access: TAccess, auth: IAuth) {
    switch (access) {
      case 'public':
        return;
      case 'player':
        if (auth.level === 'guest')
          throw RestError.unauthorized('需要玩家 token（可先 POST /api/auth/token 获取）');
        return;
      case 'client':
        if (auth.level === 'guest')
          throw RestError.unauthorized('需要玩家 token（可先 POST /api/auth/token 获取）');
        if (auth.level !== 'player' || !auth.client)
          throw RestError.conflict('token 未绑定在线客户端：WebSocket 连接地址加上 ?token=<token>');
        return;
      case 'admin':
        if (auth.level !== 'admin')
          throw auth.level === 'guest'
            ? RestError.unauthorized('需要管理员 token')
            : RestError.forbidden('需要管理员 token');
        return;
    }
  }
}

export function attach_rest(server: TRestServer, ctx: Context, options?: IRestOptions): Rest {
  const rest = new Rest(ctx, options);
  server.on('request', rest.handle);
  return rest;
}

function create_rank_store(options: IRestOptions): IRankStore {
  const allowed_types = to_list(options.ranks_types ?? process.env.RANKS_ALLOWED_TYPES);
  const max_per_type = to_num(options.ranks_max_per_type) ?? to_num(process.env.RANKS_MAX_PER_TYPE);
  const db = to_str(options.ranks_db) ?? to_str(process.env.RANKS_DB);
  if (db) {
    try {
      const store = new SqliteRankMgr(db, { allowed_types, max_per_type });
      console.log(`[RankMgr] 使用 SQLite 存储: ${store.path}`);
      return store;
    } catch (error) {
      console.warn(`[RankMgr] SQLite 不可用，回退到文件存储:`, error instanceof Error ? error.message : error);
    }
  }
  const path = to_str(options.ranks_path) ?? to_str(process.env.RANKS_FILE_PATH) ?? resolve(process.cwd(), DEFAULT_RANKS_FILE);
  return new RankMgr(path, {
    dir: to_str(options.ranks_dir) ?? to_str(process.env.RANKS_DIR),
    allowed_types,
    max_per_type,
  });
}

function create_rank_guard(ranks: IRankStore, options: IRestOptions): RankGuard {
  return new RankGuard({
    dir: dirname(ranks.path),
    max_score: to_num(options.ranks_max_score) ?? to_num(process.env.RANKS_MAX_SCORE),
    audit_path: to_str(options.ranks_audit_path) ?? to_str(process.env.RANKS_AUDIT_PATH),
    bans_path: to_str(options.ranks_bans_path) ?? to_str(process.env.RANKS_BANS_PATH),
    rate_window_ms: to_num(options.ranks_rate_window_ms) ?? to_num(process.env.RANKS_RATE_WINDOW_MS),
    rate_per_token: to_num(options.ranks_rate_per_token) ?? to_num(process.env.RANKS_RATE_PER_TOKEN),
    rate_per_ip: to_num(options.ranks_rate_per_ip) ?? to_num(process.env.RANKS_RATE_PER_IP),
    rate_token_per_ip: to_num(options.ranks_rate_token_per_ip) ?? to_num(process.env.RANKS_RATE_TOKEN_PER_IP),
  });
}
