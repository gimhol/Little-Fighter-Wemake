import { useMemo, useRef, type RefObject } from "react";
import csses from "./DevStatsView.module.scss";
import { Ditto, type ILFWCallback, type IWorldCallbacks, type LFW } from "./LFW";
import { useCallbacks } from "./pages/network/useCallbacks";

export interface IDevStatsViewProps {
  lfw?: LFW | null;
}
function set_inner_text<E extends HTMLElement>(ref: RefObject<E | null>, text: string) {
  if (ref.current) ref.current.innerText = text;
}
export function DevStatsView(props: IDevStatsViewProps) {
  const { lfw } = props;
  const ref_fps = useRef<HTMLSpanElement>(null);
  const ref_ups = useRef<HTMLSpanElement>(null);
  const ref_ent = useRef<HTMLSpanElement>(null);
  const ref_buf = useRef<HTMLSpanElement>(null);
  const ref_pair = useRef<HTMLSpanElement>(null);
  const ref_cost = useRef<HTMLSpanElement>(null);
  const ref_coll = useRef<HTMLSpanElement>(null);
  const ref_rnd = useRef<HTMLSpanElement>(null);
  const ref_span = useRef<HTMLSpanElement>(null);
  const ref_rtt = useRef<HTMLSpanElement>(null);
  const ref_k = useRef<HTMLSpanElement>(null);
  const ref_loading = useRef<HTMLSpanElement>(null);
  const ref_tid = useRef<number>(0);
  const ref_tid2 = useRef<number>(0);


  useCallbacks(
    lfw?.world.callbacks,
    useMemo<IWorldCallbacks>(() => ({
      on_ups_update: (ups, _score, speed) => {
        set_inner_text(ref_ups, "UPS:" + ups.toFixed(0) + ` ×${speed!.toFixed(2)}`);
      },
      on_fps_update: (fps) => {
        set_inner_text(ref_fps, "FPS:" + fps.toFixed(0));
        const world = lfw?.world;
        if (!world) return;
        const { rtt, lead: k } = Ditto.Networking;
        set_inner_text(ref_ent, "ENT:" + world.entities.length);
        set_inner_text(ref_buf, "BUF:" + world.buffs.size);
        set_inner_text(ref_cost, "COST:" + (world.ticker?.cost ?? 0).toFixed(2) + "ms");
        set_inner_text(ref_pair, "PAIR:" + world.pairs_compared);
        set_inner_text(ref_coll, "COLL:" + world.collisions.size);
        set_inner_text(ref_rnd, "RND:" + world.render_cost.toFixed(2) + "ms");
        set_inner_text(ref_span, "SPAN:" + (world.ticker?.span ?? 1).toFixed(2));
        set_inner_text(ref_rtt, "RTT:" + (rtt ? rtt + "ms" : "--"));
        set_inner_text(ref_k, "K:" + (k ?? "--"));
      }
    }), [lfw])
  )
  useCallbacks(
    lfw?.callbacks,
    useMemo<ILFWCallback>(() => ({
      on_progress: (content, progress) => {
        const el = ref_loading.current;
        if (el) {
          el.style.display = '';
          el.innerText = `${content}, ${progress}%`;
          el.style.transition = ''
          el.style.opacity = '1'
        }
        window.clearTimeout(ref_tid.current);
        window.clearTimeout(ref_tid2.current);
        ref_tid.current = window.setTimeout(() => {
          if (el) {
            el.style.transition = 'opacity 150ms'
            el.style.opacity = '0'
          }
          ref_tid2.current = window.setTimeout(() => {
            if (el) el.style.display = 'none'
          }, 150)
        }, 1000)
      }
    }), [])
  )
  return (
    <div className={csses.dev_stats_view}>
      <div className={csses.dev_stats_view_counts}>
        <span ref={ref_fps} />
        <span ref={ref_span} />
        <span ref={ref_ups} />
      </div>
      <div className={csses.dev_stats_view_counts}>
        <span ref={ref_ent} />
        <span ref={ref_buf} />
        <span ref={ref_cost} />
        <span ref={ref_pair} />
      </div>
      <div className={csses.dev_stats_view_counts}>
        <span ref={ref_rnd} />
        <span ref={ref_rtt} />
        <span ref={ref_k} />
        <span ref={ref_coll} />
      </div>
      <span ref={ref_loading} className={csses.dev_stats_view_loading} />
    </div>
  );
}