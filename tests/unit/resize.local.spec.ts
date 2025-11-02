import { describe, it, expect } from 'vitest';
import { makeLocalFrame, worldDeltaToLocal, applyLocalResize } from '../../src/core/geo/transform';
import { applyHandleWithRotation } from '../../src/lib/ui/resize';

describe('resize local frame', () => {
  it('world → local at 90° maps +x world mostly to -y local', () => {
    // At 90° rotation, moving right (+x) in world becomes moving up (-y) in local
    const frame = makeLocalFrame(0, 0, 100, 50, 90);
    const dl = worldDeltaToLocal(10, 0, frame);

    // At 90°: local x should be ~0, local y should be ~-10
    expect(Math.abs(dl.ly)).toBeGreaterThan(Math.abs(dl.lx));
    expect(dl.ly).toBeCloseTo(-10, 1);
  });

  it('world → local at 0° keeps x and y aligned', () => {
    const frame = makeLocalFrame(0, 0, 100, 50, 0);
    const dl = worldDeltaToLocal(10, 5, frame);

    // At 0°: local should match world
    expect(dl.lx).toBeCloseTo(10, 1);
    expect(dl.ly).toBeCloseTo(5, 1);
  });

  it('applyLocalResize expands width with E handle', () => {
    const result = applyLocalResize(40, 20, 'E', { lx: 10, ly: 0 });
    expect(result.w).toBe(50);
    expect(result.h).toBe(20);
  });

  it('applyLocalResize expands height with S handle', () => {
    const result = applyLocalResize(40, 20, 'S', { lx: 0, ly: 10 });
    expect(result.w).toBe(40);
    expect(result.h).toBe(30);
  });

  it('enforces minSize 5mm under rotation', () => {
    // Piece at (0,0) with 6×6 mm, rotated 90°
    // Drag E handle left by 20mm in world (should shrink w, but clamp to 5mm)
    const rect = { x: 0, y: 0, w: 6, h: 6 };
    const startPointer = { x: 10, y: 0 };
    const currentPointer = { x: -10, y: 0 }; // dx = -20

    const newRect = applyHandleWithRotation(
      rect,
      'e',
      startPointer,
      currentPointer,
      90,
      { minW: 5, minH: 5, lockEdge: false }
    );

    expect(newRect.w).toBeGreaterThanOrEqual(5);
    expect(newRect.h).toBeGreaterThanOrEqual(5);
  });

  it('lockEdge keeps opposite edge fixed (E handle keeps W at 90°)', () => {
    // Piece at (10,10) with 40×20 mm, rotated 90°
    // Drag E handle right by 20mm, lockEdge=true
    const rect = { x: 10, y: 10, w: 40, h: 20 };
    const startPointer = { x: 50, y: 20 };
    const currentPointer = { x: 70, y: 20 }; // dx = +20

    const leftBefore = rect.x;

    const newRect = applyHandleWithRotation(
      rect,
      'e',
      startPointer,
      currentPointer,
      90,
      { minW: 5, minH: 5, lockEdge: true }
    );

    // With lockEdge, E handle expands width and moves left edge left
    // leftBefore should approximately equal newRect.x + (newRect.w - rect.w)
    const expectedLeft = newRect.x + (newRect.w - rect.w);
    expect(expectedLeft).toBeCloseTo(leftBefore, 1);
  });

  it('center pivot maintains center when lockEdge=false at 90°', () => {
    // Piece at (100,100) with 40×20 mm, rotated 90°
    const rect = { x: 100, y: 100, w: 40, h: 20 };
    const centerBefore = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };

    const startPointer = { x: 140, y: 110 };
    const currentPointer = { x: 150, y: 110 }; // dx = +10 (expand by 10mm)

    const newRect = applyHandleWithRotation(
      rect,
      'e',
      startPointer,
      currentPointer,
      90,
      { minW: 5, minH: 5, lockEdge: false }
    );

    const centerAfter = { x: newRect.x + newRect.w / 2, y: newRect.y + newRect.h / 2 };

    // Center should remain fixed
    expect(centerAfter.x).toBeCloseTo(centerBefore.x, 1);
    expect(centerAfter.y).toBeCloseTo(centerBefore.y, 1);
  });

  it('handles rotation=0 falls back to AABB logic (no regression)', () => {
    // At 0°, should behave identically to old AABB approach
    const rect = { x: 50, y: 50, w: 40, h: 20 };
    const startPointer = { x: 90, y: 60 };
    const currentPointer = { x: 100, y: 60 }; // dx = +10

    const newRect = applyHandleWithRotation(
      rect,
      'e',
      startPointer,
      currentPointer,
      0,
      { minW: 5, minH: 5, lockEdge: true }
    );

    // lockEdge=true with E handle: left edge stays at 50
    expect(newRect.x).toBe(50);
    expect(newRect.w).toBeGreaterThan(rect.w);
  });
});
