import { new_networking_error, type INetworkingError } from "./IConnError";
import { ErrCode } from "./ErrCode";
import type { IReq } from "./_Base";

export function req_timeout_error(req: IReq, timeout: number): INetworkingError {
  return new_networking_error({
    name: 'TimeoutError',
    message: `timeout! over ${timeout}ms`,
    type: req.type,
    pid: req.pid,
    code: ErrCode.Timeout,
    error: `unknown error`
  })
}
