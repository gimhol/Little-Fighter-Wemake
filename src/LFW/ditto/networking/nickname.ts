export const NICKNAME_MAX_LENGTH = 10;

export function clamp_nickname(name: string): string {
  return [...(name ?? '')].slice(0, NICKNAME_MAX_LENGTH).join('');
}
