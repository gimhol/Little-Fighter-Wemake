import type { Rest } from '../index';
import { body_of, str_of } from '../read_body';
import { RestError } from '../RestError';
import { MAX_SUGGESTION_TEXT } from '../SuggestionMgr';
import { query_int } from '../utils';

/**
 * 玩家建议箱。
 *
 * POST 是公开接口（不要求玩家 token，进游戏前也能提建议），靠 IP 限流 + 长度上限挡刷；
 * GET 需要管理员 token，供管理页 / 命令行查看。
 */
export function register_suggestion_routes(rest: Rest) {
  const { router, suggestions } = rest;

  router.post('/api/suggestions', (c) => {
    const body = body_of(c.req.body);

    // 蜜罐字段：正常用户看不到也不会填，机器人往往会填；假装成功但不落盘
    if (str_of(body?.website)) return { ok: true, id: '', date: Date.now() };

    const text = str_of(body?.text);
    if (!text) throw RestError.bad_request('缺少建议内容', 'missing_text');
    if (text.length > MAX_SUGGESTION_TEXT)
      throw RestError.bad_request(`建议内容不能超过 ${MAX_SUGGESTION_TEXT} 个字符`, 'text_too_long');

    const suggestion = suggestions.add(
      {
        text,
        name: str_of(body?.name),
        contact: str_of(body?.contact),
        version: str_of(body?.version),
        lang: str_of(body?.lang),
        page: str_of(body?.page),
      },
      {
        address: c.req.raw.socket.remoteAddress ?? void 0,
        agent: `${c.req.raw.headers['user-agent'] ?? ''}`.slice(0, 300) || void 0,
      },
    );

    return { ok: true, id: suggestion.id, date: suggestion.date };
  });

  router.get('/api/suggestions', { access: 'admin' }, (c) => {
    const limit = query_int(c.req.query, 'limit', 50, 1, 500);
    return suggestions.list(limit);
  });
}
