export class RestError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'RestError';
    this.status = status;
    this.code = code;
  }
  static bad_request(message: string, code?: string) { return new RestError(400, message, code) }
  static unauthorized(message = '需要携带有效的 token', code?: string) { return new RestError(401, message, code) }
  static forbidden(message = '没有权限', code?: string) { return new RestError(403, message, code) }
  static not_found(message = '接口不存在', code?: string) { return new RestError(404, message, code) }
  static method_not_allowed(message = '方法不被允许', code?: string) { return new RestError(405, message, code) }
  static conflict(message: string, code?: string) { return new RestError(409, message, code) }
  static too_large(message: string, code?: string) { return new RestError(413, message, code) }
  static too_many_requests(message: string, code?: string) { return new RestError(429, message, code) }
  static internal(message = '服务器内部错误', code?: string) { return new RestError(500, message, code) }
}
