import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import GroupGhostOverlay from '@/ui/overlays/GroupGhostOverlay';
import { useSceneStore } from '@/state/useSceneStore';
import type { ID, Milli } from '@/types/scene';

describe('GroupGhostOverlay rendering conditions', () => {
  beforeEach(() => {
    useSceneStore.setState({
      scene: {
        pieces: {
          'p1': {
            id: 'p1' as ID,
            kind: 'rect',
            position: { x: 10 as Milli, y: 10 as Milli },
            size: { w: 50 as Milli, h: 50 as Milli },
            rotationDeg: 0,
            layerId: 'L1' as ID,
            materialId: 'M1' as ID,
          },
          'p2': {
            id: 'p2' as ID,
            kind: 'rect',
            position: { x: 100 as Milli, y: 10 as Milli },
            size: { w: 50 as Milli, h: 50 as Milli },
            rotationDeg: 0,
            layerId: 'L1' as ID,
            materialId: 'M1' as ID,
          },
        },
        layers: [],
        materials: [],
        sceneSize: { w: 600 as Milli, h: 400 as Milli },
        validation: { ok: true, problems: [] },
        revision: 1,
      },
      ui: {
        selectedId: null,
        selectedIds: null,
        isTransientActive: false,
        transientBBox: undefined,
        transientDelta: undefined,
        dragging: null,
        resizing: null,
      } as any,
    } as any);
  });

  it('no ghost during solo resize', () => {
    useSceneStore.setState((state) => ({
      ui: {
        ...state.ui,
        selectedId: 'p1' as ID,
        isTransientActive: true,
        transientBBox: { x: 10 as Milli, y: 10 as Milli, w: 60 as Milli, h: 50 as Milli },
        transientDelta: undefined,
        dragging: null, // No dragging during resize
        resizing: { handle: 'e', originalBBox: {} } as any,
      },
    }));

    const { container } = render(<GroupGhostOverlay />);
    const ghosts = container.querySelectorAll('[data-testid="ghost-piece"]');
    expect(ghosts.length).toBe(0);
  });

  it('ghosts render during group drag', () => {
    useSceneStore.setState((state) => ({
      ui: {
        ...state.ui,
        selectedIds: ['p1' as ID, 'p2' as ID],
        isTransientActive: true,
        transientBBox: { x: 15 as Milli, y: 15 as Milli, w: 140 as Milli, h: 50 as Milli },
        transientDelta: { dx: 5 as Milli, dy: 5 as Milli },
        dragging: {
          startClientX: 100,
          startClientY: 100,
          candidate: { valid: true },
        } as any,
        resizing: null,
      },
    }));

    const { container } = render(<GroupGhostOverlay />);
    const ghosts = container.querySelectorAll('[data-testid="ghost-piece"]');
    expect(ghosts.length).toBe(2);

    // Verify ghosts have valid attribute
    ghosts.forEach((ghost) => {
      expect(ghost.getAttribute('data-valid')).toBe('true');
    });
  });
});
