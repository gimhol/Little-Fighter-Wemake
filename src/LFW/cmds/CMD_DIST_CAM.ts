import { CMD } from "../defines/CMD";
import { Ditto } from "../ditto/Instance";
import { CMDS } from "./CMDS";

const help = `Usage: DIST_CAM [<x>[,<y>]]

Move the camera (omit to reset) / 移动摄像机位置（省略则回到默认）`;

CMDS.register(CMD.DIST_CAM, help, (c) => {
  const nums = c.nums(1);
  if (!nums) return c.world.camera.undest();
  const [x, y = 0] = nums;
  if (isNaN(x)) return Ditto.warn(`DIST_CAM failed, x got ${x}.`)
  if (isNaN(y)) return Ditto.warn(`DIST_CAM failed, y got ${y}.`)
  c.world.camera.dest(x, y);
})
