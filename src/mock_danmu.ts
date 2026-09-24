import type { LFW } from "./LFW";
import type { ILFWCallback } from "./LFW/ILFWCallback";
import { DanmuGameLogic } from "./LFW/ui/component/DanmuGameLogic";
import type { UIComponent } from "./LFW/ui/component/UIComponent";

const LOG_TAG = "[mock-danmu]";

const WORDS = "战魂影月星光风雷炎冰霜云火木水金土天灵圣魔虎豹鹰翼羽夜冥雪山河海空玄紫青苍赤橙黄绿蓝梦幻疾风迅雷极光惊云傲天无双飞龙旋风冰晶烈焰魅影狂刀雷霆裂空暴风流星奔月剑圣刀客小小大老新快乐无敌战神勇士骑士法师猎人刺客零一二三四五六七八九十";

const make_nick = (seq: number): string => {
  const len = 3 + Math.floor(Math.random() * 6);
  let out = "";
  for (let i = 0; i < len; ++i)
    out += WORDS[Math.floor(Math.random() * WORDS.length)];
  return `${out}${seq}`;
};

class MockDanmuFeeder implements ILFWCallback {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private cheer_timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;
  private logic: DanmuGameLogic | null = null;
  constructor(lfw: LFW) {
    lfw.callbacks.add(this);
  }
  on_component_broadcast(component: UIComponent, msg: string): void {
    if (msg === DanmuGameLogic.BROADCAST_ON_START) {
      this.logic = component as DanmuGameLogic;
      this.schedule();
      this.schedule_cheer();
    } else if (msg === DanmuGameLogic.BROADCAST_ON_STOP) {
      this.logic = null;
      this.stop();
      this.stop_cheer();
    }
  }
  private schedule(): void {
    this.stop();
    this.timer = setTimeout(() => {
      this.tick();
      if (this.logic) this.schedule();
    }, 1000 + Math.floor(Math.random() * 1500));
  }
  private tick(): void {
    const { logic } = this;
    if (!logic) return;
    const seq = ++this.seq;
    const entrant = { uid: `mock_danmu_${seq}`, name: make_nick(seq) };
    logic.join(entrant);
    console.log(LOG_TAG, `观众排队入场: ${entrant.name}（队列 ${logic.join_queue.size}）`);
    this.maybe_leave();
    this.maybe_enter();
  }
  private maybe_leave(): void {
    const { logic } = this;
    if (!logic || logic.join_queue.size < 2 || Math.random() > 0.25) return;
    const queued = logic.join_queue.all;
    const target = queued[Math.floor(Math.random() * queued.length)];
    if (!target || !logic.leave(target.uid)) return;
    console.log(LOG_TAG, `观众离开直播间，退出队列: ${target.name}（队列 ${logic.join_queue.size}）`);
  }
  private maybe_enter(): void {
    const { logic } = this;
    if (!logic || Math.random() > 0.2) return;
    const seq = ++this.seq;
    const entrant = { uid: `mock_enter_${seq}`, name: make_nick(seq) };
    if (!logic.enter(entrant)) return;
    console.log(LOG_TAG, `观众进入直播间，以 Template 入场: ${entrant.name}`);
  }
  private maybe_switch(): void {
    const { logic } = this;
    if (!logic) return;
    const alive = logic.viewer_stats().filter((v) => v.alive);
    if (!alive.length) return;
    const target = alive[Math.floor(Math.random() * alive.length)];
    if (logic.switch(target.uid)) console.log(LOG_TAG, `Template 切换角色: ${target.name}`);
  }
  private schedule_cheer(): void {
    this.stop_cheer();
    this.cheer_timer = setTimeout(() => {
      this.cheer_tick();
      if (this.logic) this.schedule_cheer();
    }, 2000 + Math.floor(Math.random() * 2000));
  }
  private cheer_tick(): void {
    const { logic } = this;
    if (!logic) return;
    const alive = logic.viewer_stats().filter((v) => v.alive);
    if (!alive.length) return;
    const target = alive[Math.floor(Math.random() * alive.length)];
    if (logic.cheer(target.uid)) console.log(LOG_TAG, `观众应援: ${target.name}`);
    this.maybe_switch();
  }
  private stop_cheer(): void {
    if (this.cheer_timer === null) return;
    clearTimeout(this.cheer_timer);
    this.cheer_timer = null;
  }
  private stop(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}

const installed = new WeakSet<LFW>();

export function install_mock_danmu_if_requested(lfw: LFW): void {
  if (!/[?&#]DANMU=1/i.test(window.location.href)) return;
  lfw.danmu_available = true;
  if (installed.has(lfw)) return;
  installed.add(lfw);
  console.log(LOG_TAG, "已启用模拟弹幕入队/应援（URL 参数 DANMU=1）");
  new MockDanmuFeeder(lfw);
}
