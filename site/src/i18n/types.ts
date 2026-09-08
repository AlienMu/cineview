import type { zh } from './zh';

export type Lang = 'zh' | 'en';

// zh is the single source of truth for content keys: DictKey is derived from zh's literal keys.
// en.ts is annotated as Dict (= Record<DictKey, string>), so missing any key will cause a compile error,
// ensuring both dictionaries remain structurally identical.
export type DictKey = keyof typeof zh;
export type Dict = Record<DictKey, string>;
