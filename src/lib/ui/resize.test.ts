import { describe, it, expect } from 'vitest';
import { applyHandle, getHandlePosition, type Rect, type ResizeHandle } from './resize';

describe('resize', () => {
  describe('applyHandle', () => {
    const baseRect: Rect = { x: 100, y: 100, w: 200, h: 100 };

    describe('East handle', () => {
      it('resizes width when dragging right with lockEdge=true', () => {
        const result = applyHandle(baseRect, 'e', { x: 350, y: 150 }, { minW: 5, minH: 5, lockEdge: true });
        expect(result).toEqual({ x: 100, y: 100, w: 250, h: 100 });
      });

      it('resizes width when dragging left with lockEdge=true', () => {
        const result = applyHandle(baseRect, 'e', { x: 250, y: 150 }, { minW: 5, minH: 5, lockEdge: true });
        expect(result).toEqual({ x: 100, y: 100, w: 150, h: 100 });
      });

      it('enforces minimum width', () => {
        const result = applyHandle(baseRect, 'e', { x: 102, y: 150 }, { minW: 50, minH: 5, lockEdge: true });
        expect(result.w).toBe(50);
        expect(result.x).toBe(100);
      });
    });

    describe('West handle', () => {
      it('resizes from left edge with lockEdge=true', () => {
        const result = applyHandle(baseRect, 'w', { x: 50, y: 150 }, { minW: 5, minH: 5, lockEdge: true });
        expect(result).toEqual({ x: 50, y: 100, w: 250, h: 100 });
      });

      it('enforces minimum width when dragging right', () => {
        const result = applyHandle(baseRect, 'w', { x: 280, y: 150 }, { minW: 50, minH: 5, lockEdge: true });
        expect(result.w).toBe(50);
        expect(result.x).toBe(250); // right edge at 300, so x = 300 - 50
      });
    });

    describe('North handle', () => {
      it('resizes from top edge with lockEdge=true', () => {
        const result = applyHandle(baseRect, 'n', { x: 200, y: 50 }, { minW: 5, minH: 5, lockEdge: true });
        expect(result).toEqual({ x: 100, y: 50, w: 200, h: 150 });
      });

      it('enforces minimum height', () => {
        const result = applyHandle(baseRect, 'n', { x: 200, y: 180 }, { minW: 5, minH: 50, lockEdge: true });
        expect(result.h).toBe(50);
        expect(result.y).toBe(150); // bottom at 200, so y = 200 - 50
      });
    });

    describe('South handle', () => {
      it('resizes from bottom edge with lockEdge=true', () => {
        const result = applyHandle(baseRect, 's', { x: 200, y: 250 }, { minW: 5, minH: 5, lockEdge: true });
        expect(result).toEqual({ x: 100, y: 100, w: 200, h: 150 });
      });

      it('enforces minimum height when dragging up', () => {
        const result = applyHandle(baseRect, 's', { x: 200, y: 120 }, { minW: 5, minH: 50, lockEdge: true });
        expect(result.h).toBe(50);
        expect(result.y).toBe(100);
      });
    });

    describe('NorthEast handle', () => {
      it('resizes from top-right corner with lockEdge=true', () => {
        const result = applyHandle(baseRect, 'ne', { x: 350, y: 50 }, { minW: 5, minH: 5, lockEdge: true });
        expect(result).toEqual({ x: 100, y: 50, w: 250, h: 150 });
      });

      it('enforces minimum dimensions', () => {
        const result = applyHandle(baseRect, 'ne', { x: 102, y: 180 }, { minW: 50, minH: 30, lockEdge: true });
        expect(result.w).toBe(50);
        expect(result.h).toBe(30);
      });
    });

    describe('NorthWest handle', () => {
      it('resizes from top-left corner with lockEdge=true', () => {
        const result = applyHandle(baseRect, 'nw', { x: 50, y: 50 }, { minW: 5, minH: 5, lockEdge: true });
        expect(result).toEqual({ x: 50, y: 50, w: 250, h: 150 });
      });

      it('enforces minimum dimensions', () => {
        const result = applyHandle(baseRect, 'nw', { x: 280, y: 180 }, { minW: 50, minH: 30, lockEdge: true });
        expect(result.w).toBe(50);
        expect(result.h).toBe(30);
      });
    });

    describe('SouthEast handle', () => {
      it('resizes from bottom-right corner with lockEdge=true', () => {
        const result = applyHandle(baseRect, 'se', { x: 350, y: 250 }, { minW: 5, minH: 5, lockEdge: true });
        expect(result).toEqual({ x: 100, y: 100, w: 250, h: 150 });
      });

      it('enforces minimum dimensions', () => {
        const result = applyHandle(baseRect, 'se', { x: 120, y: 120 }, { minW: 50, minH: 30, lockEdge: true });
        expect(result.w).toBe(50);
        expect(result.h).toBe(30);
      });
    });

    describe('SouthWest handle', () => {
      it('resizes from bottom-left corner with lockEdge=true', () => {
        const result = applyHandle(baseRect, 'sw', { x: 50, y: 250 }, { minW: 5, minH: 5, lockEdge: true });
        expect(result).toEqual({ x: 50, y: 100, w: 250, h: 150 });
      });

      it('enforces minimum dimensions', () => {
        const result = applyHandle(baseRect, 'sw', { x: 280, y: 120 }, { minW: 50, minH: 30, lockEdge: true });
        expect(result.w).toBe(50);
        expect(result.h).toBe(30);
      });
    });

    describe('lockEdge behavior', () => {
      it('lockEdge=false allows both edges to move (not implemented in V1, same as true)', () => {
        // V1: lockEdge always acts as true (opposite edge stays fixed)
        const result = applyHandle(baseRect, 'e', { x: 350, y: 150 }, { minW: 5, minH: 5, lockEdge: false });
        expect(result.x).toBe(100); // Left edge stays fixed
        expect(result.w).toBe(250);
      });

      it('lockEdge=true keeps opposite edge fixed', () => {
        const result = applyHandle(baseRect, 'w', { x: 50, y: 150 }, { minW: 5, minH: 5, lockEdge: true });
        expect(result.x).toBe(50);
        expect(result.w).toBe(250);
        // Right edge at x + w should be 300 (original right)
        expect(result.x + result.w).toBe(300);
      });
    });

    describe('extreme cases', () => {
      it('handles negative dimensions gracefully (enforces min)', () => {
        const result = applyHandle(baseRect, 'e', { x: 50, y: 150 }, { minW: 10, minH: 5, lockEdge: true });
        expect(result.w).toBeGreaterThanOrEqual(10);
      });

      it('handles very small rect', () => {
        const smallRect: Rect = { x: 0, y: 0, w: 10, h: 10 };
        const result = applyHandle(smallRect, 'se', { x: 100, y: 100 }, { minW: 5, minH: 5, lockEdge: true });
        expect(result).toEqual({ x: 0, y: 0, w: 100, h: 100 });
      });
    });
  });

  describe('getHandlePosition', () => {
    const rect: Rect = { x: 100, y: 100, w: 200, h: 100 };

    it('returns correct position for N handle', () => {
      expect(getHandlePosition(rect, 'n')).toEqual({ x: 200, y: 100 });
    });

    it('returns correct position for S handle', () => {
      expect(getHandlePosition(rect, 's')).toEqual({ x: 200, y: 200 });
    });

    it('returns correct position for E handle', () => {
      expect(getHandlePosition(rect, 'e')).toEqual({ x: 300, y: 150 });
    });

    it('returns correct position for W handle', () => {
      expect(getHandlePosition(rect, 'w')).toEqual({ x: 100, y: 150 });
    });

    it('returns correct position for NE handle', () => {
      expect(getHandlePosition(rect, 'ne')).toEqual({ x: 300, y: 100 });
    });

    it('returns correct position for NW handle', () => {
      expect(getHandlePosition(rect, 'nw')).toEqual({ x: 100, y: 100 });
    });

    it('returns correct position for SE handle', () => {
      expect(getHandlePosition(rect, 'se')).toEqual({ x: 300, y: 200 });
    });

    it('returns correct position for SW handle', () => {
      expect(getHandlePosition(rect, 'sw')).toEqual({ x: 100, y: 200 });
    });
  });
});
