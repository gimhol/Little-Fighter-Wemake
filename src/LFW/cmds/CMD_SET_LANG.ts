import { CMD } from "../defines/CMD";
import { Ditto } from "../ditto/Instance";
import { CMDS } from "./CMDS";

const help = `Usage: SET_LANG <lang>

Switch UI language at runtime ('zh-cn' / 'en-us' ...), the current page re-translates at once
运行时切换 UI 语言（'zh-cn' / 'en-us' …），当前页面立刻按新语言重解析文本`;

CMDS.register(CMD.SET_LANG, help, (ctx) => {
  const code = ctx.str(1);
  if (!code) {
    return Ditto.warn(`SET_LANG failed, must "SET_LANG <zh-cn|en-us|...>", got: ${ctx.cmd}`);
  }
  ctx.world.lfw.set_lang(code);
  Ditto.Log(`lang -> ${ctx.world.lfw.lang}`);
});
