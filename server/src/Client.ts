import http from 'node:http';
import net from 'node:net';
import type { RawData, WebSocket } from 'ws';
import type { IClientInfo } from '../../src/LFW/ditto/networking/IClientInfo';
import type { Context } from './Context';
import { clamp_nickname } from '../../src/LFW/ditto/networking/nickname';
import {
  ErrCode,
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
import { random_str } from './random_str';

export class Client {
  static readonly TAG = 'Client'
  protected static last_client_id = 0;

  id = `client_${++Client.last_client_id}`;
  secret = random_str(16);
  readonly ws: WebSocket;
  readonly ctx: Context;
  protected _pid = 1;
  protected _jobs = new Map<string, IJob>();
  protected sk: net.Socket;
  client_info?: Required<IClientInfo>;
  room?: Room;
  ready: boolean = false;
  is_admin: boolean = false;
  /** 客户端最近上报的 RTT(ms) */
  rtt: number = 0;
  get info(): IClientInfo | undefined { return this.client_info }
  get full_info(): IFullClientInfo {
    const sk = this.sk;
    return {
      ...this.client_info,
      admin: this.is_admin,
      ready: this.ready,
      room: this.room?.id,
      rtt: this.rtt,
      r_address: sk.remoteAddress,
      r_port: sk.remotePort,
      r_family: sk.remoteFamily,
      l_address: sk.localAddress,
      l_port: sk.localPort,
      l_family: sk.localFamily,
    }
  }
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
        if (err) reject(err); else resolve()
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
    this.ctx.auth.unbind_client(this);
    const { room } = this
    if (room?.owner === this && !room.started) {
      room.close(this);
      ctx.room_mgr.del(room)
    } else if (room?.started) {
      room.disconnect(this)
    } else {
      room?.exit(this);
    }
  }


  private handle_req = (req: TReq) => {
    const { ctx } = this
    switch (req.type) {
      case MsgEnum.ClientInfo: {
        const name = clamp_nickname(req.name?.trim() ?? '')
        const prev = this.client_info
        const client_info = this.client_info = {
          id: this.id,
          name: name || `${this.id}`,
          players: req.players ?? [],
          ready: false,
        }
        this.resp(req.type, req.pid, { client: client_info, secret: this.secret }).catch(() => void 0);
        if (this.room) this.room.broadcast(MsgEnum.ClientInfo, { client: client_info }, this)
        if (this.room && prev) {
          if (prev.name !== client_info.name)
            this.room.system_chat(`玩家[${prev.name}] 改名为 [${client_info.name}]`)
          const len = Math.max(prev.players?.length ?? 0, client_info.players.length)
          for (let i = 0; i < len; i++) {
            const before = prev.players?.[i]
            const after = client_info.players[i]
            if (!after || before === after) continue
            this.room.system_chat(`玩家[${client_info.name}] 的 ${i + 1}P 名称改为 [${after}]`)
          }
        }
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
      case MsgEnum.Rejoin: {
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
          if (room) room.rejoin(this, req);
          else this.resp(
            req.type,
            req.pid,
            { code: ErrCode.RejoinFailed, error: 'room not found' }
          ).catch(() => void 0)
        }
        break;
      }
      case MsgEnum.RejoinFrames: {
        if (
          ensure_player_info(this, req) &&
          ensure_in_room(this, req)
        ) {
          if (!this.room?.rejoin_frames(this, req))
            this.resp(
              req.type,
              req.pid,
              { code: ErrCode.RejoinFailed, error: 'rejoin frames not available' }
            ).catch(() => void 0)
        }
        break;
      }
      case MsgEnum.RoomContinue: {
        if (
          ensure_player_info(this, req) &&
          ensure_in_room(this, req) &&
          ensure_room_owner(this, req)
        ) {
          const { room } = this;
          room?.continue_without_leavers();
          room?.broadcast(req.type, {});
        }
        break;
      }
      case MsgEnum.Abandon: {
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
          if (room) room.abandon(this, req);
          else this.resp(
            req.type,
            req.pid,
            { code: ErrCode.AbandonFailed, error: 'room not found' }
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
        ) {
          const all = Array.from(ctx.room_mgr.all).map(v => v.room_info);
          const rooms = req.show_all ? all : all.filter(v => v.sync_mode !== 'delay');
          this.resp(req.type, req.pid, { rooms }).catch(() => void 0)
        }
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
        this.resp(MsgEnum.ListClients, req.pid, { clients: Array.from(ctx.client_mgr.all).map(v => v.full_info) })
        break;
      case MsgEnum.RoomPwd:
        if (
          ensure_player_info(this, req) &&
          ensure_in_room(this, req) &&
          ensure_room_owner(this, req)
        ) this.room?.set_pwd(this, req)
        break;
      case MsgEnum.RoomSync:
        if (
          ensure_player_info(this, req) &&
          ensure_in_room(this, req) &&
          ensure_room_owner(this, req)
        ) this.room?.set_sync(this, req)
        break;
      case MsgEnum.Ping:
        if (ensure_player_info(this, req)) {
          if (typeof req.rtt === 'number') this.rtt = req.rtt;
          this.resp(req.type, req.pid, { time: req.time, client: this.id, rtt: req.rtt })
        }
        if (this.room)
          this.room.broadcast(req.type, { time: req.time, client: this.id, rtt: req.rtt }, this)
        break;
    }
  }
}

export interface IFullClientInfo extends IClientInfo {
  admin?: boolean;
  ready?: boolean;
  room?: string;
  rtt?: number;
  r_address?: string;
  r_port?: number;
  r_family?: string;
  l_address?: string;
  l_port?: number;
  l_family?: string;
}