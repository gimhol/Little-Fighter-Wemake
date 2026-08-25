import { Callbacks } from "@/LFW/base";
import {
  type IClientInfo,
  type IConnError, type IJob, type IMsgReqMap, type IMsgRespMap,
  type IReq, type IResp,
  type IRespClientInfo, type IRoomInfo, type ISendOpts, MsgEnum, req_timeout_error,
  req_unknown_error, resp_error, type TInfo, type TReq, type TResp
} from "../../Net";

export interface IConnectionCallbacks {
  once?: boolean;
  on_open?(conn: Connection): void;
  on_close?(e: CloseEvent, conn: Connection): void;
  on_register?(resp: IRespClientInfo, conn: Connection): void;
  on_error?(error: IConnError, conn: Connection): void;
  on_message?(resp: TResp, conn: Connection): void;
  on_room_change?(room: IRoomInfo | undefined, conn: Connection): void;
  on_rooms_change?(rooms: IRoomInfo[], conn: Connection): void;
  on_ping?(resp: IMsgRespMap[MsgEnum.Ping], conn: Connection): void;
}

export class Connection {
  static TAG: string = 'Connection';
  readonly callbacks = new Callbacks<IConnectionCallbacks>()
  protected _pid = 1;
  protected _reopen?: () => void;
  protected _jobs = new Map<string, IJob>();
  protected _ws: WebSocket | null = null;
  protected _client?: IClientInfo;
  protected _players: string[] = []
  protected _nickname: string;
  protected _urls: string[] = []
  protected _rtt: number = 0;
  protected _ping_job_timer: number = 0;
  get rtt() { return this._rtt; }
  get client(): IClientInfo | undefined { return this._client }
  get nickname(): string { return this._nickname }
  room?: IRoomInfo;
  rooms: IRoomInfo[] = [];
  get url() { return this._ws?.url }

  constructor(nickname: string = '') {
    this._nickname = nickname;
  }
  set_nickname(nickname: string) {
    this._nickname = nickname;
    if (this._ws?.readyState === this._ws?.OPEN)
      this._submit_client();
  }
  set_players(players: string[]) {
    this._players = [...players];
    if (this._ws?.readyState === this._ws?.OPEN)
      this._submit_client();
  }
  protected _submit_client() {
    this.send(MsgEnum.ClientInfo, {
      name: this._nickname,
      players: this._players,
    }, {
      timeout: 1000
    }).then((resp) => {
      this._client = resp.client;
    }).catch((e) => {
      this.close();
      throw e;
    })
  }
  protected _on_open = () => {
    console.log(`[${Connection.TAG}::_on_open]`);
    this._urls.length = 0;
    this.callbacks.call('on_open', this)
    this.send(MsgEnum.ClientInfo, {
      name: this._nickname,
      players: this._players,
    }, {
      timeout: 1000
    }).then((resp) => {
      this.start_ping_job();
      this._client = resp.client;
      this.callbacks.call('on_register', resp, this)
    }).catch((e) => {
      this.close();
      throw e;
    })

  }
  protected _on_message = (event: MessageEvent<any>) => {
    // console.log(`[${Connection.TAG}::_on_message]`, event.data);
    try {
      const what = JSON.parse(event.data) as TResp | TReq;
      if ('is_resp' in what) {
        const { pid, code } = what;
        const job = this._jobs.get(pid);
        const err = code ? resp_error(what) : void 0
        if (err) {
          this.callbacks.call('on_error', err, this)
        } else {
          this.handle_resp(what)
        }
        if (!job) return;
        this._jobs.delete(pid);
        if (job.timerId) clearTimeout(job.timerId);
        if (code && !job.loose) {
          job.reject(err);
        } else {
          job.resolve(what);
        }
      } else if ('is_req' in what) {
        // TODO: not now
      } else {
        // TODO: should not happen
      }
    } catch (error) {
      console.error(`[${Connection.TAG}::_on_message] 解析消息失败: ${error}`);
      // TODO
    }
  }
  protected _on_close = (e: CloseEvent) => {
    console.log(`[${Connection.TAG}::_on_close]`);
    this.stop_ping_job();
    if (this._urls.length) {
      this.try_url(this._urls.shift())
      return;
    }

    if (this.room)
      this.callbacks.call('on_room_change', this.room = void 0, this)
    if (this.rooms.length)
      this.callbacks.call('on_rooms_change', this.rooms = [], this)
    this.callbacks.call('on_close', e, this)
    this._ws = null;
  }

  open(url: string) {
    url = url.trim()
    switch (this._ws?.readyState) {
      case WebSocket.CONNECTING:
      case WebSocket.OPEN:
      case WebSocket.CLOSING:
        this._ws.close();
        if (this._reopen) this._ws.removeEventListener('close', this._reopen);
        this._reopen = () => this.open(url)
        this._ws.addEventListener('close', this._reopen, { once: true });
        return;
    }
    const protocols: string[] = ['wss://', 'ws://', 'https://', 'http://']
    this._reopen = void 0;
    if (protocols.some(protocol => url.startsWith(protocol)))
      this._urls = [url]
    else
      this._urls = protocols.map(protocol => `${protocol}${url}`)
    this.try_url(this._urls.shift())
  }
  protected try_url(url: string | undefined) {
    console.info(`[${Connection.TAG}::try_url] url: `, url)
    if (!url) return;
    try {
      this._ws = new WebSocket(url)
      this._ws.addEventListener('message', this._on_message);
      this._ws.addEventListener('open', this._on_open);
      this._ws.addEventListener('close', this._on_close);
    } catch (e) {
      console.error(`[${Connection.TAG}] error:`, e)
    }
  }

  close() {
    this._ws?.close()
    this._ws = null
  }

  send<
    T extends MsgEnum,
    Req extends IReq = IMsgReqMap[T],
    Resp extends IResp = IMsgRespMap[T]
  >(type: T, msg: TInfo<Req>, options?: ISendOpts): Promise<Resp> {
    const ws = this._ws;
    if (!ws || ws.readyState !== ws.OPEN)
      return Promise.reject(new Error(`[${Connection.TAG}] not open`))
    const pid = `${++this._pid}`;
    const _req: IReq = { pid, type, is_req: true, ...msg };
    return new Promise<Resp>((resolve, reject) => {
      const timeout = options?.timeout || 0;
      const timerId = timeout > 0 ? setTimeout(() => {
        this._jobs.delete(pid);
        const error = req_timeout_error(_req, timeout)
        this.callbacks.call('on_error', error, this)
        reject(error);
      }, timeout) : void 0;

      this._jobs.set(pid, { resolve: resolve as any, timerId, reject, ...options });
      try {
        ws.send(JSON.stringify(_req));
      } catch (e) {
        clearTimeout(timerId)
        const error = req_unknown_error(_req, e as Error)
        this.callbacks.call('on_error', error, this)
        reject(error)
      }
    });
  }

  handle_resp(resp: TResp) {
    this.callbacks.call('on_message', resp, this)
    switch (resp.type) {
      case MsgEnum.JoinRoom:
      case MsgEnum.CreateRoom:
        this.callbacks.call('on_room_change', this.room = resp.room, this)
        break;
      case MsgEnum.CloseRoom:
        this.callbacks.call('on_room_change', this.room = void 0, this)
        break;
      case MsgEnum.ExitRoom:
      case MsgEnum.Kick:
        const room = resp.client?.id === this._client?.id ? void 0 : resp.room
        this.callbacks.call('on_room_change', this.room = room, this)
        break;
      case MsgEnum.ClientReady: {
        const prev = this.room
        if (prev) {
          const room = { ...prev }
          if (room.clients)
            for (const p of room.clients)
              if (p.id === resp.client?.id)
                p.ready = !!resp.ready;
          if (room.clients) room.clients = [...room.clients]
          this.callbacks.call('on_room_change', this.room = room, this)
        }
        break;
      }
      case MsgEnum.ClientInfo: {
        const prev = this.room
        if (prev) {
          const room = { ...prev }
          if (room.clients)
            for (const p of room.clients)
              if (p.id === resp.client?.id)
                Object.assign(p, resp.client)
          if (room.clients) room.clients = [...room.clients]
          this.callbacks.call('on_room_change', this.room = room, this)
        }
        break;
      }
      case MsgEnum.ListRooms: {
        this.callbacks.call('on_rooms_change', this.rooms = resp.rooms ?? [], this)
        break;
      }
      case MsgEnum.Ping: {
        if (resp.client === this._client?.id)
          this._rtt = Date.now() - resp.time;
        this.callbacks.call("on_ping", resp, this);
        break;
      }
    }
  }
  ping() {
    // 携带上次测得的真实 RTT，供房间内其他成员显示
    this.send(MsgEnum.Ping, { time: Date.now(), rtt: this._rtt || void 0 })
  }
  start_ping_job() {
    this.stop_ping_job();
    this._ping_job_timer = window.setInterval(() => this.ping(), 500);
  }
  stop_ping_job() {
    if (!this._ping_job_timer) return;
    clearInterval(this._ping_job_timer);
  }
}

