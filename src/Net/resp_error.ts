import { ErrCode } from "./ErrCode";
import { new_networking_error, type INetworkingError } from "./IConnError";
import type { IResp } from "./_Base";

export function resp_error(resp: IResp): INetworkingError {
  const code = resp.code ?? ErrCode.Unknown;
  const info = resp.error ?? 'unknown error';
  return new_networking_error({
    name: 'RespError',
    message: `[${code}]${info}`,
    type: resp.type ?? 'unknown',
    pid: '',
    code: resp.code ?? ErrCode.Unknown,
    error: info,
  })
}
