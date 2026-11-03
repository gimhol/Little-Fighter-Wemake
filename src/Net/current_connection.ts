import type { Connection } from "@/pages/network/Connection";
import type { LFWNetworkDriver } from "@/pages/network/LFWNetworkDriver";
import type { NetworkLogic } from "@/pages/network/NetworkLogic";

/**
 * 当前联机连接与驱动器。
 *
 * 放在 Net 层而非 pages 层：LFW 渲染层(DittoImpl)也要用到它，
 * 若留在 src/pages 下会让 lfw-dom chunk 反向依赖 other-pages chunk，
 * 形成循环后 NetworkLogic 在 UIComponent 初始化前执行，触发 TDZ 报错。
 */
export const current_connection: {
  conn: Connection | null;
  driver: LFWNetworkDriver | null;
  logic: NetworkLogic | null;
} = { conn: null, driver: null, logic: null };
