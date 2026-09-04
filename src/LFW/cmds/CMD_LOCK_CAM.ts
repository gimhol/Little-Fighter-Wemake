import { CMD } from "../defines/CMD";
import { Ditto } from "../ditto/Instance";
import { CMDS } from "./CMDS";

const help = `Usage: LOCK_CAM [<x>[,<y>]]

Lock the camera (omit to unlock) / 锁定摄像机位置（省略则解锁）`;

CMDS.register(CMD.LOCK_CAM, help, (c) => {
  const nums = c.nums(1);
  if (!nums) return c.world.camera.unlock();
  const [x, y = 0] = nums;
  if (isNaN(x)) return Ditto.warn(`LOCK_CAM failed, x got ${x}.`)
  if (isNaN(y)) return Ditto.warn(`LOCK_CAM failed, y got ${y}.`)
  c.world.camera.lock(x, y);
})
