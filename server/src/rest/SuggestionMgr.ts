import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { RestError } from './RestError';

export const DEFAULT_SUGGESTIONS_FILE = 'suggestions.jsonl';
export const DEFAULT_SUGGESTION_RATE_WINDOW_MS = 60_000;
export const DEFAULT_SUGGESTION_RATE_PER_IP = 5;
export const MAX_SUGGESTION_TEXT = 2000;
export const MAX_SUGGESTION_CONTACT = 128;
export const MAX_SUGGESTION_NAME = 32;
export const MAX_SUGGESTION_META = 300;

export interface ISuggestionInput {
  text: string;
  name?: string;
  contact?: string;
  version?: string;
  lang?: string;
  page?: string;
}

export interface ISuggestionMeta {
  address?: string;
  agent?: string;
}

export interface ISuggestion {
  id: string;
  date: number;
  text: string;
  name?: string;
  contact?: string;
  version?: string;
  lang?: string;
  page?: string;
  agent?: string;
  address?: string;
}

export interface ISuggestionMgrOptions {
  path?: string;
  rate_window_ms?: number;
  rate_per_ip?: number;
}

export interface ISuggestionList {
  total: number;
  suggestions: ISuggestion[];
}

/** 控制符 / 零宽 / 方向控制：统一剔除，避免污染存储与后台展示 */
const CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/g;
const SINGLE_LINE_PATTERN = /[\p{Cc}\u200b-\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/gu;

function positive_int(value: number | undefined, fallback: number): number {
  const v = Number(value);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

/** 多行文本：保留换行，剔除其余控制符并限制长度 */
export function clean_suggestion_text(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_PATTERN, '')
    .replace(/\t/g, '  ')
    .replace(/[ \u00a0]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_SUGGESTION_TEXT)
    .trim();
}

/** 单行字段：折叠空白并限制长度 */
export function clean_suggestion_field(raw: string | undefined, max: number): string | undefined {
  if (raw === undefined || raw === null) return void 0;
  const text = `${raw}`
    .normalize('NFC')
    .replace(SINGLE_LINE_PATTERN, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, max)
    .trim();
  return text || void 0;
}

function new_id(): string {
  return `s_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
}

/**
 * 玩家建议的轻量存储。
 *
 * 用 JSONL（一行一条）追加写：不需要每次重写整份文件，出问题时也能直接用文本工具查看；
 * 限流按来源 IP 计数，只在内存里保留一个窗口内的提交时间。
 */
export class SuggestionMgr {
  static readonly TAG = 'SuggestionMgr';
  readonly path: string;
  readonly rate_window_ms: number;
  readonly rate_per_ip: number;
  protected _hits = new Map<string, number[]>();
  protected _hits_total = 0;

  constructor(options: ISuggestionMgrOptions = {}) {
    this.path = resolve(options.path?.trim() || join(process.cwd(), DEFAULT_SUGGESTIONS_FILE));
    this.rate_window_ms = positive_int(options.rate_window_ms, DEFAULT_SUGGESTION_RATE_WINDOW_MS);
    this.rate_per_ip = positive_int(options.rate_per_ip, DEFAULT_SUGGESTION_RATE_PER_IP);
  }

  add(input: ISuggestionInput, meta: ISuggestionMeta = {}): ISuggestion {
    const text = clean_suggestion_text(`${input.text ?? ''}`);
    if (!text) throw RestError.bad_request('建议内容不能为空', 'empty_suggestion');
    this.consume(meta.address);

    const suggestion: ISuggestion = {
      id: new_id(),
      date: Date.now(),
      text,
      name: clean_suggestion_field(input.name, MAX_SUGGESTION_NAME),
      contact: clean_suggestion_field(input.contact, MAX_SUGGESTION_CONTACT),
      version: clean_suggestion_field(input.version, 96),
      lang: clean_suggestion_field(input.lang, 24),
      page: clean_suggestion_field(input.page, 32),
      agent: clean_suggestion_field(meta.agent, MAX_SUGGESTION_META),
      address: clean_suggestion_field(meta.address, 64),
    };

    try {
      const dir = dirname(this.path);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      appendFileSync(this.path, `${JSON.stringify(suggestion)}\n`, 'utf8');
    } catch (error) {
      console.error(`[${SuggestionMgr.TAG}] 写入建议失败: ${this.path}`, error);
      throw RestError.internal('保存建议失败');
    }
    return suggestion;
  }

  list(limit: number = 50): ISuggestionList {
    const max = Math.max(1, Math.min(500, Math.floor(limit) || 50));
    const all: ISuggestion[] = [];
    try {
      if (existsSync(this.path)) {
        for (const line of readFileSync(this.path, 'utf8').split('\n')) {
          const text = line.trim();
          if (!text) continue;
          try {
            const value = JSON.parse(text) as Partial<ISuggestion> | null;
            if (!value || typeof value.id !== 'string' || typeof value.text !== 'string' || typeof value.date !== 'number')
              continue;
            all.push(value as ISuggestion);
          } catch {
            // 手工编辑或半行写入：跳过坏行，不影响其余记录
          }
        }
      }
    } catch (error) {
      console.error(`[${SuggestionMgr.TAG}] 读取建议失败: ${this.path}`, error);
    }
    return {
      total: all.length,
      suggestions: all.slice(Math.max(0, all.length - max)).reverse(),
    };
  }

  protected consume(address: string | undefined) {
    const key = address || 'unknown';
    const now = Date.now();
    const hits = (this._hits.get(key) ?? []).filter(v => now - v < this.rate_window_ms);
    if (hits.length >= this.rate_per_ip) {
      const oldest = hits[0] ?? now;
      const retry = Math.max(1, Math.ceil((this.rate_window_ms - (now - oldest)) / 1000));
      throw RestError.too_many_requests(`提交太频繁，请 ${retry} 秒后再试`, 'suggestion_rate_limited');
    }
    hits.push(now);
    this._hits.set(key, hits);
    this._hits_total++;
    if (this._hits_total > 4096) this.prune(now);
  }

  protected prune(now: number) {
    for (const [key, hits] of this._hits) {
      const alive = hits.filter(v => now - v < this.rate_window_ms);
      if (alive.length) this._hits.set(key, alive);
      else this._hits.delete(key);
    }
    this._hits_total = 0;
  }
}
