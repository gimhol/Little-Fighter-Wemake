export const PLATFORM = "web";

export function supports_platform(
  target: string | string[] | undefined | null,
  platform: string = PLATFORM,
): boolean {
  if (target == null) return true;
  const list = (Array.isArray(target) ? target : [target])
    .flatMap(v => v.split(/[\s,]+/))
    .filter(Boolean);
  return list.length === 0 || list.includes(platform);
}
