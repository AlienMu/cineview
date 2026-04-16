import { convertSize, calculateScale, pxToRem, pxToVw, convertSizeWithUnit } from './sizeConverter';

describe('sizeConverter', () => {
  describe('convertSize', () => {
    it('should convert px unit based on scale', () => {
      // scale = 375 / 750 = 0.5, 100 * 0.5 = 50
      expect(convertSize(100, 750, 375, 'px')).toBe(50);
      // scale = 750 / 750 = 1, 200 * 1 = 200
      expect(convertSize(200, 750, 750, 'px')).toBe(200);
    });

    it('should convert rem unit based on scale', () => {
      expect(convertSize(100, 750, 375, 'rem')).toBe(50);
      expect(convertSize(100, 750, 750, 'rem')).toBe(100);
    });

    it('should convert vw unit based on scale', () => {
      expect(convertSize(100, 750, 375, 'vw')).toBe(50);
      expect(convertSize(100, 750, 1500, 'vw')).toBe(200);
    });

    it('should handle zero values', () => {
      expect(convertSize(0, 750, 375, 'px')).toBe(0);
      expect(convertSize(0, 750, 375, 'rem')).toBe(0);
      expect(convertSize(0, 750, 375, 'vw')).toBe(0);
    });

    it('should handle negative values', () => {
      expect(convertSize(-100, 750, 375, 'px')).toBe(-50);
      expect(convertSize(-100, 750, 375, 'rem')).toBe(-50);
      expect(convertSize(-100, 750, 375, 'vw')).toBe(-50);
    });

    it('should handle decimal values', () => {
      expect(convertSize(100.5, 750, 375, 'px')).toBeCloseTo(50.25);
      expect(convertSize(100.5, 750, 375, 'rem')).toBeCloseTo(50.25);
      expect(convertSize(100.5, 750, 375, 'vw')).toBeCloseTo(50.25);
    });
  });

  describe('calculateScale', () => {
    it('should calculate correct scale', () => {
      expect(calculateScale(375, 750)).toBe(0.5);
      expect(calculateScale(750, 750)).toBe(1);
      expect(calculateScale(1500, 750)).toBe(2);
    });

    it('should handle decimal results', () => {
      expect(calculateScale(400, 750)).toBeCloseTo(0.533, 3);
    });

    it('should throw error for zero or negative design size', () => {
      expect(() => calculateScale(375, 0)).toThrow('Design size must be greater than 0');
      expect(() => calculateScale(375, -750)).toThrow('Design size must be greater than 0');
    });

    it('should handle very small viewport widths', () => {
      expect(calculateScale(1, 750)).toBeCloseTo(0.00133, 5);
    });

    it('should handle very large viewport widths', () => {
      expect(calculateScale(10000, 750)).toBeCloseTo(13.333, 3);
    });
  });

  describe('pxToRem', () => {
    it('should convert px to rem with default base font size', () => {
      expect(pxToRem(16)).toBe(1);
      expect(pxToRem(32)).toBe(2);
      expect(pxToRem(8)).toBe(0.5);
    });

    it('should convert px to rem with custom base font size', () => {
      expect(pxToRem(20, 20)).toBe(1);
      expect(pxToRem(40, 20)).toBe(2);
      expect(pxToRem(10, 20)).toBe(0.5);
    });

    it('should handle zero values', () => {
      expect(pxToRem(0)).toBe(0);
      expect(pxToRem(0, 20)).toBe(0);
    });

    it('should handle decimal values', () => {
      expect(pxToRem(24, 16)).toBe(1.5);
      expect(pxToRem(12, 16)).toBe(0.75);
    });

    it('should handle negative values', () => {
      expect(pxToRem(-16)).toBe(-1);
      expect(pxToRem(-32, 16)).toBe(-2);
    });
  });

  describe('pxToVw', () => {
    it('should convert px to vw', () => {
      expect(pxToVw(375, 375)).toBe(100);
      expect(pxToVw(187.5, 375)).toBe(50);
      expect(pxToVw(750, 750)).toBe(100);
    });

    it('should handle zero values', () => {
      expect(pxToVw(0, 375)).toBe(0);
    });

    it('should handle decimal values', () => {
      expect(pxToVw(100, 375)).toBeCloseTo(26.667, 3);
    });

    it('should handle negative values', () => {
      expect(pxToVw(-375, 375)).toBe(-100);
    });

    it('should handle different viewport widths', () => {
      expect(pxToVw(100, 1000)).toBe(10);
      expect(pxToVw(50, 500)).toBe(10);
    });
  });

  describe('convertSizeWithUnit', () => {
    it('should convert and return px unit', () => {
      expect(convertSizeWithUnit(100, 0.5, 'px')).toBe('50px');
      expect(convertSizeWithUnit(100, 1, 'px')).toBe('100px');
      expect(convertSizeWithUnit(100, 2, 'px')).toBe('200px');
    });

    it('should convert and return rem unit', () => {
      expect(convertSizeWithUnit(32, 1, 'rem')).toBe('2rem');
      expect(convertSizeWithUnit(16, 1, 'rem')).toBe('1rem');
      expect(convertSizeWithUnit(8, 1, 'rem')).toBe('0.5rem');
    });

    it('should convert and return vw unit', () => {
      expect(convertSizeWithUnit(375, 1, 'vw', 375)).toBe('100vw');
      expect(convertSizeWithUnit(187.5, 1, 'vw', 375)).toBe('50vw');
    });

    it('should throw error when viewport width is missing for vw conversion', () => {
      expect(() => convertSizeWithUnit(100, 1, 'vw')).toThrow(
        'Viewport width is required for vw conversion'
      );
    });

    it('should handle zero values', () => {
      expect(convertSizeWithUnit(0, 1, 'px')).toBe('0px');
      expect(convertSizeWithUnit(0, 1, 'rem')).toBe('0rem');
      expect(convertSizeWithUnit(0, 1, 'vw', 375)).toBe('0vw');
    });

    it('should handle negative values', () => {
      expect(convertSizeWithUnit(-100, 1, 'px')).toBe('-100px');
      expect(convertSizeWithUnit(-32, 1, 'rem')).toBe('-2rem');
      expect(convertSizeWithUnit(-375, 1, 'vw', 375)).toBe('-100vw');
    });

    it('should handle decimal scale values', () => {
      expect(convertSizeWithUnit(100, 0.75, 'px')).toBe('75px');
      expect(convertSizeWithUnit(100, 1.5, 'px')).toBe('150px');
    });
  });
});
