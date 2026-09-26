import { type IState, FSM } from "../../base/FSM";
import type { IPropsMeta } from "../../defines/ISchema";
import { Ditto } from "../../ditto";
import type { ILFWCallback } from "../../ILFWCallback";
import type { IUIKeyEvent } from "../IUIKeyEvent";
import type { IUIPointerEvent } from "../IUIPointerEvent";
import { UINode } from "../UINode";
import { FadeOutOpacity } from "./FadeOutOpacity";
import { ImgLoop } from "./ImgLoop";
import { OpacityAnimation } from "./OpacityAnimation";
import { PositionAnimation } from "./PositionAnimation";
import { ScaleAnimation } from "./ScaleAnimation";
import { SineOpacity } from "./SineOpacity";
import { UIComponent } from "./UIComponent";

enum Status {
  TapHints = 'TapHints',
  Introduction = 'Introduction',
  GoToEntry = "GoToEntry",
  End = "End",
}
export interface ILaunchPageProps {
  entry: string;
  loading_anim: ImgLoop;
  tap_to_launch: UINode;
  translation_note?: UINode;
  sound_warning: UINode;
  yeonface: UINode;
  bearface: UINode;
  long_text: UINode;
}
export class LaunchPage extends UIComponent<ILaunchPageProps> {
  static override readonly TAGS: string[] = ["LaunchPage"];
  static override readonly PROPS: IPropsMeta<ILaunchPageProps> = {
    entry: String,
    loading_anim: { type: ImgLoop, nullable: false },
    tap_to_launch: { type: UINode, nullable: false },
    translation_note: { type: UINode, nullable: true },
    sound_warning: { type: UINode, nullable: false },
    yeonface: { type: UINode, nullable: false },
    bearface: { type: UINode, nullable: false },
    long_text: { type: UINode, nullable: false },
  };
  protected fsm: FSM<Status, IState<Status>>;
  protected _prel_loaded: boolean = false;

  constructor(...args: ConstructorParameters<typeof UIComponent>) {
    super(...args);
    // this.__debugging = true
    this.fsm = new FSM<Status>().add({
      key: Status.TapHints,
      enter: () => {
        this.props.loading_anim.anim.set_times(this._prel_loaded ? 1 : 0).set_count(0)
        this.props.tap_to_launch.find_component(SineOpacity)!.enabled = true;
        this.props.sound_warning.find_component(SineOpacity)!.enabled = true;
        this.props.tap_to_launch.find_component(FadeOutOpacity)!.enabled = false;
        this.props.sound_warning.find_component(FadeOutOpacity)!.enabled = false;
        const note_sine = this.props.translation_note?.find_component(SineOpacity);
        if (note_sine) note_sine.enabled = true;
        const note_fade = this.props.translation_note?.find_component(FadeOutOpacity);
        if (note_fade) note_fade.enabled = false;
      },
      leave: () => {
        this.props.tap_to_launch.find_component(SineOpacity)!.enabled = false
        this.props.sound_warning.find_component(SineOpacity)!.enabled = false
        this.props.tap_to_launch.find_component(FadeOutOpacity)!.enabled = true
        this.props.sound_warning.find_component(FadeOutOpacity)!.enabled = true
        const note_sine = this.props.translation_note?.find_component(SineOpacity);
        if (note_sine) note_sine.enabled = false;
        const note_fade = this.props.translation_note?.find_component(FadeOutOpacity);
        if (note_fade) note_fade.enabled = true;
      }
    }, {
      key: Status.Introduction,
      enter: () => {
        Ditto.Timeout.add(() => this.lfw.sounds.play("builtin_data/launch/093.wav.mp3"), 1000);
        this.props.yeonface.find_component(ScaleAnimation, 'scale_in')?.start(false)
        this.props.yeonface.find_component(PositionAnimation, 'move_in')?.start(false)
        this.props.yeonface.find_component(OpacityAnimation)?.start(false)
        this.props.bearface.find_component(ScaleAnimation, 'scale_in')?.start(false)
        this.props.bearface.find_component(PositionAnimation, 'move_in')?.start(false)
        this.props.bearface.find_component(OpacityAnimation)?.start(false)
        this.props.long_text.find_component(PositionAnimation, 'move_in')?.start(false)
        this.props.long_text.find_component(OpacityAnimation, 'opacity')?.start(false)
      },
      leave: () => {
        {
          const c = this.props.yeonface.find_component(OpacityAnimation)
          c?.start(true)
          c?.update(c.anim.anims[c.anim.anims.length - 1]!.duration)
        }
        {
          const c = this.props.bearface.find_component(OpacityAnimation)
          c?.start(true)
          c?.update(c.anim.anims[c.anim.anims.length - 1]!.duration)
        }
        {
          const c = this.props.yeonface.find_component(ScaleAnimation, 'scale_out')
          c?.start(false);
        }
        {
          const c = this.props.bearface.find_component(ScaleAnimation, 'scale_out')
          c?.start(false);
        }
        {
          const c = this.props.long_text.find_component(OpacityAnimation, void 0)
          c?.start(true)
          c?.update(c.anim.anims[c.anim.anims.length - 1]!.duration)

        }
      },
      update: (dt) => {
        if (this._prel_loaded && this.props.long_text.find_component(OpacityAnimation)!.done)
          return Status.GoToEntry
      }
    }, {
      key: Status.GoToEntry,
      enter: () => {
        this.lfw.sounds.play_bgm("bgm/main.wma.mp3");
      },
      update: (dt) => {
        if (this.props.long_text.find_component(OpacityAnimation)!.done) {
          this.lfw.layers.set_ui({ id: this.props.entry });
          return Status.End
        }
      }
    }, {
      key: Status.End,
      update: (dt) => { }
    })
  }
  protected on_prel_loaded() {
    this._prel_loaded = true;
    this.props.loading_anim.anim.set_times(4).set_count(0)
  }
  readonly lf2_cb: ILFWCallback = {
    on_prel_loaded: () => {
      this.lfw.sounds.load("bgm/main.wma.mp3", "bgm/main.wma.mp3").catch(e => {
        Ditto.warn(e)
      }).then(() => {
        this.on_prel_loaded()
      });
    },
  }
  override on_start(): void {
    this._prel_loaded = this.lfw.ui_loaded;
    this.lfw.sounds.load("builtin_data/launch/093.wav.mp3", "builtin_data/launch/093.wav.mp3");
    this.lfw.callbacks.add(this.lf2_cb)
  }
  override on_stop(): void {
    super.on_stop?.();
    this.lfw.callbacks.del(this.lf2_cb)
  }
  override on_resume(): void {
    this.props.bearface = this.node.find_child("bearface")!;
    this.props.yeonface = this.node.find_child("yeonface")!;
    this.props.tap_to_launch = this.node.find_child("tap_to_launch")!;
    this.props.sound_warning = this.node.find_child("sound_warning")!;
    this.props.long_text = this.node.find_child("long_text")!;
    if (window.runtime) this.node.find_child("desktop_hint")?.set_visible(false);
    this.fsm.use(Status.TapHints)
  }
  override on_key_down(e: IUIKeyEvent): void {
    this.debug('on_key_down', e)
    this.on_tap();
    // e.stop_immediate_propagation()
  }
  override on_click(e: IUIPointerEvent): void {
    this.debug('on_click')
    this.on_tap()
    // e.stop_immediate_propagation()
  }
  on_tap() {
    const status = this.fsm.state?.key
    switch (status) {
      case Status.TapHints:
        this.fsm.use(Status.Introduction);
        return;
    }
    return true;
  }
  override update(dt: number): void {
    this.fsm.update(dt);
  }
}
