/**
 * 昵称规则（服务端独立实现）
 *
 * 与客户端 `src/LFW/ditto/networking/nickname.ts` 保持一致。
 * 客户端与服务端各自打包、互不引用源码，改动规则时两边都要改。
 */
export const NICKNAME_MAX_LENGTH = 10;

export function clamp_nickname(name: string): string {
  return [...(name ?? '')].slice(0, NICKNAME_MAX_LENGTH).join('');
}
