import { Ditto } from "../../../ditto/Instance";
import type { INetworkingCallbacks } from "../../../ditto/networking/INetworking";
import { clamp_nickname } from "../../../ditto/networking/nickname";
import type { IUICallback } from "../../IUICallback";
import { TextInput } from "../TextInput";
import { UIComponent } from "../UIComponent";
import type { UINode } from "../../UINode";
import { pick_default_nickname } from "./default_nicknames";

/**
 * 联网游戏弹窗逻辑
 */
export class NetworkModalLogic extends UIComponent {
  static readonly LFW_SERVER_ADDRESS_DEFAULT_VALUE = "wss://lfj.gim.ink";
  static readonly LFW_SERVER_ADDRESS_KEY = "lfw_server_address";
  static readonly LFW_CLIENT_NICKNAME_KEY = "lfw_client_nickname";
  static readonly ROOMS_PAGE_ID = 'network_rooms_page';
  static override readonly TAGS: string[] = ["NetworkModalLogic"];

  private ui_hints: UINode | undefined;
  private ipt_address: TextInput | undefined;
  private ipt_nickname: TextInput | undefined;
  private loading_anim: UINode | undefined;

  private set_connecting(connecting: boolean): void {
    this.loading_anim?.set_visible(connecting);
    this.btn_connect?.set_disabled(connecting);
    this.btn_cancel?.set_disabled(connecting);
  }

  readonly callbacks_networking: INetworkingCallbacks = {
    on_register: () => {
      if (this.ipt_address)
        this.lfw.save_string(NetworkModalLogic.LFW_SERVER_ADDRESS_KEY, this.ipt_address.text);
      if (this.ipt_nickname)
        this.lfw.save_string(NetworkModalLogic.LFW_CLIENT_NICKNAME_KEY, this.ipt_nickname.text);
      this.set_connecting(false);
      if (this.lfw.layers.at(0)?.page?.id === NetworkModalLogic.ROOMS_PAGE_ID) {
        this.lfw.layers.close_modal({ id: this.node.root.id }, 0);
        return;
      }
      this.lfw.layers.push_page({ id: NetworkModalLogic.ROOMS_PAGE_ID }, 0)
    },
    on_error: (error) => {
      this.set_connecting(false);
      this.ui_hints?.set_text(error.error ?? error.message)
    },
    on_close: (reason) => {
      this.ui_hints?.set_text(reason)
      this.set_connecting(false);
    },
  }

  private btn_connect: UINode | undefined;
  private callbacks_btn_connect: IUICallback = {
    on_click: () => {
      let address = this.ipt_address?.text.trim();
      if (!address) this.ipt_address?.set_text(address = "lfj.gim.ink");
      let nickname = this.ipt_nickname?.text.trim();
      if (!nickname) this.ipt_address?.set_text(nickname = pick_default_nickname(this.lfw.canonical_lang()));
      this.set_connecting(true);
      Ditto.Networking.open({ address, nickname });
    }
  }

  private btn_cancel: UINode | undefined;
  private callbacks_btn_cancel: IUICallback = {
    on_click: () => {
      this.lfw.layers.close_modal({ id: this.node.root.id }, 0);
    }
  }

  override on_stop(): void {
    super.on_stop?.();
    Ditto.Networking.callbacks.del(this.callbacks_networking);
    this.btn_connect?.callbacks.del(this.callbacks_btn_connect);
    this.btn_cancel?.callbacks.del(this.callbacks_btn_cancel);
  }

  override on_start(): void {
    super.on_start?.();

    Ditto.Networking.callbacks.add(this.callbacks_networking);
    this.ui_hints = this.node.search_node('network_connect_status');
    this.ipt_address = this.node.search_node('network_address_input')?.search_component(TextInput);
    this.ipt_nickname = this.node.search_node('network_nickname_input')?.search_component(TextInput);
    this.ui_hints?.set_text("")

    this.lfw.load_string(NetworkModalLogic.LFW_SERVER_ADDRESS_KEY).then(text => {
      text ||= NetworkModalLogic.LFW_SERVER_ADDRESS_DEFAULT_VALUE;
      this.ipt_address?.set_text(text);
    }).catch(e => {
      Ditto.warn(`[${NetworkModalLogic.TAG}::on_start]`, e)
    })

    this.lfw.load_string(NetworkModalLogic.LFW_CLIENT_NICKNAME_KEY).then(text => {
      text ||= pick_default_nickname(this.lfw.canonical_lang());
      this.ipt_nickname?.set_text(clamp_nickname(text));
    }).catch(e => {
      Ditto.warn(`[${NetworkModalLogic.TAG}::on_start]`, e)
    })

    this.btn_connect = this.node.search_node('network_btn_connect');
    this.btn_cancel = this.node.search_node('network_btn_connect_cancel');
    this.loading_anim = this.node.search_node('network_loading_anim');

    this.btn_connect?.callbacks.add(this.callbacks_btn_connect);
    this.btn_cancel?.callbacks.add(this.callbacks_btn_cancel);
  }
}
