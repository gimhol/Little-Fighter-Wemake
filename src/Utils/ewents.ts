
export class Ewents {

  static readonly TAG: string = 'Events'
  static readonly VERSION: string = '2'
  static readonly VERSION_KEY: string = `events_fingerprint#version`
  static readonly DATA_KEY: string = `events_fingerprint#data`
  static readonly CLICK_SIGNAL: string = 'ewents-click'
  private _mounted: boolean = false;
  private _location: string = ''
  private _page: string = ''
  private _seq: number = -1
  private _src_history_push_state: typeof history.pushState | null = null;
  private _new_history_push_state: typeof history.pushState | null = null;
  private _handle_click = (e: MouseEvent) => {
    if (e.target instanceof HTMLElement) {
      this.submit_click(e.target)
    }
  }
  private _handle_popstate = () => this.submit_visit()
  private _fingerprint: string = '';
  filter: <T extends object>(type: string, event: T) => Promise<boolean> = () => Promise.resolve(true);

  constructor() {
    this.init()
  }

  private init() {
    if (localStorage.getItem(Ewents.VERSION_KEY) !== Ewents.VERSION) {
      localStorage.removeItem(Ewents.VERSION_KEY)
      localStorage.removeItem(Ewents.DATA_KEY)
    }
    this._fingerprint = localStorage.getItem(Ewents.DATA_KEY) ?? ''
    if (!this._fingerprint) {
      this.read_fingerprint()
    }
  }

  read_fingerprint(): string {
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `e${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
    this._fingerprint = id
    try {
      localStorage.setItem(Ewents.DATA_KEY, id)
      localStorage.setItem(Ewents.VERSION_KEY, Ewents.VERSION)
    } catch (e: unknown) {
      console.error(`[${Ewents.TAG}::read_fingerprint] failed, reason: `, e)
    }
    return id
  }

  async get_fingerprint(): Promise<string> {
    return this._fingerprint || this.read_fingerprint()
  }

  mount() {
    if (this._mounted) return
    this._mounted = true;
    window.addEventListener('popstate', this._handle_popstate);
    document.addEventListener(`click`, this._handle_click, { capture: true });
    if (!this._src_history_push_state && !this._new_history_push_state) {
      this._src_history_push_state = history.pushState
      this._new_history_push_state = (...args) => {
        this._src_history_push_state?.apply(history, args);
        this.submit_visit();
      }
      history.pushState = this._new_history_push_state;
    }
  }
  unmount() {
    if (!this._mounted) return
    window.removeEventListener('popstate', this.submit_visit);
    document.removeEventListener(`click`, this._handle_click);
    if (history.pushState == this._new_history_push_state && this._src_history_push_state) {
      history.pushState = this._src_history_push_state
    }
    this._mounted = false;
    this._location = ''
    this._page = ''
    this._seq = -1;
    this._src_history_push_state = null;
    this._new_history_push_state = null;
  }

  submit_visit() {
    const curr_location = location.toString();
    if (this._location == curr_location) return;
    this._location = curr_location;
    this.submit_any('visit', { uri: curr_location });
  }

  submit_page(page_id?: string) {
    if (!this._mounted) return
    const page = page_id ?? ''
    if (this._page === page) return
    this._page = page
    if (!page) return
    this.submit_any('visit', { uri: location.toString(), page })
  }

  submit_click(el: HTMLElement) {
    let ele: HTMLElement | null = el
    while (ele) {
      const what_text = ele.getAttribute(Ewents.CLICK_SIGNAL)
      if (!what_text) {
        ele = ele.parentElement
        continue;
      }
      let what: object = {}
      try {
        what = JSON.parse(what_text) as unknown as object
      } catch (e: unknown) {
        console.warn(`[${Ewents.TAG}::submit_click] failed, ${Ewents.CLICK_SIGNAL} is not an json string`, e)
      }
      if (what) return this.submit_any('click', { what })
    }
  }

  submit_any<T extends object>(type: string, event: T) {
    this.filter(type, event).then((filted) => {
      if (!filted) return null
      return this.get_fingerprint()
    }).then((r) => {
      if (!r) return
      const headers = {
        'Content-Type': 'application/json',
        "Fingerprint": r,
      }
      return fetch(`https://gim.ink/api/events/add?type=${type}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...event,
          seq: ++this._seq,
          time: new Date(),
          ua: navigator.userAgent,
        }),
        mode: 'cors',
      })
    }).catch((e: unknown) => {
      console.error(`[${Ewents.TAG}::submit_any] failed, cant no get fingerprint, reason: `, e)
    })
  }
  click(name: string, data: object = {}) {
    return {
      [Ewents.CLICK_SIGNAL]: JSON.stringify({
        name,
        ...data
      })
    }
  }

}

export const ewents = new Ewents()