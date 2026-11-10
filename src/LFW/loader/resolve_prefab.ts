export type ResolvePrefabResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'missing' | 'cycle'; chain: string[] };

export type PrefabRef = { ref?: string; prefab_id?: string };

function prefab_ref_of(obj: PrefabRef | undefined): string | undefined {
  if (!obj) return void 0;
  const ref = obj.ref ?? obj.prefab_id;
  return ref ? ref : void 0;
}

function has_own_prefab(prefabs: object | undefined, ref: string): boolean {
  return !!prefabs && Object.prototype.hasOwnProperty.call(prefabs, ref);
}

function is_plain_object(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function clone_value<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone_value) as unknown as T;
  if (is_plain_object(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) out[key] = clone_value(value[key]);
    return out as T;
  }
  return value;
}

export function resolve_prefab<T extends PrefabRef>(
  obj: T,
  prefabs?: { [x: string]: T | undefined }
): ResolvePrefabResult<T> {
  const chain: string[] = [];
  let base: T | undefined;
  let ref = prefab_ref_of(obj);
  while (ref !== void 0) {
    if (chain.includes(ref))
      return { ok: false, reason: 'cycle', chain: [...chain, ref] };
    const prefab = has_own_prefab(prefabs, ref) ? prefabs![ref] : void 0;
    if (!prefab)
      return { ok: false, reason: 'missing', chain: [...chain, ref] };
    chain.push(ref);
    base = { ...prefab, ...base };
    ref = prefab_ref_of(prefab);
  }
  const merged = (base ? { ...base, ...obj } : { ...obj }) as T;
  delete merged.ref;
  delete merged.prefab_id;
  return { ok: true, value: chain.length ? clone_value(merged) : merged };
}

export function prefab_error_message(
  tag: string,
  who: string,
  what: string,
  r: { reason: 'missing' | 'cycle'; chain: string[] },
): string {
  return r.reason === 'missing'
    ? `[${tag}] "${who}" ${what} references missing prefab: "${r.chain[r.chain.length - 1]}"`
    : `[${tag}] "${who}" ${what} prefab ref cycle: ${r.chain.join(' -> ')}`;
}

export function prefab_error(
  tag: string,
  who: string,
  what: string,
  r: { reason: 'missing' | 'cycle'; chain: string[] },
) {
  return new Error(prefab_error_message(tag, who, what, r));
}
