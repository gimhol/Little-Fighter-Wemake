/**
 * 错误编号
 *
 * @export
 * @enum {number}
 */
export const enum ErrCode {
  Timeout = -2,
  Unknown = -1,
  NotRegister = 1000,
  AlreadyInRoom = 1001,
  NotInRoom = 1002,
  NotRoomOwner = 1003,
  PlayersTooFew = 1004,
  PlayersNotReady = 1005,
  InvalidRoomId = 1006,
  RoomNotFound = 1007,
  InvalidRoomParameters = 1008,
  ParseFailed = 1009,
  RoomIsFull = 1010,
  ChatMsgEmpty = 1011,
  ChatTargetEmpty = 1012,
  ChatTargetIncorrect = 1013,
  NotAdmin = 1014,
  RoomPwdWrong = 1015,
  RoomAlreadyStart = 1016,
  RoomVersionMismatch = 1017,
}
