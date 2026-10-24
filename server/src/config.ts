import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import JSON5 from 'json5';

export interface IRestConfig {
  log?: boolean;
  max_body_size?: number;
}

export interface IRanksConfig {
  path?: string;
  dir?: string;
  db?: string;
  allowed_types?: string | string[];
  max_per_type?: number;
  /** 分数上限：超过直接拒绝（防作弊第一道闸） */
  max_score?: number;
  audit_path?: string;
  bans_path?: string;
  rate_window_ms?: number;
  rate_per_token?: number;
  rate_per_ip?: number;
  rate_token_per_ip?: number;
}

export interface IServerConfig {
  http_host?: string;
  http_port?: number;
  https_port?: number;
  ssl_key_file_path?: string;
  ssl_cert_file_path?: string;
  admin_tokens?: string | string[];
  rest?: IRestConfig;
  ranks?: IRanksConfig;
}

export interface ILoadedConfig {
  path: string;
  explicit: boolean;
  loaded: boolean;
  config: IServerConfig;
}

export const DEFAULT_CONFIG_FILES = ['server.config.json5', 'server.config.json'] as const;
export const DEFAULT_CONFIG_FILE = DEFAULT_CONFIG_FILES[0];

function find_default_config(): string | undefined {
  for (const name of DEFAULT_CONFIG_FILES) {
    const path = resolve(name);
    if (existsSync(path)) return path;
  }
  return void 0;
}

export function to_str(value: unknown): string | undefined {
  if (value === undefined || value === null) return void 0;
  const v = `${value}`.trim();
  return v || void 0;
}

export function to_num(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return void 0;
  const v = Number(value);
  return Number.isFinite(v) ? v : void 0;
}

export function to_bool(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return void 0;
  if (typeof value === 'boolean') return value;
  const v = `${value}`.trim().toLowerCase();
  if (!v) return void 0;
  return !['0', 'false', 'no', 'off'].includes(v);
}

export function to_list(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return void 0;
  const list = (Array.isArray(value) ? value : `${value}`.split(','))
    .map(v => `${v}`.trim())
    .filter(Boolean);
  return list.length ? Array.from(new Set(list)) : void 0;
}

export function load_config(value?: string): ILoadedConfig {
  const explicit_path = to_str(value);
  const path = explicit_path ? resolve(explicit_path) : find_default_config() ?? resolve(DEFAULT_CONFIG_FILE);
  if (!existsSync(path)) {
    if (explicit_path) {
      console.error(`[Config] 找不到配置文件: ${path}`);
      process.exit(1);
    }
    return { path, explicit: false, loaded: false, config: {} };
  }
  try {
    const parsed = JSON5.parse(readFileSync(path, 'utf8')) as IServerConfig;
    const config = parsed && typeof parsed === 'object' ? parsed : {};
    console.log(`[Config] 已加载 ${path}`);
    return { path, explicit: !!explicit_path, loaded: true, config };
  } catch (error) {
    console.error(`[Config] 配置文件解析失败: ${path}`, error);
    process.exit(1);
  }
}
