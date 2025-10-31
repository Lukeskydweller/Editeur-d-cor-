import { describe, it, expect } from 'vitest';
import { pxToMmFactor } from './coords';

describe('pxToMmFactor', () => {
  it('returns 0.5 for 1200px / 600mm', () => {
    expect(pxToMmFactor(1200, 600)).toBe(0.5);
  });

  it('returns 1 for 600px / 600mm', () => {
    expect(pxToMmFactor(600, 600)).toBe(1);
  });

  it('returns 2 for 300px / 600mm', () => {
    expect(pxToMmFactor(300, 600)).toBe(2);
  });

  it('returns 1 for invalid inputs (0 or negative)', () => {
    expect(pxToMmFactor(0, 600)).toBe(1);
    expect(pxToMmFactor(600, 0)).toBe(1);
    expect(pxToMmFactor(-100, 600)).toBe(1);
    expect(pxToMmFactor(600, -100)).toBe(1);
  });

  it('returns 1 for non-finite inputs', () => {
    expect(pxToMmFactor(Infinity, 600)).toBe(1);
    expect(pxToMmFactor(600, NaN)).toBe(1);
  });
});
