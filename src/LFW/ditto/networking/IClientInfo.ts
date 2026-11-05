/**
 * 客户端信息
 *
 * @export
 * @interface IClientInfo
 */

export interface IClientInfo {
  /**
   * 客户ID
   *
   * @type {string}
   * @memberof IClientInfo
   */
  id?: string;

  /**
   * 客户端姓名
   *
   * @type {string}
   * @memberof IClientInfo
   */
  name?: string;

  /**
   * 玩家姓名
   *
   * @type {string}
   * @memberof IClientInfo
   */
  players?: string[];

  ready?: boolean
}
