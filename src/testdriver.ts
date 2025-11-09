/**
 * E2E Test Driver (dev-only, VITE_E2E=1)
 *
 * Exposes window.__TEST__ API for Playwright E2E tests.
 * Provides programmatic access to scene manipulation and ghost state inspection.
 */

import type { useSceneStore as UseSceneStoreType } from '@/state/useSceneStore';
import type { ID, Milli } from '@/types/scene';
import type { ResizeHandle } from '@/lib/ui/resize';

export function installTestDriver(store: typeof UseSceneStoreType) {
  const api = {
    /**
     * Reset scene to empty state
     */
    reset() {
      store.setState((s) => ({
        ...s,
        scene: {
          ...s.scene,
          pieces: {},
          materials: {},
          layers: {},
          layerOrder: [],
        },
        ui: {
          ...s.ui,
          selectedId: undefined,
          selectedIds: undefined,
          primaryId: undefined,
        },
      }));
    },

    /**
     * Create a rectangular piece
     * @returns piece ID
     */
    newRect(layerId: ID, x: number, y: number, w: number, h: number): ID {
      const state = store.getState();

      // Ensure material exists
      let materialId = Object.keys(state.scene.materials)[0];
      if (!materialId) {
        materialId = state.addMaterial({ name: 'TestMat', oriented: false });
      }

      // Ensure layer exists
      const layer = state.scene.layers[layerId];
      if (!layer) {
        throw new Error(`Layer ${layerId} does not exist. Call initSceneWithDefaults first.`);
      }

      const pieceId = state.addRectPiece(
        layerId,
        materialId,
        w as Milli,
        h as Milli,
        x as Milli,
        y as Milli,
        0,
      );

      return pieceId;
    },

    /**
     * Select a single piece exclusively
     */
    select(id: ID) {
      store.getState().selectOnly(id);
    },

    /**
     * Simulate drag operation
     */
    dragBy(id: ID, dx: number, dy: number) {
      const state = store.getState();

      // Select piece first
      state.selectOnly(id);

      // Begin drag
      state.beginDrag(id);

      // Update drag position
      state.updateDrag(dx, dy);

      // End drag
      state.endDrag();
    },

    /**
     * Simulate resize operation
     */
    resizeBy(id: ID, handle: ResizeHandle, dx: number, dy: number) {
      const state = store.getState();

      // Select piece first
      state.selectOnly(id);

      // Get piece current position
      const piece = state.scene.pieces[id];
      if (!piece) throw new Error(`Piece ${id} not found`);

      // Calculate start pointer position based on handle
      let startX = piece.position.x;
      let startY = piece.position.y;

      if (handle.includes('e')) startX += piece.size.w;
      if (handle.includes('w')) startX += 0;
      if (!handle.includes('e') && !handle.includes('w')) startX += piece.size.w / 2;

      if (handle.includes('s')) startY += piece.size.h;
      if (handle.includes('n')) startY += 0;
      if (!handle.includes('s') && !handle.includes('n')) startY += piece.size.h / 2;

      // Start resize
      state.startResize(id, handle, { x: startX as Milli, y: startY as Milli });

      // Update resize to new position
      const newX = (startX + dx) as Milli;
      const newY = (startY + dy) as Milli;
      state.updateResize({ x: newX, y: newY });

      // Commit resize
      state.endResize(true);
    },

    /**
     * Get ghost state for a piece
     */
    ghostState(id: ID) {
      const state = store.getState();
      const el = document.querySelector<SVGElement>(`[data-piece-id="${id}"]`);

      return {
        exact: state.ui.exactSupportResults?.[id] ?? true,
        dataGhost: el?.getAttribute('data-ghost') ?? '0',
        severity: el?.getAttribute('data-ghost-severity') ?? 'none',
      };
    },

    /**
     * Get piece rectangle from store
     */
    getPieceRect(id: ID) {
      const state = store.getState();
      const piece = state.scene.pieces[id];
      if (!piece) throw new Error(`Piece ${id} not found`);

      return {
        x: piece.position.x,
        y: piece.position.y,
        w: piece.size.w,
        h: piece.size.h,
      };
    },

    /**
     * Set active layer
     */
    setActiveLayer(layerId: ID) {
      store.getState().setActiveLayer(layerId);
    },

    /**
     * Initialize scene with default 3-layer setup
     */
    initSceneWithDefaults(w: number, h: number) {
      store.getState().initSceneWithDefaults(w as Milli, h as Milli);
    },

    /**
     * Get fixed layer IDs (C1, C2, C3)
     */
    getFixedLayerIds() {
      const state = store.getState();
      if (!state.scene.fixedLayerIds) {
        throw new Error('fixedLayerIds not initialized. Call initSceneWithDefaults first.');
      }
      return state.scene.fixedLayerIds;
    },
  };

  (window as any).__TEST__ = api;

  if (import.meta.env.DEV) {
    console.log('[TestDriver] API installed on window.__TEST__');
  }
}
