import { CMD } from "../defines/CMD";
import {
  clear_weapon_release_traces,
  dump_weapon_release_traces,
  set_weapon_release_trace_enabled,
  weapon_release_trace_enabled,
} from "../debug/weapon_release_trace";
import { Ditto } from "../ditto/Instance";
import { CMDS } from "./CMDS";

const help =
  "武器出手诊断: WEAPON_TRACE on|off 开关实时打印; WEAPON_TRACE dump 打印最近记录; WEAPON_TRACE clear 清空";

CMDS.register(CMD.WEAPON_TRACE, help, (ctx) => {
  const action = (ctx.words[1] ?? "dump").toLowerCase();
  if (action === "on") {
    set_weapon_release_trace_enabled(true);
    Ditto.Log("[weapon_release] trace: on");
  } else if (action === "off") {
    set_weapon_release_trace_enabled(false);
    Ditto.Log("[weapon_release] trace: off");
  } else if (action === "clear") {
    clear_weapon_release_traces();
    Ditto.Log("[weapon_release] cleared");
  } else {
    const lines = dump_weapon_release_traces();
    Ditto.Log(
      `[weapon_release] enabled=${weapon_release_trace_enabled()} count=${lines.length}`,
    );
    for (const line of lines) Ditto.Log(line);
  }
});
