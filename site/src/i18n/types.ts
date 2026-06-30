import type { zh } from './zh';

export type Lang = 'zh' | 'en';

// zh 是文案 key 的唯一真相源:DictKey 从 zh 的字面量 key 推导。
// en.ts 标注为 Dict(= Record<DictKey, string>),缺任何 key 都会编译报错,
// 保证两套字典始终同构。
export type DictKey = keyof typeof zh;
export type Dict = Record<DictKey, string>;
