import { new_networking_error, type INetworkingError } from "./IConnError";
import { ErrCode } from "./ErrCode";
import type { IReq } from "./_Base";

export function req_unknown_error(req: IReq, error: Error): INetworkingError {
  return new_networking_error({
    name: error.name,
    message: error.message,
    type: req.type,
    pid: req.pid,
    code: ErrCode.Unknown,
    error: `unknown error`
  })
}
