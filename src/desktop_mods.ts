import { Ditto, LFW, type IGameZipInfo, type IZip } from "@/LFW";

/**
 * 桌面客户端（Electron）的模组目录：`<程序目录>/mods` 与 `<用户数据目录>/mods` 下的 `*.zip` 自动加载
 *
 * - 普通 zip：作为「额外数据包」，等同入口页「添加模组」手动选的文件（在数据包之后加载，会覆盖本体数据）
 * - 内含 `index.json` 的 zip：作为「自定义游戏包」，整个游戏被它替换（只认第一个）
 *
 * 必须在 LFW 实例创建（`useLFW` 里的 `load`）之前调用，所以由 App.tsx 在挂起状态里先跑。
 */

let pending: Promise<void> | null = null;

async function run(): Promise<void> {
  const api = window.lfwm_mods;
  if (!api) return;
  const { items } = await api.list();
  if (!items.length) return;

  const zips: IZip[] = [];
  let full: [IGameZipInfo, IZip[]] | undefined;
  for (const item of items) {
    try {
      const buf = await api.read(item.id);
      if (!buf) continue;
      const zip = await Ditto.Zip.read_file(new File([buf], item.name));
      // 根级 index.json/json5 指向包内其它 zip = 自定义游戏包；解析失败说明是普通数据包（数据包的 index 是 { type: "DATA" }）
      if (zip.file("index.json") || zip.file("index.json5")) {
        let pkg: [IGameZipInfo, IZip[]] | undefined;
        try {
          // 用到时才加载（里面带 json5 解析，平时不需要）
          const { read_as_full_game_zip } = await import("@/pages/custom_game/read_as_full_game_zip");
          pkg = await read_as_full_game_zip(zip);
        } catch (e) {
          Ditto.warn(`[mods] ${item.name} 不是自定义游戏包，按数据包加载\n${e}`);
        }
        if (pkg) {
          if (full) Ditto.warn(`[mods] 只用一个自定义游戏包，忽略: ${item.name}`);
          else full = pkg;
          continue;
        }
      }
      zips.push(zip);
    } catch (e) {
      Ditto.warn(`[mods] 加载失败: ${item.name}\n${e}`);
    }
  }

  if (full) {
    LFW.INFO = full[0];
    LFW.ZIPS = [...full[1], ...zips];
    Ditto.Log(`[mods] 自定义游戏包: ${full[0].title}${zips.length ? `；附加数据包: ${zips.map((v) => v.name).join(", ")}` : ""}`);
  } else if (zips.length) {
    LFW.ZIPS = [...LFW.ZIPS, ...zips];
    Ditto.Log(`[mods] 已加载: ${zips.map((v) => v.name).join(", ")}`);
  }
}

/** 读取模组目录（非桌面客户端 / 已调用过时直接返回） */
export function load_desktop_mods(): Promise<void> {
  return (pending ??= run());
}
