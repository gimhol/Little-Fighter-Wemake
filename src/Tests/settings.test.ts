import { Settings } from "../LFW/Settings";
import { SyncRenderEnum } from "../LFW/defines/SyncRenderEnum";
import { Defines } from "../LFW/defines/defines";

describe("Settings", () => {
  test("默认值", () => {
    const settings = new Settings();
    expect(settings.sync_render).toBe(SyncRenderEnum.FPS_60);
    expect(settings.render_w).toBeGreaterThan(0);
    expect(settings.render_h).toBeGreaterThan(0);
  });

  test("修改触发回调并带上前后值", () => {
    const settings = new Settings();
    const calls: [string, unknown, unknown][] = [];
    settings.on_settings_change = (key, curr, prev) => calls.push([key, curr, prev]);
    settings.sync_render = SyncRenderEnum.Unlimited;
    settings.render_w = 0;
    expect(calls).toEqual([
      ["sync_render", SyncRenderEnum.Unlimited, SyncRenderEnum.FPS_60],
      ["render_w", 0, Defines.DEFAULT_RENDER_RESOLUTION.w],
    ]);
  });

  test("dump_settings 只包含设置字段", () => {
    const settings = new Settings(true);
    settings.render_w = 0;
    expect(settings.dump_settings()).toEqual({
      render_h: settings.render_h,
      render_w: 0,
      sync_render: SyncRenderEnum.FPS_60,
    });
  });
});
