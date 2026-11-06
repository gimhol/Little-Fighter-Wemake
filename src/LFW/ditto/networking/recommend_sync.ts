import type { TNetworkingSyncMode } from "./INetworking";

/** 实际下发用的同步模式（不含 auto） */
export type TConcreteSyncMode = 'lockstep' | 'delay';

export const NET_UPS = 60;
export const LOCKSTEP_RTT_RATIO = 1.25;
export const RTT_JITTER_MARGIN = 1.3;
export const MIN_LEAD = 2;
export const MAX_LEAD = 8;
export const UNKNOWN_RTT = 100;

function delay_lead(max_rtt: number, ups: number): number {
  const tick_ms = 1000 / ups;
  const rtt = max_rtt || UNKNOWN_RTT;
  const lead = Math.ceil((rtt * RTT_JITTER_MARGIN) / tick_ms);
  return Math.min(MAX_LEAD, Math.max(MIN_LEAD, lead));
}

export function recommend_sync(max_rtt: number, ups: number = NET_UPS): { sync_mode: TConcreteSyncMode, input_delay: number } {
  const tick_ms = 1000 / ups;
  const rtt = max_rtt || UNKNOWN_RTT;
  if (rtt <= tick_ms * LOCKSTEP_RTT_RATIO)
    return { sync_mode: 'lockstep', input_delay: 1 };
  return { sync_mode: 'delay', input_delay: delay_lead(max_rtt, ups) };
}

export function resolve_sync(choice: TNetworkingSyncMode, max_rtt: number, ups: number = NET_UPS): { sync_mode: TConcreteSyncMode, input_delay: number } {
  if (choice === 'lockstep') return { sync_mode: 'lockstep', input_delay: 1 };
  if (choice === 'delay') return { sync_mode: 'delay', input_delay: delay_lead(max_rtt, ups) };
  return recommend_sync(max_rtt, ups);
}
