interface Window {
  runtime?: {
    WindowMinimise?(): void;
    WindowIsMaximised?(): Promise<boolean>;
    WindowToggleMaximise?(): void;
    Quit?(): void;
    WindowFullscreen?(): void;
    WindowUnfullscreen?(): void;
    WindowIsFullscreen?(): Promise<boolean>;
    SetLang?(lang: string): void;
  }
  /** 桌面客户端（Electron）的模组目录，见 desktop/app/main.mjs 与 src/desktop_mods.ts */
  lfwm_mods?: {
    list(): Promise<{
      /** 实际扫描到的目录 */
      dirs: string[];
      items: { /** 文件绝对路径，同时用作读取用的 id */ id: string; name: string; dir: string; size: number }[];
    }>;
    read(id: string): Promise<ArrayBuffer | null>;
  }
  /** B站 Toy JS SDK（入口页引入 toy-sdk.js 后由平台注入，见 docs/dev/Toy JS SDK.md） */
  toy?: ToySDK
}

/** Toy 容器设备类型 */
declare type ToyDeviceType = 'phone' | 'tablet' | 'desktop' | 'unknown'
/** Toy 容器方向 */
declare type ToyOrientation = 'portrait' | 'landscape'

/** Toy 容器视口（CSS px） */
interface ToyViewport {
  width: number
  height: number
}

/** Toy 容器安全区（CSS px） */
interface ToySafeArea {
  top: number
  right: number
  bottom: number
  left: number
}

/** Toy 容器状态 */
interface ToyContainerState {
  deviceType: ToyDeviceType
  viewport: ToyViewport
  safeArea: ToySafeArea
  orientation: ToyOrientation
  immersive: boolean
  /** 本次变化的字段；主动读取返回的恒为空数组 */
  changedFields: string[]
}

/** Toy 排行榜周期 */
declare type ToyRankPeriod = 'all' | 'month' | 'week' | 'day'
/** Toy 排行榜条目 */
interface ToyRankItem {
  rank: number
  score: number
  nickname: string
  avatar: string
}
/** Toy 我的排名查询结果 */
interface ToyMyRank {
  ranked: boolean
  rank: number
  score: number
}

/** B站 Toy 用户资料（toyOpenId 仅在当前 Toy 内有效、模式开启时才有；不要外泄/写日志） */
interface ToyUserProfile {
  avatar: string
  nickname: string
  toyOpenId?: string
}
interface ToySDK {
  isSupport?(ability: string): Promise<boolean>
  closeBrowser?(): Promise<void>
  getContainerState?(): Promise<ToyContainerState>
  setContainerMode?(req: {
    orientation?: ToyOrientation | 'auto'
    immersive?: boolean
  }): Promise<void>
  onContainerChange?(listener: (state: ToyContainerState) => void): () => void
  submitScore?(req: { board?: number; score: number }): Promise<{ score: number }>
  getRankList?(req?: { board?: number; period?: ToyRankPeriod; limit?: number }): Promise<ToyRankItem[]>
  getMyRank?(req?: { board?: number; period?: ToyRankPeriod }): Promise<ToyMyRank>
  /** 用户资料：首次调用需用户操作触发（平台数据确认）；toyOpenId 仅在 OpenID 模式开启时返回 */
  getUserProfile?(): Promise<ToyUserProfile>
  /** 云存储：按「登录用户 + Toy」隔离，key 不能以 __ 开头 */
  getCloudStorage?(keys?: string[]): Promise<Record<string, string>>
  setCloudStorage?(items: Record<string, string>): Promise<void>
}
declare const VERSION_NAME: string;
declare const GIT_COMMIT_ID: string;
declare const GIT_COMMIT_DIRTY: "dirty" | "";
declare const BUILD_TIME: string;
declare const BUILD_STAMP: number;
declare const VERSION_CHECK: boolean;
declare const RANK_API_URL: string;
/** 构建期由 vite define 注入的默认数据包 URL 列表（init.ts 读取后覆盖 LFW.ZIPS）；普通构建为 undefined */
declare const DATA_ZIP_URLS: string[] | undefined;
declare type FieldKeysRow<T extends object> = (keyof T | (keyof T)[]);
