import { CMD } from "../defines/CMD";
import { CMDS } from "./CMDS";

const help = `Usage: BGM <id|?>

Play a BGM, '?' plays a random next one / 播放 BGM，'?' 随机播放下一首`;

CMDS.register(CMD.BGM, help, (ctx) => {
  ctx.world.lfw.sounds.play_bgm(ctx.str(1) ?? '?');
})
