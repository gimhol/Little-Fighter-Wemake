/** 有点蠢 */
export function one_or_arr<T>(mess: T | T[] | undefined) {
  if (!Array.isArray(mess)) return mess;
  if (mess.length == 1) return mess[0];
  return mess;
}
