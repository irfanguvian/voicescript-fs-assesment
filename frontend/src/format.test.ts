import { describe, expect, it } from 'vitest';
import { formatIdr } from './format';

// Pure unit (Testing Trophy base): currency display. id-ID uses '.' as the
// thousands separator and we append a plain IDR suffix (no minor units).
describe('formatIdr', () => {
  it('formats with id-ID thousands separators and an IDR suffix', () => {
    expect(formatIdr(1_000_000)).toBe('1.000.000 IDR');
  });

  it('handles zero', () => {
    expect(formatIdr(0)).toBe('0 IDR');
  });
});
