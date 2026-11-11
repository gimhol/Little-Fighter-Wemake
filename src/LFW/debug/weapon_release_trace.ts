import { Ditto } from "../ditto/Instance";

export interface IWeaponReleaseTrace {
  weapon: string;
  spawn: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  inside: boolean;
  seg?: { id: string | undefined; x1: number; x2: number; z1: number; z2: number; h: number };
  exit?: { x: number; y: number; z: number; how: string };
}

const MAX_TRACES = 32;
const traces: string[] = [];
let enabled = false;

function num(v: number): string {
  if (!Number.isFinite(v)) return "-";
  return `${Math.round(v * 1000) / 1000}`;
}

function vec(p: { x: number; y: number; z: number }): string {
  return `(${num(p.x)},${num(p.y)},${num(p.z)})`;
}

export function weapon_release_trace_enabled(): boolean { return enabled; }

export function set_weapon_release_trace_enabled(value: boolean): boolean {
  enabled = value;
  return enabled;
}

export function format_weapon_release(t: IWeaponReleaseTrace): string {
  const parts = [
    `weapon=${t.weapon}`,
    `spawn=${vec(t.spawn)}`,
    `thrower=${vec(t.target)}`,
    `inside=${t.inside}`,
  ];
  if (t.seg) {
    parts.push(
      `seg=${t.seg.id}[x ${num(t.seg.x1)}~${num(t.seg.x2)}, z ${num(t.seg.z1)}~${num(t.seg.z2)}, h ${num(t.seg.h)}]`,
    );
  }
  if (t.exit) parts.push(`exit=${vec(t.exit)} via ${t.exit.how}`);
  return parts.join(" ");
}

export function trace_weapon_event(line: string): void {
  traces.push(line);
  if (traces.length > MAX_TRACES) traces.shift();
  if (enabled) Ditto.Log(line);
}

export function trace_weapon_release(t: IWeaponReleaseTrace): void {
  trace_weapon_event(format_weapon_release(t));
}

export function dump_weapon_release_traces(): string[] {
  return [...traces];
}

export function clear_weapon_release_traces(): void {
  traces.length = 0;
}
