export type ResolvePrefabResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'missing' | 'cycle'; chain: string[] };

export function resolve_prefab<T extends { ref?: string, prefab_id?: string }>(
  obj: T,
  prefabs?: { [x: string]: T | undefined }
): ResolvePrefabResult<T> {
  const chain: string[] = [];
  let base: T | undefined;
  let ref = obj.ref ?? obj.prefab_id;
  while (ref !== void 0) {
    if (chain.includes(ref))
      return { ok: false, reason: 'cycle', chain: [...chain, ref] };
    const prefab = prefabs?.[ref];
    if (!prefab)
      return { ok: false, reason: 'missing', chain: [...chain, ref] };
    chain.push(ref);
    base = { ...prefab, ...base };
    ref = prefab.ref ?? prefab.prefab_id;
  }
  return { ok: true, value: base ? { ...base, ...obj } : obj };
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
