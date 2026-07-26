export type Voidable<T> = T | undefined | null | void;
export type BaseValue = string | number | boolean
/**
 * XML 元素接口，抽象平台无关的 XML 操作
 *
 * @export
 * @interface IXMLElement
 */
export interface IXMLElement {
  /** 标签名 */
  get tag(): string;
  /** 子元素列表 */
  get children(): IXMLElement[];
  /** 属性列表 */
  get attrs(): { name: string; value: string; }[];
  /** 文本内容 */
  get text(): string;
  /** 父元素 */
  get parent(): IXMLElement | undefined;

  /**
   * 获取属性原始字符串值
   * @param {string} name - 属性名
   * @return {string | undefined}
   */
  attr(name: string): string | undefined;

  /**
   * 删除属性
   * @param {string} name - 属性名
   */
  del_attr(name: string): void;

  /**
   * 获取字符串属性
   * @param {string} name - 属性名
   * @return {string | undefined}
   */
  get_str(name: string): string | undefined;

  /**
   * 获取数值属性
   * @param {string} name - 属性名
   * @return {number | undefined}
   */
  num_attr(name: string): number | undefined;

  /**
   * 获取布尔属性（"true" / "1" 为 true）
   * @param {string} name - 属性名
   * @return {boolean | undefined}
   */
  bool_attr(name: string): boolean | undefined;

  /**
   * 获取字符串数组属性，按分隔符拆分为数组
   * @param {string}  name - 属性名
   * @param {string} [sep=","] - 分隔符
   * @return {string[] | undefined}
   */
  strs_attr(name: string, sep?: string): string[] | undefined;

  /**
   * 获取数值数组属性，按分隔符拆分并转为数字
   * @param {string}  name - 属性名
   * @param {string} [sep=","] - 分隔符
   * @return {number[] | undefined}
   */
  nums_attr(name: string, sep?: string): number[] | undefined;

  /**
   * 获取字符串数组属性（空段保留为 undefined）
   * @param {string}  name - 属性名
   * @param {string} [sep=","] - 分隔符
   * @return {Voidable<string>[] | undefined}
   */
  strs_attr_soft(name: string, sep?: string): Voidable<string>[] | undefined;

  /**
   * 获取数值数组属性（空段保留为 undefined）
   * @param {string}  name - 属性名
   * @param {string} [sep=","] - 分隔符
   * @return {Voidable<number>[] | undefined}
   */
  nums_attr_soft(name: string, sep?: string): Voidable<number>[] | undefined;

  /**
   * 设置属性原始值，value 为 Voidable 时删除属性
   * @param {string}          name  - 属性名
   * @param {Voidable<string>} value - 值
   */
  set_attr(name: string, value: Voidable<BaseValue | BaseValue[]>, sep?: string): void;

  /**
   * 设置字符串数组属性（undefined 元素转为空字符串），value 为 Voidable 时删除属性
   *
   * 可传入单个字符串（自动包装为数组）
   * 
   * 后面的void会被抛弃，中间的void会视为空字符串
   * @param {string}                  name  - 属性名
   * @param {Voidable<Voidable<string> | Voidable<string>[]>} value - 值
   * @param {string}                 [sep=","] - 分隔符
   */
  set_arr_attr_soft(name: string, value: Voidable<Voidable<BaseValue> | Voidable<BaseValue>[]>, sep?: string): void;

  /**
   * 解析元素为类型化值（根据 type 属性或 tagName 自动推断类型）
   */
  as_value(): number | boolean | string | object | undefined
  as_string(or: string): string;
  as_string(or?: string): string | undefined;
  as_number(or: number): number;
  as_number(or?: number): number | undefined;
  as_boolean(or: boolean): boolean;
  as_boolean(or?: boolean): boolean | undefined;
  as_array(or: any[]): any[];
  as_array(or?: any[]): any[] | undefined;
  as_object(or: object): object;
  as_object(or?: object): object | undefined;

  /**
   * 将元素解析为普通对象，属性名→值
   *
   * 遍历所有直接属性（attrs）和全部子元素，子元素取其 `name` 属性为 key、
   * `value()` 为 value。结果为空时返回 `or` 回退值。
   *
   * 注意：来自 {@link attrs} 的值始终为 **字符串**（XML 属性原始值），
   * 而来自子元素的值通过 `value()` 解析，可为 number / boolean / object / array 等类型。
   *
   * 非 value 型标签（如 `<frame>`、`<phase>` 等）的 `value()` 最终回退到
   * `as_object()` 递归调用，因此只要带有子属性或文本，就会被视为嵌套对象。
   *
   * @example
   * // 非 value 型标签也会被视为对象
   * // <entity>
   * //   <frame name="standing">
   * //     <pic tex="sprite/0.png" x="0" y="0" w="79" h="79"/>
   * //     <next id="1" wait="3"/>
   * //   </frame>
   * // </entity>
   *
   * el.as_object({});
   * // {
   * //   standing: {
   * //     // <pic> 和 <next> 也被递归解析为对象
   * //   }
   * // }
   *
   * @overload
   * @param  {object} or - 结果为空时回退到此值
   * @return {object}
   *
   * @overload
   * @param  {object} [or] - 可选回退
   * @return {object | undefined}
   *
   * @example
   * // 混合类型
   * // <dataset>
   * //   <number name="gravity">1.5</number>
   * //   <boolean name="pvp">true</boolean>
   * //   <string name="mode">ranked</string>
   * // </dataset>
   *
   * el.as_object({});
   * // { gravity: 1.5, pvp: true, mode: "ranked" }
   *
   * @example
   * // 嵌套对象（`<object>` 子元素递归解析）
   * // <dataset>
   * //   <object name="bounds">
   * //     <number name="left">0</number>
   * //     <number name="right">800</number>
   * //   </object>
   * //   <array name="tags">
   * //     <string>fast</string>
   * //     <string>flying</string>
   * //   </array>
   * // </dataset>
   *
   * el.as_object({});
   * // {
   * //   bounds: { left: 0, right: 800 },
   * //   tags: ["fast", "flying"],
   * // }
   *
   * @example
   * // 空元素回退
   * el.as_object();        // undefined（无参重载）
   * el.as_object({});      // {}（有参重载）
   */
  as_object(or: object): object;
  as_object(or?: object): object | undefined;

  /**
   * 解析为动作字符串（"action(args)" 格式）
   */
  action_str(): string;

  /**
   * 序列化为 XML 字符串
   * @return {string}
   */
  stringify(): string;

  /**
   * 插入子元素到指定位置
   * @param {this}  child - 子元素
   * @param {number} [index] - 插入位置，默认末尾
   */
  insert(child?: this, index?: number): void;

  /**
   * 移除指定子元素
   * @param {this} child - 子元素
   * @return {boolean} 是否成功移除
   */
  remove(child: this): boolean;

  /**
   * 从父元素中移除自身
   * @return {boolean} 是否成功移除
   */
  remove_self(): boolean;

  /**
   * 移除所有子元素
   */
  remove_all(): void;

  /**
   * 是否存在指定属性
   * @param {string} name - 属性名
   * @return {boolean}
   */
  has_attr(name: string): boolean;

  /**
   * 设置文本内容
   * @param {string} text - 文本
   */
  set_text(text: string): void;

  /**
   * 按标签名查找子元素列表
   * @param {string} tag - 标签名
   * @return {IXMLElement[]}
   */
  children_by_tag(tag: string): IXMLElement[];

  /**
   * 按标签名查找第一个子元素
   * @param {string} tag - 标签名
   * @return {IXMLElement | undefined}
   */
  child_by_tag(tag: string): IXMLElement | undefined;

  /**
   * 1. 查找子节点tag为name的节点
   * 2. return 子节点.as_string() ?? this.attr(name)
   */
  get_str(name: string, or: string): string;
  get_str(name: string, or?: string): string | undefined;

  get_num(name: string, or: number): number;
  get_num(name: string, or?: number): number | undefined;

  get_bool(name: string, or: boolean): boolean;
  get_bool(name: string, or?: boolean): boolean | undefined;

  get_str_arr(name: string, or: string[]): string[];
  get_str_arr(name: string, or?: string[]): string[] | undefined;

  get_num_arr(name: string, or: number[]): number[];
  get_num_arr(name: string, or?: number[]): number[] | undefined;

  get_obj(tag: string): object | undefined;
}