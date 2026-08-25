import type { RawData, WebSocket } from 'ws';
import type { Context } from './Context';
import {
  ErrCode,
  IClientInfo,
  IJob,
  IMsgReqMap, IMsgRespMap,
  IReq, IResp, ISendOpts,
  MsgEnum, req_timeout_error, req_unknown_error, TInfo, TReq, TResp
} from "./Net.js";
import { Room } from './Room';
import { ensure_admin_info } from './ensure_admin_info';
import { ensure_in_room } from './ensure_in_room';
import { ensure_not_in_room } from './ensure_not_in_room';
import { ensure_player_info } from './ensure_player_info';
import { ensure_room_owner } from './ensure_room_owner';
import { handle_req_chat } from './handle_req_chat';
import { handle_req_tick } from './handle_req_tick';
import http from 'node:http';
import net from 'node:net';

export class Client {
  static readonly TAG = 'Client'
  protected static last_client_id = 0;

  readonly id = `client_${++Client.last_client_id}`;
  readonly ws: WebSocket;
  readonly ctx: Context;
  protected _pid = 1;
  protected _jobs = new Map<string, IJob>();
  protected sk: net.Socket;
  client_info?: Required<IClientInfo>;
  room?: Room;
  ready: boolean = false;
  is_admin: boolean = false;
  constructor(ctx: Context, ws: WebSocket, req: http.IncomingMessage) {
    this.sk = req.socket
    this.ctx = ctx;
    this.ws = ws;
    ctx.client_mgr.all.add(this);
    ws.on('close', this.handle_ws_close)
    ws.on('error', e => console.error(`客户端 ${this.id} 发生错误:`, e));
    ws.on('message', this.handle_ws_msg)
    console.log(`[${Client.TAG}::constructor] address: ${this.sk.remoteAddress}`)
  }

  req<
    T extends MsgEnum,
    Req extends IReq = IMsgReqMap[T],
    Resp extends IResp = IMsgRespMap[T]
  >(type: T, msg: TInfo<Req>, options?: ISendOpts): Promise<Resp> {
    const ws = this.ws;
    if (!ws) return Promise.reject(new Error(`[${Client.TAG}] not open`))
    const pid = `${++this._pid}`;
    const _req: IReq = { pid, type, is_req: true, ...msg };
    delete (_req as any).code;
    delete (_req as any).error;
    return new Promise<Resp>((resolve, reject) => {
      const timeout = options?.timeout || 0;
      const timerId = timeout > 0 ? setTimeout(() => {
        this._jobs.delete(pid);
        const error = req_timeout_error(_req, timeout)
        reject(error);
      }, timeout) : void 0;

      this._jobs.set(pid, { resolve: resolve as any, timerId, reject, ...options });
      try {
        ws.send(JSON.stringify(_req));
      } catch (e) {
        clearTimeout(timerId)
        const error = req_unknown_error(_req, e as Error)
        reject(error)
      }
    });
  }

  resp<T extends MsgEnum, Resp extends IResp = IMsgRespMap[T]>(type: T, pid: string, resp: TInfo<Resp>) {
    return new Promise<void>((resolve, reject) => {
      if (!this.ws)
        return reject(new Error(`ws not open`))
      const _resp: IResp = { pid, type, is_resp: true, ...resp };
      delete (_resp as any).is_req;
      this.ws.send(JSON.stringify(_resp), (err) => {
        err ? reject(err) : resolve()
      });
    })
  }

  private handle_ws_msg = (msg: RawData) => {
    // console.info(`[${Client.TAG}::handle_ws_msg] msg: ${msg}`);
    const str = '' + msg;
    try {
      const what: TReq | TResp = JSON.parse(str);
      if ('is_resp' in what) {
        // TODO: not now
      } else if ('is_req' in what) {
        this.handle_req(what)
      } else {
        // TODO: should not happen
      }
    } catch (error) {
      console.error(`[${Client.TAG}::handle_ws_msg] 解析消息失败: ${error}`);
      this.resp(MsgEnum.Error, '', { code: ErrCode.ParseFailed, error: '消息格式错误' }).catch(() => void 0);
    }
  }

  private handle_ws_close = (code: number, reason: Buffer) => {
    console.log(`[${Client.TAG}::handle_ws_close] ${this.id} code: ${code}, reason: ${reason}`);
    const { ctx } = this
    this.ctx.client_mgr.all.delete(this);
    const { room } = this
    if (room?.owner === this) {
      room.close(this);
      ctx.room_mgr.del(room)
    } else {
      room?.exit(this);
    }
  }


  private handle_req = (req: TReq) => {
    const { ctx } = this
    switch (req.type) {
      case MsgEnum.ClientInfo: {
        const client_info = this.client_info = {
          id: this.id,
          name: req.name?.trim() || `${this.id}`,
          players: req.players ?? [],
        }
        this.resp(req.type, req.pid, { client: client_info }).catch(() => void 0);
        if (this.room) this.room.broadcast(MsgEnum.ClientInfo, { client: client_info }, this)
        console.log(`[${Client.TAG}::${MsgEnum.ClientInfo}] ${JSON.stringify(client_info)}`)
        break;
      }
      case MsgEnum.CreateRoom: {
        if (
          ensure_player_info(this, req) &&
          ensure_not_in_room(this, req)
        ) this.room = new Room(this, req);
        break;
      }
      case MsgEnum.JoinRoom: {
        if (
          ensure_player_info(this, req) &&
          ensure_not_in_room(this, req)
        ) {
          let room: Room | null = null
          for (const r of ctx.room_mgr.all) {
            if (r.id === req.roomid) {
              room = r;
              break;
            }
          }
          if (room) room.join(this, req);
          else this.resp(
            req.type,
            req.pid,
            { code: ErrCode.RoomNotFound, error: 'room not found' }
          ).catch(() => void 0)
        }
        break;
      }
      case MsgEnum.ExitRoom: {
        if (
          ensure_player_info(this, req) &&
          ensure_in_room(this, req)
        ) this.room?.exit(this, req);
        break;
      }
      case MsgEnum.ClientReady: {
        if (
          ensure_player_info(this, req) &&
          ensure_in_room(this, req)
        ) this.room?.ready(this, req);
        break;
      }
      case MsgEnum.CloseRoom: {
        if (
          ensure_player_info(this, req) &&
          ensure_in_room(this, req) &&
          ensure_room_owner(this, req)
        ) this.room?.close(this, req)
        break;
      }
      case MsgEnum.RoomStart: {
        if (
          ensure_player_info(this, req) &&
          ensure_in_room(this, req) &&
          ensure_room_owner(this, req)
        ) this.room?.start(this, req)
        break;
      }
      case MsgEnum.Dataset: {
        if (
          ensure_player_info(this, req) &&
          ensure_in_room(this, req) &&
          ensure_room_owner(this, req)
        ) {
          const { dataset } = req;
          this.resp(req.type, req.pid, {} as any).catch(() => void 0);
          this.room?.broadcast(req.type, { dataset }, this);
        }
        break;
      }
      case MsgEnum.ListRooms: {
        if (
          ensure_player_info(this, req)
        ) this.resp(req.type, req.pid, { rooms: Array.from(ctx.room_mgr.all).map(v => v.room_info) }).catch(() => void 0)
        break;
      }
      case MsgEnum.Kick: {
        const room = this.room
        if (
          ensure_player_info(this, req) &&
          ensure_in_room(this, req) &&
          ensure_room_owner(this, req) &&
          room
        ) {
          room.kick(req)
        }
        break;
      }
      case MsgEnum.Chat:
        handle_req_chat(this, req);
        break;
      case MsgEnum.Tick:
        handle_req_tick(this, req);
        break;
      case MsgEnum.ListClients:
        if (!ensure_admin_info(this, req)) break;
        const clients: IFullClientInfo[] = []
        for (const c of ctx.client_mgr.all) {
          c.sk.localAddress
          clients.push({
            ...c.client_info,
            admin: c.is_admin,
            ready: c.ready,
            r_address: c.sk.remoteAddress,
            r_port: c.sk.remotePort,
            r_family: c.sk.remoteFamily,
            l_address: c.sk.localAddress,
            l_port: c.sk.localPort,
            l_family: c.sk.localFamily,
          })
        }
        this.resp(MsgEnum.ListClients, req.pid, { clients })
        break;
      case MsgEnum.RoomPwd:
        if (
          ensure_player_info(this, req) &&
          ensure_in_room(this, req) &&
          ensure_room_owner(this, req)
        ) this.room?.set_pwd(this, req)
        break;
      case MsgEnum.Ping:
        if (ensure_player_info(this, req))
          this.resp(req.type, req.pid, { time: req.time, client: this.id })
        if (this.room)
          this.room.broadcast(req.type, { time: req.time, client: this.id }, this)
        break;
    }
  }
}

interface IFullClientInfo extends IClientInfo {
  admin?: boolean;
  ready?: boolean;
  r_address?: string;
  r_port?: number;
  r_family?: string;
  l_address?: string;
  l_port?: number;
  l_family?: string;
}