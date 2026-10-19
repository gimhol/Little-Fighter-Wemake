import type { IDirectorData, IDirectorGroupData } from "../defines/IDirectorData";
import type { IDirectorIndex } from "../defines/IDirectorIndex";

export function to_director_list(raw: unknown): IDirectorData[] {
  if (!raw || typeof raw !== "object") return [];
  if (Array.isArray(raw))
    return raw.filter(is_director);
  const directors = (raw as { directors?: unknown }).directors;
  if (Array.isArray(directors))
    return directors.filter(is_director);
  return is_director(raw) ? [raw] : [];
}

function is_director(raw: unknown): raw is IDirectorData {
  return !!raw && typeof raw === "object" && typeof (raw as { name?: unknown }).name === "string";
}

export function make_director_group(
  index: IDirectorIndex,
  raw: unknown,
  file: string = index.file,
): IDirectorGroupData {
  const name = index.name ?? (raw as { name?: unknown } | null)?.name;
  const ret: IDirectorGroupData = { id: index.id, file, directors: to_director_list(raw) };
  if (typeof name === "string" && name) ret.name = name;
  return ret;
}
