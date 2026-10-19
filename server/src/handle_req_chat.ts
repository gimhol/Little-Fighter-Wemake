import type { Client } from './Client';
import { ensure_in_room } from './ensure_in_room';
import { ensure_player_info } from './ensure_player_info';
import { ErrCode, IReqChat, IRespChat, TInfo } from './Net';

export let msg_seq = Date.now();

export function next_msg_seq(): number { return msg_seq++; }

export function handle_req_chat(client: Client, req: IReqChat): void {
  if (!ensure_player_info(client, req)) return;
  const { target, text, type, pid } = req;
  if (!target) {
    client.resp(type, pid, { code: ErrCode.ChatTargetEmpty, error: `target can't be empty` }); return
  }
  if (!text) {
    client.resp(type, pid, { code: ErrCode.ChatMsgEmpty, error: `text can't be empty` });
    return
  }
  const { ctx, room } = client;
  const { client_info: sender } = client;
  const date = Date.now();
  const resp: TInfo<IRespChat> = { sender, date, text, target, seq: next_msg_seq() };
  switch (target) {
    case 'global': {
      for (const c of ctx.client_mgr.all)
        if (c !== client && !c.room)
          c.resp(type, '', resp).catch(() => void 0);
      client.resp(type, pid, resp);
      break;
    }
    case 'room': {
      if (!ensure_in_room(client, req))
        break;
      if (!room) break;
      room?.broadcast(type, resp, client);
      client.resp(type, pid, resp);
      break;
    }
    default: {
      client.resp(type, pid, { code: ErrCode.ChatTargetIncorrect, error: 'target is incorrect' });
      break;
    }
  }
}