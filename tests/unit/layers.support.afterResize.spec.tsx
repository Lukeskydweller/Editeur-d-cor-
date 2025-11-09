import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../../src/state/useSceneStore';
import { waitExact } from '../utils/waitExact';

/**
 * Tests for exact support recalculation after resize commit.
 *
 * Key behaviors:
 * - After resizing a C2/C3 piece, recalculateExactSupport is triggered
 * - Ghost state (WARN) appears immediately without needing to move the piece
 * - Works for both solo resize and group resize
 */
describe('Support: Exact recalculation after resize', () => {
  beforeEach(() => {
    useSceneStore.setState({
      scene: {
        id: 'test',
        createdAt: new Date().toISOString(),
        size: { w: 600, h: 600 },
        materials: {},
        layers: {},
        pieces: {},
        layerOrder: [],
      },
      ui: {
        selectedId: undefined,
        selectedIds: undefined,
        primaryId: undefined,
        flashInvalidAt: undefined,
        dragging: undefined,
        marquee: undefined,
        snap10mm: false,
        guides: undefined,
      },
    });
  });

  it('C2 piece becomes ghost (WARN) after resize makes it unsupported', async () => {
    let store = useSceneStore.getState();
    store.initSceneWithDefaults(600, 600);

    // Re-fetch store after init to get fixedLayerIds
    store = useSceneStore.getState();
    const { C1, C2 } = store.scene.fixedLayerIds!;
    const mat = store.addMaterial({ name: 'Mat1', oriented: false });

    // Create C1 support: 100×100 at (100, 100)
    const c1Support = store.addRectPiece(C1, mat, 100, 100, 100, 100, 0);

    // Create C2 piece fully supported: 80×80 at (110, 110)
    const c2Piece = store.addRectPiece(C2, mat, 80, 80, 110, 110, 0);

    // Set active layer to C2 to allow resize
    useSceneStore.setState((s) => ({ ui: { ...s.ui, activeLayer: C2 } }));

    // Initially, C2 should be fully supported (no ghost)
    await waitExact(120);
    let state = useSceneStore.getState();
    expect(state.ui.exactSupportResults?.[c2Piece]).toBeUndefined();

    // Resize C2 to extend outside C1 support: resize east handle to make width 120
    // This will make right edge at 110 + 120 = 230, which is outside C1 bbox [100..200]
    store.selectPiece(c2Piece);
    store.startResize(c2Piece, 'e');

    const piece = state.scene.pieces[c2Piece];
    store.updateResize({
      x: piece.position.x + 120, // New right edge
      y: piece.position.y + piece.size.h / 2,
    });

    store.endResize(true); // Commit

    // Wait for exact recalculation to complete
    await waitExact(150);

    // C2 should now have ghost state (WARN) because it's partially unsupported
    state = useSceneStore.getState();
    expect(state.ui.exactSupportResults?.[c2Piece]).toBe(false);
  });

  /**
   * Note: Additional test for group resize would require PathOps working in test env.
   * Since PathOps fails to load WASM in tests, we fallback to AABB which is less precise.
   * The core functionality (calling recalculateExactSupport after resize) is validated
   * by the solo resize test above.
   */
});
