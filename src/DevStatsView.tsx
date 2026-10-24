import { useMemo, useRef } from "react";
import csses from "./DevStatsView.module.scss";
import type { ILFWCallback, IWorldCallbacks, LFW } from "./LFW";
import { useCallbacks } from "./pages/network_test/useCallbacks";
import { current_connection } from "./Net/current_connection";

export interface IDevStatsViewProps {
  lfw?: LFW | null;
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
  const ref_lf2 = useRef(lfw);
  ref_lf2.current = lfw;

  useCallbacks(
    lfw?.world.callbacks,
    useMemo<IWorldCallbacks>(() => ({
      on_ups_update: (ups, _score, speed) => {
        ref_ups.current!.innerText =
          "UPS:" + ups.toFixed(0) + ` ×${speed!.toFixed(2)}`;
      },
      on_fps_update: (fps) => {
        ref_fps.current!.innerText = "FPS:" + fps.toFixed(0);
        const world = ref_lf2.current?.world;
        if (!world) return;
        ref_ent.current!.innerText = "ENT:" + world.entities.length;
        ref_buf.current!.innerText = "BUF:" + world.buffs.size;
        ref_cost.current!.innerText = "COST:" + (world.ticker?.cost ?? 0).toFixed(2) + "ms";
        ref_pair.current!.innerText = "PAIR:" + world.pairs_compared;
        ref_coll.current!.innerText = "COLL:" + world.collisions.size;
        ref_rnd.current!.innerText = "RND:" + world.render_cost.toFixed(2) + "ms";
        ref_span.current!.innerText = "SPAN:" + (world.ticker?.span ?? 1).toFixed(2);
        const rtt = current_connection.conn?.rtt;
        ref_rtt.current!.innerText = "RTT:" + (rtt ? rtt + "ms" : "--");
        const k = current_connection.driver?.lead;
        ref_k.current!.innerText = "K:" + (k ?? "--");
      }
    }), [])
  )
  useCallbacks(
    lfw?.callbacks,
    useMemo<ILFWCallback>(() => ({
      on_progress: (content, progress) => {
        const el = ref_loading.current!;
        el.style.display = '';
        el.innerText = `${content}, ${progress}%`;
        el.style.transition = ''
        el.style.opacity = '1'
        window.clearTimeout(ref_tid.current);
        window.clearTimeout(ref_tid2.current);
        ref_tid.current = window.setTimeout(() => {
          el.style.transition = 'opacity 150ms'
          el.style.opacity = '0'
          ref_tid2.current = window.setTimeout(() => { el.style.display = 'none' }, 150)
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