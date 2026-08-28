import type { Client } from './Client';
import type { Context } from "./Context";
import {
  ErrCode,
  IMsgRespMap,
  IReqClientReady,
  IReqCloseRoom, IReqCreateRoom,
  IReqExitRoom,
  IReqJoinRoom, IReqKick,
  IReqRoomPwd,
  IReqRoomStart,
  IReqTick,
  IResp,
  IRespClientReady,
  IRespCloseRoom,
  IRespExitRoom,
  IRespJoinRoom, IRespKick,
  IRespTick,
  IDataInfo, IRoomInfo, MsgEnum, SystemPlayerInfo, TInfo
} from "./Net";
import { random_str } from './random_str';

let room_id = 0;
export class Room {
  static TAG = 'Room';
  readonly id = '' + (++room_id);
  readonly ctx: Context;
  protected _code: string = '';
  owner: Client;
  min_players: number = 2;
  max_players: number = 4;
  title: string = `ROOM_${this.id}`;
  clients = new Set<Client>();
  tick_req_map = new Map<Client, IReqTick>()
  private _tick_seq = -1;
  seed: number;
  pwd: string = '';
  lfw_version: string = '';
  data_infos: IDataInfo[] = [];
  get code() { return this._code; }
  get room_info(): Required<IRoomInfo> {
    return {
      title: this.title,
      code: this._code,
      id: this.id,
      owner: this.owner.client_info!,
      clients: Array.from(this.clients).map(v => ({
        ...v.client_info!,
        ready: v.ready
      })),
      min_players: this.min_players,
      max_players: this.max_players,
      started: this._tick_seq >= 0,
      need_pwd: !!this.pwd,
      lfw_version: this.lfw_version,
      data_infos: this.data_infos,
    }
  }
  constructor(owner: Client, req: IReqCreateRoom) {
    const { ctx } = owner
    this.ctx = ctx
    this.owner = owner;
    this.seed = Date.now()
    while (!this._code || ctx.room_mgr.codes.has(this._code)) {
      this._code = random_str();
    }
    ctx.room_mgr.add(this)
    this.title = req.title?.trim() || `${owner.client_info?.name}的房间`
    const { max_players = 4, min_players = 2 } = req
    if (typeof max_players === 'number')
      this.max_players = Math.max(1, Math.floor(max_players))
    if (typeof min_players === 'number')
      this.min_players = Math.max(1, Math.floor(min_players))
    const min = Math.min(this.max_players, this.min_players);
    const max = Math.max(this.max_players, this.min_players);
    this.min_players = min;
    this.max_players = max
    this.lfw_version = req.lfw_version?.trim() ?? ''
    this.data_infos = (req.data_infos ?? []).map(v => ({ ...v }))
    this.clients.add(owner);
    owner.room = this;
    owner.resp(req.type, req.pid, { room: this.room_info })
    console.log(`[${Room.TAG}::constructor] owner: ${this.owner.id}`)
  }

  ready(client: Client, req: IReqClientReady = { type: MsgEnum.ClientReady, is_req: true, pid: '' }) {
    console.log(`[${Room.TAG}::ready]`)
    const { clients: players } = this;
    const { client_info: player_info, room } = client;
    if (!players.has(client)) return false;
    if (!player_info) return false;
    if (room !== this) return false;

    client.ready = req.ready ?? client.ready;
    const resp: TInfo<IRespClientReady> = { client: player_info, ready: client.ready }
    this.broadcast(req.type, resp, client)
    client.resp(req.type, req.pid, resp)
    return true;
  }
  kick(req: IReqKick = { type: MsgEnum.Kick, is_req: true, pid: '' }) {
    const { clients: players } = this;
    let client: Client | null = null
    for (const p of players) {
      if (p.id === req.client_id) {
        client = p;
        break;
      }
    }
    if (!client) return false;
    const { client_info: player_info, room } = client;
    if (room !== this) return false;

    client.ready = false
    delete client.room
    players.delete(client)
    if (this.owner === client && players.size)
      room.owner = players.values().next().value!;
    const { room_info } = this;
    const resp: TInfo<IRespKick> = {
      client: player_info,
      room: room_info
    }
    this.broadcast(req.type, resp, client)
    client.resp(req.type, req.pid, resp).catch(() => void 0)
    if (!this.clients.size)
      this.ctx.room_mgr.del(room)
  }
  exit(client: Client, req: IReqExitRoom = { type: MsgEnum.ExitRoom, is_req: true, pid: '' }) {
    console.log(`[${Room.TAG}::exit]`)
    const { clients: players } = this;
    const { client_info: player_info, room } = client;
    if (!players.has(client)) return;
    if (!player_info) return;
    if (room !== this) return;

    client.ready = false
    delete client.room
    players.delete(client)
    if (this.owner === client && players.size)
      room.owner = players.values().next().value!;
    const { room_info } = this;
    const resp: TInfo<IRespExitRoom> = {
      client: player_info,
      room: room_info
    }
    this.broadcast(req.type, resp, client)
    client.resp(req.type, req.pid, resp).catch(() => void 0)

    if (!players.size)
      this.ctx.room_mgr.del(room)

    for (const pl of players)
      pl.resp(MsgEnum.Chat, '', { target: 'room', sender: SystemPlayerInfo, text: `玩家[${player_info.name}]退出了房间` }).catch(() => void 0)
  }
  join(client: Client, req: IReqJoinRoom = { type: MsgEnum.JoinRoom, is_req: true, pid: '' }) {
    console.log(`[${Room.TAG}::join]`)
    const { clients } = this;
    const { client_info, room } = client;
    if (clients.has(client)) return false;
    if (!client_info) return false;
    if (room) return false;

    if (this.clients.size >= this.max_players) {
      client.resp(req.type, req.pid, { code: ErrCode.RoomIsFull, error: 'Room is full!' })
      return false
    }
    const { pwd: a_pwd = '' } = this;
    const { pwd: b_pwd = '' } = req;
    if (a_pwd != b_pwd) {
      client.resp(req.type, req.pid, { code: ErrCode.RoomPwdWrong, error: 'Wrong password!' })
      return false
    }
    const { lfw_version = '', data_infos = [] } = req
    if (this.lfw_version && this.lfw_version !== (lfw_version?.trim() ?? '')) {
      client.resp(req.type, req.pid, { code: ErrCode.RoomVersionMismatch, error: `LFW 版本不匹配! (房间: ${this.lfw_version}, 你: ${lfw_version})` })
      return false
    }
    const room_md5s = this.data_infos.map(v => v.md5?.trim() ?? '').filter(Boolean)
    if (room_md5s.length) {
      const join_md5s = (data_infos ?? []).map(v => v.md5?.trim() ?? '').filter(Boolean)
      const matched =
        room_md5s.length === join_md5s.length &&
        room_md5s.every(m => join_md5s.includes(m))
      if (!matched) {
        client.resp(req.type, req.pid, {
          code: ErrCode.RoomVersionMismatch,
          error: `数据包 MD5 不匹配! (房间: ${room_md5s.join(', ')}, 你: ${join_md5s.join(', ')})`
        })
        return false
      }
    }
    const all_client_ready = Array.from(this.clients).every(v => v.ready)
    if (this._tick_seq >= 0 || all_client_ready) {
      client.resp(req.type, req.pid, { code: ErrCode.RoomAlreadyStart, error: 'Game of this room has already started!' })
      return false
    }


    clients.add(client);
    client.ready = false
    client.room = this;
    const { room_info } = this;

    const resp: TInfo<IRespJoinRoom> = {
      client: client_info,
      room: room_info
    }
    this.broadcast(req.type, resp, client)
    client.resp(req.type, req.pid, resp).catch(() => void 0)
    for (const pl of clients)
      pl.resp(MsgEnum.Chat, '', { target: 'room', sender: SystemPlayerInfo, text: `玩家[${client_info.name}]加入了房间` }).catch(() => void 0)
    return true;
  }

  close(client: Client, info?: TInfo<IReqCloseRoom>) {
    console.log(`[${Room.TAG}::close]`)
    const req: IReqCloseRoom = { ...info, type: MsgEnum.CloseRoom, is_req: true, pid: '' }
    const { clients: players } = this;
    const { client_info: player_info, room } = client;
    if (!players.has(client)) return;
    if (!player_info) return;
    if (room !== this) return;

    const { room_info } = this
    const resp: TInfo<IRespCloseRoom> = {
      room: room_info
    }
    this.broadcast(req.type, resp, client)
    client.resp(req.type, req.pid, resp).catch(() => void 0)
    for (const pl of players) pl.resp(MsgEnum.Chat, '', { target: 'room', sender: SystemPlayerInfo, text: '房间已关闭' }).catch(() => void 0)
    for (const pl of players) delete pl.room
    players.clear()
    this.ctx.room_mgr.del(this)
  }

  start(client: Client, info?: TInfo<IReqRoomStart>) {
    const req: IReqRoomStart = { ...info, is_req: true, type: MsgEnum.RoomStart, pid: '' }
    const { clients: players } = this;
    if (players.size < this.min_players) {
      client.resp(req.type, req.pid, { code: ErrCode.PlayersTooFew, error: 'players are too few' }).catch(() => void 0)
      return;
    }

    this.broadcast(req.type, { seed: this.seed }, client)
    client.resp(req.type, req.pid, { seed: this.seed }).catch(() => void 0)
    this._tick_seq = 0
  }

  broadcast<T extends MsgEnum, Resp extends IResp = IMsgRespMap[T]>(type: T, resp: TInfo<Resp>, ...excludes: Client[]) {
    for (const c of this.clients)
      if (!excludes.some(v => v === c))
        c.resp(type, '', resp).catch(e => { })
  }

  tick(client: Client, req: IReqTick) {
    if (req.seq !== this._tick_seq)
      return;
    req.client_id = client.client_info?.id;
    if (this._tick_seq === 0)
      req.client_name = client.client_info?.name;
    this.tick_req_map.set(client, req)
    if (this.tick_req_map.size !== this.clients.size)
      return;
    const resp: TInfo<IRespTick> = { seq: this._tick_seq, reqs: [] }
    for (const [, req] of this.tick_req_map)
      resp.reqs?.push(req)
    this.broadcast(MsgEnum.Tick, resp)
    this.tick_req_map.clear()
    this._tick_seq++;
  }

  set_pwd(client: Client, req: IReqRoomPwd) {
    this.pwd = req.pwd ?? '';
  }
}
