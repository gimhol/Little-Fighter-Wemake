import { MsgEnum } from '../../Net';
import { consume_chat_token, find_chat_recipient, handle_req_chat, msg_seq } from '../../handle_req_chat';
import type { Rest } from '../index';
import { RestError } from '../RestError';
import { body_of, str_of } from '../read_body';
import { require_client } from '../utils';

export function register_me_routes(rest: Rest) {
  const { router, auth } = rest;

  router.get('/api/me', { access: 'player' }, (c) => {
    const player = auth.get_player_token(c.auth.token);
    if (!player) throw RestError.bad_request('该 token 不是玩家 token');
    return {
      token: player.token,
      name: player.name,
      players: player.players,
      created_at: player.created_at,
      last_seen: player.last_seen,
      online: !!player.client,
      client: player.client?.full_info,
      room: player.client?.room?.room_info,
    };
  });

  router.post('/api/me/chat', { access: 'client' }, (c) => {
    const client = require_client(c);
    const body = body_of(c.req.body);
    const text = str_of(body?.text);
    if (!text) throw RestError.bad_request('缺少 text');
    const client_info = client.client_info;
    if (!client_info) throw RestError.conflict('客户端还未上报 ClientInfo');
    const raw_target = str_of(body?.target);
    const target = raw_target === 'global' ? 'global' : raw_target === 'private' ? 'private' : 'room';
    const to = str_of(body?.to);
    if (target === 'private') {
      if (!to) throw RestError.bad_request('缺少 to');
      if (to === client.id) throw RestError.bad_request('不能私聊自己');
      if (!find_chat_recipient(client, to)) throw RestError.not_found('私聊目标不在线');
    }
    if (target === 'room' && !client.room) throw RestError.conflict('客户端不在房间内');
    if (!consume_chat_token(client)) throw RestError.too_many_requests('chat too frequent');
    const seq = msg_seq;
    handle_req_chat(client, { type: MsgEnum.Chat, is_req: true, pid: '', target, to, text }, true);
    return { sender: client_info, date: Date.now(), text, target, to, seq };
  });
}
