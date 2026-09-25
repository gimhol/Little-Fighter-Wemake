import { use_lfw } from "@/hooks/use_lfw";
import { Paths } from "@/Paths";
import { useState, type ComponentType } from "react";
import { useNavigate } from "react-router";
import { BackgroundPreviewer } from "./BackgroundPreviewer";
import { PreviewerContext } from "./ctx";
import { EntityPreviewer } from "./EntityPreviewer";
import { ImagePreviewer } from "./ImagePreviewer";
import csses from "./styles.module.scss";

interface ITab {
  id: string;
  label: string;
  Component: ComponentType;
}

/** 新增预览类型时，写一个 `xxxPreviewer` 组件再往这里加一项即可 */
const TABS: readonly ITab[] = [
  { id: "bg", label: "背景", Component: BackgroundPreviewer },
  { id: "entity", label: "角色/物件", Component: EntityPreviewer },
  { id: "image", label: "图片", Component: ImagePreviewer },
];

export default function PreviewerPage() {
  const nav = useNavigate();
  const [progress, set_progress] = useState("");
  const { lfw, ready, error } = use_lfw({
    muted: true,
    hide_ui: true,
    on_progress: (content, value) => set_progress(`${content} ${Math.round(value)}%`),
  });
  const [tab_id, set_tab_id] = useState(TABS[0].id);
  const tab = TABS.find((v) => v.id === tab_id) ?? TABS[0];

  return (
    <PreviewerContext.Provider value={{ lfw, ready }}>
      <div className={csses.page}>
        <div className={csses.header}>
          <div className={csses.title}>预览器</div>
          <div className={csses.tabs}>
            {TABS.map((v) => (
              <button
                key={v.id}
                className={`${csses.tab}${v.id === tab.id ? " " + csses.tab_active : ""}`}
                onClick={() => set_tab_id(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className={csses.spacer} />
          <div className={csses.muted}>{progress}</div>
          <button className={csses.btn} onClick={() => window.location.reload()}>刷新</button>
          <button className={csses.btn} onClick={() => nav(Paths.All.game, { replace: true })}>返回游戏</button>
        </div>
        <div className={csses.body}>
          {error ? (
            <div className={csses.body_msg}>{error}</div>
          ) : ready ? (
            <tab.Component />
          ) : (
            <div className={csses.body_msg}>数据包加载中…（首次约 30MB）</div>
          )}
        </div>
      </div>
    </PreviewerContext.Provider>
  );
}
