import { useEffect, useMemo, useState } from "react";
import { usePreviewer } from "./ctx";
import { load_image } from "./load_image";
import csses from "./styles.module.scss";

const IMG_RE = /\.(png|jpe?g|gif|bmp|webp|svg)$/i;

export function ImagePreviewer() {
  const { lfw } = usePreviewer();
  const [keyword, set_keyword] = useState("");
  const [path, set_path] = useState("");
  const [info, set_info] = useState<{ url: string; path: string; scale: number; w: number; h: number }>();
  const [normalize, set_normalize] = useState(true);
  const [error, set_error] = useState<string>();
  const [zoom, set_zoom] = useState(1);

  const files = useMemo(() => {
    if (!lfw) return [];
    const set = new Set<string>();
    for (const zip of lfw.zips.zips) {
      for (const key in zip.files) {
        if (IMG_RE.test(key)) set.add(key);
      }
    }
    return [...set].sort();
  }, [lfw]);

  const shown = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return files;
    return files.filter((v) => v.toLowerCase().includes(kw));
  }, [files, keyword]);

  useEffect(() => {
    if (path || !files.length) return;
    set_path(files[0]);
  }, [files, path]);

  useEffect(() => {
    if (!lfw || !path) return;
    let cancelled = false;
    set_error(undefined);
    set_info(undefined);
    set_zoom(1);
    load_image(lfw, path)
      .then((it) => {
        if (cancelled) return;
        set_info({
          url: it.img.src,
          path: it.path,
          scale: it.scale,
          w: it.img.naturalWidth,
          h: it.img.naturalHeight,
        });
      })
      .catch((e) => { if (!cancelled) set_error("" + e); });
    return () => { cancelled = true; };
  }, [lfw, path]);

  const raw_w = info?.w ?? 0;
  const raw_h = info?.h ?? 0;
  const pic_scale = info?.scale ?? 1;
  const dw = normalize ? raw_w / pic_scale : raw_w;
  const dh = normalize ? raw_h / pic_scale : raw_h;

  return (
    <>
      <div className={csses.stage}>
        <div className={`${csses.img_box} ${csses.checker}`}>
          {info && (
            <img
              className={csses.img_el}
              src={info.url}
              alt={info.path}
              style={{ width: dw, height: dh, transform: `scale(${zoom})` }}
              draggable={false}
            />
          )}
          {!info && <div className={csses.center_text}>{error ?? (path ? "加载中…" : "未选择图片")}</div>}
        </div>
        <div className={csses.cam_row}>
          <span className={csses.label}>缩放</span>
          <input
            type="range"
            min={0.25}
            max={8}
            step={0.25}
            value={zoom}
            onChange={(e) => set_zoom(Number(e.target.value))}
          />
          <span className={csses.muted}>{zoom.toFixed(2)}x</span>
          <button className={csses.btn} onClick={() => set_zoom(1)}>1:1</button>
          <label className={csses.check}>
            <input
              type="checkbox"
              checked={normalize}
              onChange={(e) => set_normalize(e.target.checked)}
            />
            倍数归一
          </label>
          <div className={csses.spacer} />
          <div className={csses.muted}>
            {info
              ? `${Math.round(dw)} × ${Math.round(dh)}${pic_scale > 1 ? ` · 原图 ${raw_w} × ${raw_h} @${pic_scale}x` : ""}`
              : "-"}
          </div>
        </div>
        <div className={csses.toolbar}>
          <div className={csses.muted}>{info?.path ?? path}</div>
        </div>
      </div>
      <div className={csses.side}>
        <div className={`${csses.section} ${csses.section_fill}`}>
          <div className={csses.section_title}>图片资源（{shown.length}/{files.length}）</div>
          <div className={csses.search_row}>
            <input
              className={csses.search}
              placeholder="搜索路径"
              value={keyword}
              onChange={(e) => set_keyword(e.target.value)}
            />
          </div>
          <div className={csses.bg_list}>
            {shown.map((v) => (
              <button
                key={v}
                className={`${csses.bg_item}${v === path ? " " + csses.bg_item_active : ""}`}
                onClick={() => set_path(v)}
              >
                <span className={csses.bg_name}>{v}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
