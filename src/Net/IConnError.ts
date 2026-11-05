
export interface INetworkingError {
  readonly __is_networking_error__: true;
  name: string;
  message: string;
  type: string;
  pid: string;
  code: number;
  error: string;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function is_networking_error(v: any): v is INetworkingError {
  if (!v || typeof v !== 'object') return false;
  return v.__is_networking_error__ == true
}
export function new_networking_error(v: Partial<INetworkingError>): INetworkingError {
  return {
    __is_networking_error__: true,
    name: v.name ?? '',
    message: v.message ?? '',
    type: v.type ?? '',
    pid: v.pid ?? '',
    code: v.code ?? 0,
    error: v.error ?? '',
  }
}
