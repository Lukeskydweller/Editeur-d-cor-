import { describe, it, expect } from 'vitest';
import { cursorFor } from '@/components/ResizeHandlesOverlay';
import type { ResizeHandle } from '@/lib/ui/resize';

describe('resize cursor mapping', () => {
  describe('rotation 0°', () => {
    it('n/s → ns-resize', () => {
      expect(cursorFor('n', 0)).toBe('ns-resize');
      expect(cursorFor('s', 0)).toBe('ns-resize');
    });

    it('e/w → ew-resize', () => {
      expect(cursorFor('e', 0)).toBe('ew-resize');
      expect(cursorFor('w', 0)).toBe('ew-resize');
    });

    it('ne/sw → nesw-resize', () => {
      expect(cursorFor('ne', 0)).toBe('nesw-resize');
      expect(cursorFor('sw', 0)).toBe('nesw-resize');
    });

    it('nw/se → nwse-resize', () => {
      expect(cursorFor('nw', 0)).toBe('nwse-resize');
      expect(cursorFor('se', 0)).toBe('nwse-resize');
    });
  });

  describe('rotation 90°', () => {
    it('n/s → ew-resize (rotated)', () => {
      expect(cursorFor('n', 90)).toBe('ew-resize');
      expect(cursorFor('s', 90)).toBe('ew-resize');
    });

    it('e/w → ns-resize (rotated)', () => {
      expect(cursorFor('e', 90)).toBe('ns-resize');
      expect(cursorFor('w', 90)).toBe('ns-resize');
    });

    it('ne/sw → nwse-resize (rotated)', () => {
      expect(cursorFor('ne', 90)).toBe('nwse-resize');
      expect(cursorFor('sw', 90)).toBe('nwse-resize');
    });

    it('nw/se → nesw-resize (rotated)', () => {
      expect(cursorFor('nw', 90)).toBe('nesw-resize');
      expect(cursorFor('se', 90)).toBe('nesw-resize');
    });
  });

  describe('rotation 180°', () => {
    it('n/s → ns-resize (same as 0°)', () => {
      expect(cursorFor('n', 180)).toBe('ns-resize');
      expect(cursorFor('s', 180)).toBe('ns-resize');
    });

    it('e/w → ew-resize (same as 0°)', () => {
      expect(cursorFor('e', 180)).toBe('ew-resize');
      expect(cursorFor('w', 180)).toBe('ew-resize');
    });

    it('ne/sw → nesw-resize (same as 0°)', () => {
      expect(cursorFor('ne', 180)).toBe('nesw-resize');
      expect(cursorFor('sw', 180)).toBe('nesw-resize');
    });

    it('nw/se → nwse-resize (same as 0°)', () => {
      expect(cursorFor('nw', 180)).toBe('nwse-resize');
      expect(cursorFor('se', 180)).toBe('nwse-resize');
    });
  });

  describe('rotation 270°', () => {
    it('n/s → ew-resize (same as 90°)', () => {
      expect(cursorFor('n', 270)).toBe('ew-resize');
      expect(cursorFor('s', 270)).toBe('ew-resize');
    });

    it('e/w → ns-resize (same as 90°)', () => {
      expect(cursorFor('e', 270)).toBe('ns-resize');
      expect(cursorFor('w', 270)).toBe('ns-resize');
    });

    it('ne/sw → nwse-resize (same as 90°)', () => {
      expect(cursorFor('ne', 270)).toBe('nwse-resize');
      expect(cursorFor('sw', 270)).toBe('nwse-resize');
    });

    it('nw/se → nesw-resize (same as 90°)', () => {
      expect(cursorFor('nw', 270)).toBe('nesw-resize');
      expect(cursorFor('se', 270)).toBe('nesw-resize');
    });
  });

  describe('edge cases', () => {
    it('handles negative angles', () => {
      expect(cursorFor('n', -90)).toBe('ew-resize');
      expect(cursorFor('e', -90)).toBe('ns-resize');
    });

    it('handles angles > 360°', () => {
      expect(cursorFor('n', 450)).toBe('ew-resize'); // 450° = 90°
      expect(cursorFor('e', 450)).toBe('ns-resize');
    });

    it('handles non-90° multiples by rounding', () => {
      expect(cursorFor('n', 85)).toBe('ew-resize'); // rounds to 90°
      expect(cursorFor('n', 95)).toBe('ew-resize'); // rounds to 90°
      expect(cursorFor('n', 45)).toBe('ew-resize'); // rounds to 90° (Math.round(45/90) = 1)
      expect(cursorFor('n', 40)).toBe('ns-resize'); // rounds to 0° (Math.round(40/90) = 0)
    });
  });
});
