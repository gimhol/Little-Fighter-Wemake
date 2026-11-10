import { describe, expect, it } from '@jest/globals';
import { resolve_prefab } from "../LFW/loader/resolve_prefab";

type T = { ref?: string; prefab_id?: string; id?: string; bdy?: any[]; itr?: any[]; [x: string]: any };

describe('resolve_prefab', () => {
  it('无 ref 时返回浅拷贝，且不共享嵌套数组', () => {
    const raw: T = { id: 'a', bdy: [{ qube: [1, 2, 3, 4] }] };
    const r = resolve_prefab(raw, void 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).not.toBe(raw);
    expect(r.value.id).toBe('a');
  });

  it('单层继承：prefab 字段被 obj 覆盖', () => {
    const prefabs: Record<string, T> = { base: { id: 'base', itr: [{ injury: 1 }], kind: 0 } };
    const r = resolve_prefab<T>({ id: 'child', ref: 'base', kind: 5 }, prefabs);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.id).toBe('child');
    expect(r.value.kind).toBe(5);
    expect(r.value.itr).toEqual([{ injury: 1 }]);
    expect(r.value.ref).toBe(void 0);
  });

  it('多层继承链，近者覆盖远者', () => {
    const prefabs: Record<string, T> = {
      grand: { id: 'grand', kind: 1, injury: 10 },
      parent: { ref: 'grand', kind: 2 },
    };
    const r = resolve_prefab<T>({ id: 'child', ref: 'parent', injury: 30 }, prefabs);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.kind).toBe(2);
    expect(r.value.injury).toBe(30);
  });

  it('继承结果的嵌套数组与 prefab 隔离（不共享引用）', () => {
    const shared = [{ qube: [1, 2, 3, 4] }];
    const prefabs: Record<string, T> = { base: { id: 'base', bdy: shared } };
    const a = resolve_prefab<T>({ id: 'a', ref: 'base' }, prefabs);
    const b = resolve_prefab<T>({ id: 'b', ref: 'base' }, prefabs);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value.bdy).not.toBe(b.value.bdy);
    expect(a.value.bdy).not.toBe(shared);
    a.value.bdy![0].qube[0] = 999;
    expect(b.value.bdy![0].qube[0]).toBe(1);
    expect(shared[0].qube[0]).toBe(1);
  });

  it('空字符串 ref 视为没有 ref', () => {
    const r = resolve_prefab<T>({ id: 'a', ref: '' }, { base: { id: 'base' } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.id).toBe('a');
  });

  it('ref 指向不存在的 prefab 报 missing', () => {
    const r = resolve_prefab<T>({ id: 'a', ref: 'nope' }, { base: { id: 'base' } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('missing');
    expect(r.chain).toEqual(['nope']);
  });

  it('循环引用报 cycle', () => {
    const prefabs: Record<string, T> = { a: { ref: 'b' }, b: { ref: 'a' } };
    const r = resolve_prefab<T>({ id: 'x', ref: 'a' }, prefabs);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('cycle');
    expect(r.chain).toEqual(['a', 'b', 'a']);
  });

  it('不会命中原型链上的名字', () => {
    const r = resolve_prefab<T>({ id: 'a', ref: 'constructor' }, { base: { id: 'base' } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('missing');
  });

  it('prefab_id 等同 ref', () => {
    const r = resolve_prefab<T>({ id: 'a', prefab_id: 'base' }, { base: { id: 'base', kind: 7 } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.kind).toBe(7);
    expect(r.value.prefab_id).toBe(void 0);
  });
});
