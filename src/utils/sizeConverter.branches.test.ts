/**
 * sizeConverter 分支补充测试
 * 覆盖 convertSizeWithUnit 的 default 分支（line 92）
 */

import { convertSizeWithUnit } from './sizeConverter';

describe('convertSizeWithUnit default branch', () => {
  it('falls back to px for an unrecognized unit', () => {
    // size 10 * scale 2 = 20; an unknown unit must hit the switch `default`
    // branch and return a px string.
    const result = convertSizeWithUnit(10, 2, 'em' as unknown as 'px' | 'rem' | 'vw');
    expect(result).toBe('20px');
  });
});
