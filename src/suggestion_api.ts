import { rank_api_base } from './rank_api';

/** 与服务端 `server/src/rest/SuggestionMgr.ts` 保持一致 */
export const SUGGESTION_TEXT_MAX = 2000;
export const SUGGESTION_TEXT_MIN = 4;
export const SUGGESTION_CONTACT_MAX = 128;
export const SUGGESTION_NAME_MAX = 32;
/** 同一浏览器两次提交之间的最短间隔（服务端还有自己的 IP 限流） */
export const SUGGESTION_COOLDOWN_MS = 30_000;

const LAST_SUBMIT_KEY = 'lfj_any_idea_last_at';

export interface ISuggestionInput {
  text: string;
  name?: string;
  contact?: string;
  version?: string;
  lang?: string;
  page?: string;
  /** 蜜罐字段：正常界面隐藏，机器人可能会填 */
  website?: string;
}

export type TSuggestionResult =
  | { ok: true; id: string; date: number }
  | { ok: false; status: number; error: string };

function last_submit_at(): number {
  try {
    const value = Number(localStorage.getItem(LAST_SUBMIT_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

/** 距离下一次允许提交还剩多少毫秒；0 表示可以提交 */
export function suggestion_cooldown_left(now: number = Date.now()): number {
  const left = last_submit_at() + SUGGESTION_COOLDOWN_MS - now;
  return left > 0 ? left : 0;
}

export function mark_suggestion_sent(): void {
  try {
    localStorage.setItem(LAST_SUBMIT_KEY, `${Date.now()}`);
  } catch {
    // 隐私模式等写不进去时忽略：服务端仍有限流
  }
}

/**
 * 提交建议。
 *
 * 走和排行榜同一个游戏服务器（`RANK_API_URL` / `?RANK_API=`），公开接口、不需要玩家 token。
 * 返回结果而不是抛异常，方便界面区分“内容不合法”“太频繁”“网络不通”等状态。
 */
export async function submit_suggestion(input: ISuggestionInput): Promise<TSuggestionResult> {
  const base = rank_api_base();
  if (!base) return { ok: false, status: 0, error: 'api_unavailable' };

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : void 0;
  const timer = controller ? setTimeout(() => controller.abort(), 15_000) : void 0;
  try {
    const resp = await fetch(`${base}/api/suggestions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller?.signal,
    });
    const data = await resp.json().catch(() => void 0) as
      | { ok?: boolean; id?: string; date?: number; error?: string }
      | undefined;
    if (!resp.ok)
      return { ok: false, status: resp.status, error: data?.error || `HTTP ${resp.status}` };
    return {
      ok: true,
      id: `${data?.id ?? ''}`,
      date: Number(data?.date) || Date.now(),
    };
  } catch (error) {
    const aborted = (error as { name?: string } | null)?.name === 'AbortError';
    return { ok: false, status: 0, error: aborted ? 'timeout' : 'network' };
  } finally {
    if (timer !== void 0) clearTimeout(timer);
  }
}
