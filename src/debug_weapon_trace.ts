import {
  clear_weapon_release_traces,
  dump_weapon_release_traces,
  set_weapon_release_trace_enabled,
  weapon_release_trace_enabled,
} from "./LFW/debug/weapon_release_trace";
import { Ditto } from "./LFW/ditto/Instance";

type TWeaponTraceHandle = {
  on(): boolean;
  off(): boolean;
  dump(): string[];
  clear(): boolean;
  readonly enabled: boolean;
};

function install_weapon_trace(): void {
  if (typeof window === "undefined") return;
  const handle: TWeaponTraceHandle = {
    on() {
      set_weapon_release_trace_enabled(true);
      Ditto.Log("[weapon_release] trace: on");
      return true;
    },
    off() {
      set_weapon_release_trace_enabled(false);
      Ditto.Log("[weapon_release] trace: off");
      return false;
    },
    dump() {
      const lines = dump_weapon_release_traces();
      Ditto.Log(
        `[weapon_release] enabled=${weapon_release_trace_enabled()} count=${lines.length}`,
      );
      for (const line of lines) Ditto.Log(line);
      return lines;
    },
    clear() {
      clear_weapon_release_traces();
      return true;
    },
    get enabled() {
      return weapon_release_trace_enabled();
    },
  };
  (window as any).weapon_trace = handle;
}

install_weapon_trace();
