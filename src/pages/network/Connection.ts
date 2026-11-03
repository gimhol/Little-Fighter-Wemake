import { Callbacks } from "@/LFW/base";
import {
  clamp_nickname,
  type IClientInfo,
  type IConnError, type IJob, type IMsgReqMap, type IMsgRespMap,
  type IReq, type IResp,
  type IRespClientInfo, type IRespRejoin, type IRespRejoinFrames, type IRoomInfo, type ISendOpts, MsgEnum, req_timeout_error,
  req_unknown_error, resp_error, type TInfo, type TReq, type TResp, type TRejoinTick
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
  on_reconnecting?(attempt: number, conn: Connection): void;
  on_rejoin?(resp: IRespRejoin, conn: Connection): void;
  on_rejoin_failed?(reason: 'rejected' | 'timeout', conn: Connection): void;
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
  protected _secret?: string;
  protected _rejoin_provider?: () => number;
  protected _resume_client_id?: string;
  protected _reconnecting = false;
  protected _reconnect_attempt = 0;
  protected _reconnect_timer = 0;
  protected _last_url = '';
  protected _dead = false;
  get rtt() { return this._rtt; }
  get client(): IClientInfo | undefined { return this._client }
  get nickname(): string { return this._nickname }
  get reconnecting() { return this._reconnecting }
  room?: IRoomInfo;
  rooms: IRoomInfo[] = [];
  get url() { return this._ws?.url }
  get opened() { return this._ws?.readyState === 1 }

  constructor(nickname: string = '') {
    this._nickname = clamp_nickname(nickname);
  }
  set_nickname(nickname: string): void {
    this._nickname = clamp_nickname(nickname);
    if (this.opened) this._submit_client();
  }
  set_players(players: string[]): void {
    this._players = [...players];
    if (this.opened) this._submit_client();
  }
  protected _submit_client(): void {
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
      this.start_ping();
      this._client = resp.client;
      if (!this._reconnecting) this._secret = resp.secret ?? this._secret;
      this.callbacks.call('on_register', resp, this)
      if (this._reconnecting) this._submit_rejoin();
    }).catch((e) => {
      this.close();
      throw e;
    })

  }
  protected _on_message = (event: MessageEvent<unknown>) => {
    // console.log(`[${Connection.TAG}::_on_message]`, event.data);

    try {
      const what = JSON.parse(event.data as string) as TResp | TReq;
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
    this.stop_ping();
    this._ws = null;
    if (this._urls.length) {
      this.try_url(this._urls.shift())
      return;
    }

    if (this._rejoin_provider && this.room && this._client) {
      this._schedule_reconnect();
      return;
    }
    this._teardown(e);
  }

  enable_rejoin(provider: () => number): void {
    this._rejoin_provider = provider;
  }
  disable_rejoin(): void {
    this._rejoin_provider = void 0;
  }
  protected _teardown(e?: CloseEvent): void {
    if (this._dead) return;
    this._dead = true;
    this._cancel_reconnect();
    this._rejoin_provider = void 0;
    this._resume_client_id = void 0;
    if (this.room)
      this.callbacks.call('on_room_change', this.room = void 0, this)
    if (this.rooms.length)
      this.callbacks.call('on_rooms_change', this.rooms = [], this)
    this.callbacks.call('on_close', e as CloseEvent, this)
  }
  async abandon(): Promise<void> {
    const roomid = this.room?.id;
    const client_id = this._resume_client_id ?? this._client?.id;
    if (this._ws?.readyState !== WebSocket.OPEN || !roomid || !client_id || !this._secret)
      return;
    try {
      await this.send(MsgEnum.Abandon, { roomid, client_id, secret: this._secret }, { timeout: 1000 })
    } catch (e) {
      console.warn(`[${Connection.TAG}::abandon]`, e)
    }
  }
  async give_up(): Promise<void> {
    try {
      await this.abandon();
    } catch (e) {
      console.warn(`[${Connection.TAG}::give_up]`, e)
    } finally {
      this.close();
    }
  }
  protected _cancel_reconnect(): void {
    if (this._reconnect_timer) {
      clearTimeout(this._reconnect_timer);
      this._reconnect_timer = 0;
    }
    this._reconnecting = false;
    this._reconnect_attempt = 0;
  }
  protected _schedule_reconnect(): void {
    if (this._reconnect_timer) return;
    this._reconnecting = true;
    if (!this._resume_client_id) this._resume_client_id = this._client?.id;
    this._reconnect_attempt++;
    if (this._reconnect_attempt > 30) {
      this._reconnecting = false;
      this._rejoin_provider = void 0;
      this.callbacks.call('on_rejoin_failed', 'timeout', this);
      return;
    }
    const ws = this._ws;
    this._ws = null;
    if (ws) {
      ws.removeEventListener('close', this._on_close);
      ws.close();
    }
    this.callbacks.call('on_reconnecting', this._reconnect_attempt, this);
    const delay = Math.min(300 * this._reconnect_attempt, 3000);
    this._reconnect_timer = window.setTimeout(() => {
      this._reconnect_timer = 0;
      if (!this._rejoin_provider) return;
      this.try_url(this._last_url || this._urls[0]);
    }, delay);
  }
  protected _submit_rejoin(): void {
    const provider = this._rejoin_provider;
    if (!provider) return;
    const from_seq = provider();
    const roomid = this.room?.id;
    const client_id = this._resume_client_id ?? this._client?.id;
    if (typeof from_seq !== 'number' || from_seq < 0 || !roomid || !client_id || !this._secret) {
      this._teardown();
      return;
    }
    this.send(MsgEnum.Rejoin, { roomid, client_id, secret: this._secret, from_seq }, { timeout: 5000 })
      .then(async (resp) => {
        const resps = await this._pull_rejoin_frames(resp)
        this._cancel_reconnect();
        this._resume_client_id = void 0;
        if (resp.client) this._client = resp.client;
        if (resp.room) this.callbacks.call('on_room_change', this.room = resp.room, this);
        this.callbacks.call('on_rejoin', { ...resp, resps }, this);
      })
      .catch((e) => {
        const code = (e as IConnError)?.lfw?.code;
        if (typeof code === 'number') {
          this._cancel_reconnect();
          this._rejoin_provider = void 0;
          this.abandon().finally(() => this.callbacks.call('on_rejoin_failed', 'rejected', this));
          return;
        }
        this._schedule_reconnect();
      })
  }

  /** 分批拉取归队回放帧（服务端一次只发一包，避免单条消息过大） */
  protected async _pull_rejoin_frames(resp: IRespRejoin): Promise<TRejoinTick[]> {
    const resps: TRejoinTick[] = resp.resps ? [...resp.resps] : [];
    let done = resp.done ?? true;
    let from = (resp.from_seq ?? 0) + resps.length;
    while (!done) {
      const chunk: IRespRejoinFrames = await this.send(MsgEnum.RejoinFrames, { from_seq: from }, { timeout: 15000 });
      const part = chunk.resps ?? [];
      if (!part.length) break;
      resps.push(...part);
      from += part.length;
      done = !!chunk.done;
    }
    return resps;
  }

  open(url: string): void {
    url = url.trim()
    this._dead = false;
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
    this._last_url = url;
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
    this._cancel_reconnect();
    this._rejoin_provider = void 0;
    const ws = this._ws;
    this._ws = null;
    if (ws) {
      ws.close();
    } else {
      this._teardown();
    }
  }

  /**
   * 发送不需要回包的请求（不创建 job、不返回 Promise，避免每帧一个泄漏的 job）
   */
  send_nowait<
    T extends MsgEnum,
    Req extends IReq = IMsgReqMap[T]
  >(type: T, msg: TInfo<Req>): void {
    const ws = this._ws;
    if (!ws || ws.readyState !== ws.OPEN) return;
    const _req: IReq = { pid: `${++this._pid}`, type, is_req: true, ...msg };
    try {
      ws.send(JSON.stringify(_req));
    } catch (e) {
      this.callbacks.call('on_error', req_unknown_error(_req, e as Error), this)
    }
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
      // FIXME: as any?
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
      case MsgEnum.RoomSync:
        this.callbacks.call('on_room_change', this.room = resp.room, this)
        break;
      case MsgEnum.Rejoin:
        if (resp.room)
          this.callbacks.call('on_room_change', this.room = resp.room, this)
        break;
      case MsgEnum.CloseRoom:
        this.callbacks.call('on_room_change', this.room = void 0, this)
        break;
      case MsgEnum.ExitRoom:
      case MsgEnum.Kick: {
        const room = resp.client?.id === this._client?.id ? void 0 : resp.room
        this.callbacks.call('on_room_change', this.room = room, this)
        break;
      }
      case MsgEnum.ClientReady: {
        const prev = this.room
        if (!prev) break;
        const room = { ...prev }
        if (room.clients) {
          for (const p of room.clients)
            if (p.id === resp.client?.id)
              p.ready = !!resp.ready;
          room.clients = [...room.clients]
        }
        this.callbacks.call('on_room_change', this.room = room, this)
        break;
      }
      case MsgEnum.ClientInfo: {
        const prev = this.room
        if (!prev) break;
        const room = { ...prev }
        if (room.clients) {
          for (const p of room.clients)
            if (p.id === resp.client?.id)
              Object.assign(p, resp.client)
          room.clients = [...room.clients]
        }
        this.callbacks.call('on_room_change', this.room = room, this)
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
  private send_ping(): void {
    if (!this.opened) return;
    // 携带上次测得的真实 RTT，供房间内其他成员显示
    this.send(MsgEnum.Ping, { time: Date.now(), rtt: this._rtt || void 0 })
  }
  start_ping(): void {
    this.stop_ping();
    this._ping_job_timer = window.setInterval(() => this.send_ping(), 500);
  }
  stop_ping(): void {
    if (!this._ping_job_timer) return;
    clearInterval(this._ping_job_timer);
  }
}

