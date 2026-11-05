import { Ditto, type INetworkingCallbacks, TextInput, UIComponent, UINode } from "@/LFW";
import { clamp_nickname } from "@/Net/nickname";
import { pick_default_nickname } from "./default_nicknames";

/**
 * 联网游戏弹窗逻辑
 */
export class NetworkModalLogic extends UIComponent {
  static readonly LFW_SERVER_ADDRESS_DEFAULT_VALUE = "wss://lfj.gim.ink";
  static readonly LFW_SERVER_ADDRESS_KEY = "lfw_server_address";
  static readonly LFW_CLIENT_NICKNAME_KEY = "lfw_client_nickname";

  static override readonly TAGS: string[] = ["NetworkModalLogic"];
  connect_status: UINode | undefined;
  address_input: TextInput | undefined;
  nickname_input: TextInput | undefined;
  readonly networking_callbacks: INetworkingCallbacks = {
    on_open: () => {
      if (this.address_input)
        this.lfw.save_string(NetworkModalLogic.LFW_SERVER_ADDRESS_KEY, this.address_input.text);
      if (this.nickname_input)
        this.lfw.save_string(NetworkModalLogic.LFW_CLIENT_NICKNAME_KEY, this.nickname_input.text);
    }
  }
  override on_stop(): void {
    super.on_stop?.();
    Ditto.Networking.callbacks.del(this.networking_callbacks);
  }
  override on_start(): void {
    super.on_start?.();
    Ditto.Networking.callbacks.add(this.networking_callbacks);
    this.connect_status = this.node.search_node('network_connect_status');
    this.address_input = this.node.search_node('network_address_input')?.search_component(TextInput);
    this.nickname_input = this.node.search_node('network_nickname_input')?.search_component(TextInput);

    this.lfw.load_string(NetworkModalLogic.LFW_SERVER_ADDRESS_KEY).then(text => {
      text ||= NetworkModalLogic.LFW_SERVER_ADDRESS_DEFAULT_VALUE;
      this.address_input?.set_text(text);
    }).catch(e => {
      Ditto.warn(`[${NetworkModalLogic.TAG}::on_start]`, e)
    })

    this.lfw.load_string(NetworkModalLogic.LFW_CLIENT_NICKNAME_KEY).then(text => {
      text ||= pick_default_nickname(this.lfw.canonical_lang());
      this.nickname_input?.set_text(clamp_nickname(text));
    }).catch(e => {
      Ditto.warn(`[${NetworkModalLogic.TAG}::on_start]`, e)
    })

    this.node.search_node('network_btn_connect')?.callbacks.add({
      on_click: () => {
        let address = this.address_input?.text.trim();
        if (!address) this.address_input?.set_text(address = "lfj.gim.ink");

        const nickname = this.nickname_input?.text.trim();
        if (!nickname) {
          this.connect_status?.set_text(this.lfw.string('network.nickname_hints'))
          return;
        }
        Ditto.Networking.open({ address, nickname });
      }
    });
    this.node.search_node('network_btn_connect_cancel')?.callbacks.add({
      on_click: () => { }
    });
  }
}
