/**
 * 数据包信息
 *
 * 每个数据包（如 prel / data / 自定义 FULL 包）对应一条信息，
 * 用于联机时校验各玩家加载的数据是否一致。
 *
 * @export
 * @interface IDataInfo
 */
export interface IDataInfo {
  /**
   * 数据包类型，如 data / prel / FULL
   *
   * @type {string}
   * @memberof IDataInfo
   */
  type?: string;

  /**
   * 数据包文件地址
   *
   * @type {string}
   * @memberof IDataInfo
   */
  url?: string;

  /**
   * 数据包标题
   *
   * @type {string}
   * @memberof IDataInfo
   */
  title?: string;

  /**
   * 数据包描述
   *
   * @type {string}
   * @memberof IDataInfo
   */
  description?: string;

  /**
   * 数据包作者
   *
   * @type {string}
   * @memberof IDataInfo
   */
  author?: string;

  /**
   * 数据版本
   *
   * @type {number}
   * @memberof IDataInfo
   */
  version?: number;

  /**
   * 生成时间
   *
   * @type {string}
   * @memberof IDataInfo
   */
  time?: string;

  /**
   * 数据包 MD5
   *
   * @type {string}
   * @memberof IDataInfo
   */
  md5?: string;
}
