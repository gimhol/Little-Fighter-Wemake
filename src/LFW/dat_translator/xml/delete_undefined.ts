
export function delete_undefined<T extends object>(o: T): T {
  const keys = Object.keys(o);
  for (const key of keys)
    if ((o as any)[key] === void 0)
      delete (o as any)[key];
  return o;
}
