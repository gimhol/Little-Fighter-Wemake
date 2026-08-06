import { CMD } from "@/LFW/defines/CMD";
import { LFW } from "../LFW";
import { Callbacks } from "../LFW/base/Callbacks";
import { NoEmitCallbacks } from "../LFW/base/NoEmitCallbacks";
import type { IKeyboard } from "../LFW/ditto/keyboard/IKeyboard";
import type { IKeyboardCallback } from "../LFW/ditto/keyboard/IKeyboardCallback";
import type { IKeyEvent } from "../LFW/ditto/keyboard/IKeyEvent";

class __KeyEvent implements IKeyEvent {
  readonly times: number;
  readonly key: string;
  readonly native: KeyboardEvent | undefined;
  readonly pressed: boolean;
  readonly device_type: 'keyboard' | 'controller' | 'touch';
  constructor(
    key: string,
    pressed: boolean,
    device_type: 'keyboard' | 'controller' | 'touch',
    times: number = 0,
    e: KeyboardEvent | undefined = void 0
  ) {
    this.key = key;
    this.device_type = device_type;
    this.pressed = pressed;
    this.times = times;
    this.native = e;

  }
  stopImmediatePropagation = () => this.native?.stopImmediatePropagation();
  stopPropagation = () => this.native?.stopPropagation();
  preventDefault = () => this.native?.preventDefault();
  interrupt = () => {
    this.stopImmediatePropagation()
    this.stopPropagation()
    this.preventDefault()
  }
}
export interface __IKeyboardCallback extends IKeyboardCallback {
}
export class __Keyboard implements IKeyboard {
  static TAG = '__Keyboard';
  enabled: boolean = true;
  protected _callback = new Callbacks<__IKeyboardCallback>();
  protected _times_map = new Map<string, number>();
  protected lfw: LFW;
  protected _axe_dead_zone = 0.12;
  protected _axe_live_zone = 0.22;
  get callback(): NoEmitCallbacks<__IKeyboardCallback> {
    return this._callback;
  }
  protected _on_key_down = (e: KeyboardEvent) => {
    if (!this.enabled) return;
    const key_code = e.key?.toLowerCase() || "";
    this.key_down(key_code, 'keyboard', e)
  };

  protected _on_key_up = (e: KeyboardEvent) => {
    if (!this.enabled) return;
    const key_code = e.key?.toLowerCase() || "";
    this.key_up(key_code, 'keyboard', e)
  };
  key_down(key_code: string, gamepad: 'controller' | 'keyboard' | 'touch', e?: KeyboardEvent) {
    const times = this._times_map.get(key_code) ?? -1;
    this._times_map.set(key_code, times + 1);
    this._callback.call("on_key_down", new __KeyEvent(key_code, true, gamepad, times + 1, e));
  };
  key_up(key_code: string, gamepad: 'controller' | 'keyboard' | 'touch', e?: KeyboardEvent) {
    this._times_map.delete(key_code);
    this._callback.call("on_key_up", new __KeyEvent(key_code, false, gamepad, 0, e));
  };
  protected gamepads: (Gamepad | null)[] = [];
  protected gamepad_timer?: ReturnType<typeof setInterval>;
  protected gamepad_buttons = new Map<string, 0 | 1>();
  protected gamepad_axes: (readonly number[])[] = []

  constructor(lfw: LFW) {
    this.lfw = lfw;
    window.addEventListener("keydown", this._on_key_down);
    window.addEventListener("keyup", this._on_key_up);
    this.gamepad_timer = setInterval(this.scan_gamepad_buttons.bind(this), 1000 / 60)
  }
  protected scan_gamepad_buttons() {
    const gamepads = this.gamepads = navigator.getGamepads()
    if (!gamepads?.length) return;

    for (let i = 0; i < gamepads.length; i++) {
      const gamepad = gamepads[i];
      if (!gamepad) continue;
      const { buttons, index } = gamepad;
      if (buttons?.length) for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        const btn_code = i as GPBtnCode
        const pressed = btn.pressed || btn.touched || btn.value >= 0.3;
        const changed = this.update_gp_btn(index, btn_code, pressed ? 1 : 0)
        if (!changed) continue;
        if (!pressed) continue;
        switch (btn_code) {
          case GPBtnCode.Start: this.lfw.cmds.push(CMD.F1); break;
          case GPBtnCode.Back: this.lfw.cmds.push(CMD.F4); break;
        }
      }

      const [ax, ay] = gamepad.axes || [0, 0];
      const [pax, pay] = this.gamepad_axes.at(i) || [0, 0];
      const alz = this._axe_live_zone;
      const adz = this._axe_dead_zone;
      if (ax >= alz && pax < alz) {
        this.update_gp_btn(index, GPBtnCode.Right, 1, 1)
      } else if (ax < alz && pax >= alz) {
        this.update_gp_btn(index, GPBtnCode.Right, 0, 1)
      }
      if (ax <= -alz && pax > -alz) {
        this.update_gp_btn(index, GPBtnCode.Left, 1, 1)
      } else if (ax > -alz && pax <= -alz) {
        this.update_gp_btn(index, GPBtnCode.Left, 0, 1)
      }
      if (ay >= alz && pay < alz) {
        this.update_gp_btn(index, GPBtnCode.Down, 1, 1)
      } else if (ay < alz && pay >= alz) {
        this.update_gp_btn(index, GPBtnCode.Down, 0, 1)
      }
      if (ay <= -alz && pay > -alz) {
        this.update_gp_btn(index, GPBtnCode.Up, 1, 1)
      } else if (ay > -alz && pay <= -alz) {
        this.update_gp_btn(index, GPBtnCode.Up, 0, 1)
      }
      this.gamepad_axes[i] = [ax, ay]
    }
  }
  update_gp_btn(index: number, key: GPBtnCode, pressed: 0 | 1, dpad: number = 0): boolean {
    const btn_name = GPBtnName[key]
    const key_code = `${index + 1}: ${btn_name}`;
    if (this.gamepad_buttons.get(key_code + dpad) === pressed) return false;
    this.gamepad_buttons.set(key_code + dpad, pressed);
    pressed ? this.key_down(key_code, 'controller') : this.key_up(key_code, 'controller');
    return true;
  }
  dispose() {
    window.removeEventListener("keydown", this._on_key_down);
    window.removeEventListener("keyup", this._on_key_up);
    this._callback.clear()
    clearInterval(this.gamepad_timer)
  }
}

enum GPBtnCode {
  __MIN = 0,
  A = 0,
  B = 1,
  X = 2,
  Y = 3,
  LB = 4,
  RB = 5,
  LT = 6,
  RT = 7,
  Back = 8,
  Start = 9,
  LS = 10,
  RS = 11,
  Up = 12,
  Down = 13,
  Left = 14,
  Right = 15,
  __MAX = 15
}
const GPBtnName: Record<GPBtnCode, string> = {
  [GPBtnCode.A]: 'A',
  [GPBtnCode.B]: 'B',
  [GPBtnCode.X]: 'X',
  [GPBtnCode.Y]: 'Y',
  [GPBtnCode.LB]: 'LB',
  [GPBtnCode.RB]: 'RB',
  [GPBtnCode.LT]: 'LT',
  [GPBtnCode.RT]: 'RT',
  [GPBtnCode.Back]: 'Back',
  [GPBtnCode.Start]: 'Start',
  [GPBtnCode.LS]: 'LS',
  [GPBtnCode.RS]: 'RS',
  [GPBtnCode.Up]: 'Up',
  [GPBtnCode.Down]: 'Down',
  [GPBtnCode.Left]: 'Left',
  [GPBtnCode.Right]: 'Right',
}