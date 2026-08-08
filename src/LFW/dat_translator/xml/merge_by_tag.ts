import type { IXMLElement } from "../../ditto";

/**
 * 获取合并后首个结果（多个同名 tag 时 Object.assign 合并，后者覆盖前者）
 * @param el      父元素
 * @param tag     标签名
 * @param parser  解析函数
 * @param target  
 * @return 合并后的解析结果，无匹配时 undefined
 */


export function merge_by_tag<T extends Record<string, any>>(
  el: IXMLElement,
  tag: string,
  parser: (child: IXMLElement) => T,
  target?: T
): T | undefined {
  const children = el.children_by_tag(tag);
  if (!children.length) return void 0;
  let ret: T = parser(children[0]);
  for (let i = 1; i < children.length; i++) {
    ret = Object.assign(ret, parser(children[i]));
  }
  if (target) Object.assign(target, ret);
  return ret;
}
