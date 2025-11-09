import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/ghost.css';

// Runtime feature flags
declare global {
  interface Window {
    __flags: {
      USE_GLOBAL_SPATIAL: boolean;
      AUTO_SPATIAL?: boolean | 'auto';
      FORCE_SUPPORT_STRATEGY?: 'PATHOPS' | 'AABB';
    };
  }
}

window.__flags = {
  USE_GLOBAL_SPATIAL: window.__flags?.USE_GLOBAL_SPATIAL ?? false, // Default OFF - enable explicitly for testing
  AUTO_SPATIAL: window.__flags?.AUTO_SPATIAL ?? 'auto', // Default: auto-enable based on piece count
  FORCE_SUPPORT_STRATEGY: window.__flags?.FORCE_SUPPORT_STRATEGY, // E2E: honored before boot
};

// E2E test hooks for PathOps (dev and preview mode for E2E testing)
// Check if running in development OR if window location is localhost (preview server)
if (import.meta.env.DEV || window.location.hostname === 'localhost') {
  const geoWorker = new Worker(new URL('./workers/geo.worker.ts', import.meta.url), {
    type: 'module',
  });
  let msgIdCounter = 1;
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();

  geoWorker.onmessage = (ev) => {
    const msg = ev.data;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.ok) p.resolve(msg.result);
    else p.reject(new Error(msg.error || 'error'));
  };

  (window as any).__geoBooleanOp = (a: any, b: any, kind: string) => {
    return new Promise((resolve, reject) => {
      const id = msgIdCounter++;
      pending.set(id, { resolve, reject });
      geoWorker.postMessage({ id, type: 'booleanOp', payload: { a, b, kind } });
    });
  };

  // nouveau hook: retourne Poly[]
  (window as any).__geoBooleanOpPolys = (a: any, b: any, kind: string) => {
    return new Promise((resolve, reject) => {
      const id = msgIdCounter++;
      pending.set(id, { resolve, reject });
      geoWorker.postMessage({ id, type: 'booleanOpPolys', payload: { a, b, kind } });
    });
  };

  // Test hook: create overlap for E2E testing (uses useSceneStore, bridge syncs to editorStore)
  (window as any).__testCreateOverlap = async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();
    const pieces = Object.values(store.scene.pieces);

    // Ensure we have at least 2 pieces
    if (pieces.length < 2) {
      // Add a second piece
      if (pieces.length === 1) {
        const p1 = pieces[0];
        if (!p1 || typeof p1 !== 'object' || !('size' in p1)) return false;
        const p1Typed = p1 as any; // E2E boundary: test hook, pieces already validated
        store.addRectAtCenter(p1Typed.size.w, p1Typed.size.h);
        const newPieces = Object.values(useSceneStore.getState().scene.pieces);
        if (newPieces.length < 2) return false;
      } else {
        return false;
      }
    }

    // Get the two pieces
    const piecesNow = Object.values(useSceneStore.getState().scene.pieces);
    if (piecesNow.length >= 2) {
      const [p1, p2] = piecesNow;
      if (!p1 || !p2 || typeof p1 !== 'object' || typeof p2 !== 'object') return false;
      if (!('id' in p1) || !('id' in p2) || !('position' in p1) || !('position' in p2))
        return false;
      // Move p2 to overlap with p1 by directly modifying position
      const p1Typed = p1 as any; // E2E boundary: test hook, pieces already validated
      const p2Typed = p2 as any; // E2E boundary: test hook, pieces already validated
      useSceneStore.setState((state: ReturnType<typeof useSceneStore.getState>) => ({
        scene: {
          ...state.scene,
          pieces: {
            ...state.scene.pieces,
            [p2Typed.id]: {
              ...p2Typed,
              position: {
                x: p1Typed.position.x + 5, // Overlap by positioning p2 near p1
                y: p1Typed.position.y + 5,
              },
            },
          },
        },
      }));

      // Wait for bridge debounce (75ms) + validation debounce (100ms) + worker round-trip
      await new Promise((resolve) => setTimeout(resolve, 300));

      return true;
    }
    return false;
  };

  // Test hook: check validation results
  (window as any).__testGetProblems = async () => {
    const { selectProblems } = await import('./store/editorStore');
    return selectProblems();
  };

  // Test hook: wait for geo worker to be ready
  (window as any).__waitGeoReady = async () => {
    const { waitGeoReady } = await import('./store/editorStore');
    return await waitGeoReady();
  };

  // Test hook: create validation problems (outside_scene + min_size_violation)
  (window as any).__testCreateValidationProblems = async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    // Get first layer and material
    const firstLayerId = store.scene.layerOrder[0];
    if (!firstLayerId) return false;

    const firstMaterialId = Object.keys(store.scene.materials)[0];
    if (!firstMaterialId) return false;

    // Clear existing pieces and add two problematic pieces
    useSceneStore.setState((state: ReturnType<typeof useSceneStore.getState>) => ({
      scene: {
        ...state.scene,
        pieces: {
          // Piece 1: outside scene bounds (right edge at 580+40=620 > 600)
          'test-outside': {
            id: 'test-outside',
            kind: 'rect' as const,
            position: { x: 580, y: 10 },
            size: { w: 40, h: 40 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            layerId: firstLayerId,
            materialId: firstMaterialId,
          },
          // Piece 2: too small (w=4 < 5mm minimum)
          'test-minsize': {
            id: 'test-minsize',
            kind: 'rect' as const,
            position: { x: 10, y: 10 },
            size: { w: 4, h: 20 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            layerId: firstLayerId,
            materialId: firstMaterialId,
          },
        },
      },
    }));

    // Wait for bridge debounce (75ms) + validation debounce (100ms) + worker round-trip
    await new Promise((resolve) => setTimeout(resolve, 300));

    return true;
  };

  // Test hook: create spacing problem (two pieces with spacing ~1.0mm)
  (window as any).__testCreateSpacingProblem = async () => {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    // Get first layer and material
    const firstLayerId = store.scene.layerOrder[0];
    if (!firstLayerId) return false;

    const firstMaterialId = Object.keys(store.scene.materials)[0];
    if (!firstMaterialId) return false;

    // Clear existing pieces and add two pieces with 1.0mm spacing
    useSceneStore.setState((state: ReturnType<typeof useSceneStore.getState>) => ({
      scene: {
        ...state.scene,
        pieces: {
          // Piece 1: at (100, 100) with size 40x40
          'test-spacing-1': {
            id: 'test-spacing-1',
            kind: 'rect' as const,
            position: { x: 100, y: 100 },
            size: { w: 40, h: 40 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            layerId: firstLayerId,
            materialId: firstMaterialId,
          },
          // Piece 2: at (141, 100) with size 40x40
          // Edge distance: 141 - (100 + 40) = 1.0mm (should trigger WARN)
          'test-spacing-2': {
            id: 'test-spacing-2',
            kind: 'rect' as const,
            position: { x: 141, y: 100 },
            size: { w: 40, h: 40 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            layerId: firstLayerId,
            materialId: firstMaterialId,
          },
        },
      },
      ui: {
        ...state.ui,
        selectedId: 'test-spacing-1', // Select first piece
        selectedIds: ['test-spacing-1'],
      },
    }));

    // Wait for bridge debounce (75ms) + validation debounce (100ms) + worker round-trip
    await new Promise((resolve) => setTimeout(resolve, 300));

    return true;
  };

  // Test hook: expose scene store for E2E testing
  import('./state/useSceneStore').then(({ useSceneStore }) => {
    (window as any).__sceneStore = useSceneStore;
  });

  // Test hook: rotate and resize piece for E2E testing
  (window as any).__testRotateAndResize = async (opts: {
    rotateDeg: number;
    drag: { dx: number; dy: number };
  }) => {
    try {
      const { useSceneStore } = await import('./state/useSceneStore');
      const store = useSceneStore.getState();

      // Get first layer and material
      const firstLayerId = store.scene.layerOrder[0];
      if (!firstLayerId) return { success: false, reason: 'No layer found' };

      const firstMaterialId = Object.keys(store.scene.materials)[0];
      if (!firstMaterialId) return { success: false, reason: 'No material found' };

      // Clear existing pieces and create a single test piece
      const pieceId = 'test-rot-resize';
      useSceneStore.setState((state: ReturnType<typeof useSceneStore.getState>) => ({
        scene: {
          ...state.scene,
          pieces: {
            // Clear all existing pieces to avoid overlaps
            [pieceId]: {
              id: pieceId,
              kind: 'rect' as const,
              position: { x: 100, y: 100 },
              size: { w: 40, h: 20 },
              rotationDeg: 0,
              scale: { x: 1, y: 1 },
              layerId: firstLayerId,
              materialId: firstMaterialId,
            },
          },
        },
        ui: {
          ...state.ui,
          selectedId: pieceId,
          selectedIds: [pieceId],
        },
      }));

      // Set absolute rotation
      store.setSelectedRotation(opts.rotateDeg as any);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Perform resize via store actions
      const piece = useSceneStore.getState().scene.pieces[pieceId];
      if (!piece) return { success: false, reason: 'Piece not found after rotation' };

      // Start resize from E handle
      const startX = piece.position.x + piece.size.w;
      const startY = piece.position.y + piece.size.h / 2;

      store.startResize(pieceId, 'e', { x: startX, y: startY });

      // Update resize with drag delta
      const currentX = startX + opts.drag.dx;
      const currentY = startY + opts.drag.dy;
      store.updateResize({ x: currentX, y: currentY });

      // Commit resize
      store.endResize(true);

      // Wait for bridge + validation
      await new Promise((resolve) => setTimeout(resolve, 300));

      return { success: true };
    } catch (e: any) {
      return { success: false, reason: e.message };
    }
  };
}

// Test hook: spawn grid of pieces for performance testing (ALWAYS exposed for E2E)
(window as any).__testSpawnGrid = async (opts: {
  cols: number;
  rows: number;
  w: number;
  h: number;
  gap: number;
}) => {
  try {
    const { useSceneStore } = await import('./state/useSceneStore');
    const store = useSceneStore.getState();

    const firstLayerId = store.scene.layerOrder[0];
    if (!firstLayerId) return false;

    const firstMaterialId = Object.keys(store.scene.materials)[0];
    if (!firstMaterialId) return false;

    let x = 10;
    let y = 10;

    for (let r = 0; r < opts.rows; r++) {
      for (let c = 0; c < opts.cols; c++) {
        await store.insertRect({
          w: opts.w,
          h: opts.h,
          x: x,
          y: y,
        });
        x += opts.w + opts.gap;
      }
      x = 10;
      y += opts.h + opts.gap;
    }

    // Wait for async validation
    await new Promise((resolve) => setTimeout(resolve, 60));
    return true;
  } catch (e) {
    console.error('__testSpawnGrid error:', e);
    return false;
  }
};

// ALWAYS exposed for E2E: wait until problems contain/omit target codes
(window as any).__testWaitForProblems = async ({
  codes = [],
  expectAbsent = false,
  timeoutMs = 2000,
  intervalMs = 50,
}: {
  codes?: string[];
  expectAbsent?: boolean;
  timeoutMs?: number;
  intervalMs?: number;
}) => {
  const { selectProblems } = await import('./store/editorStore');
  const start = Date.now();
  return await new Promise<boolean>((resolve) => {
    const t = setInterval(() => {
      const state = selectProblems();
      const ps = state.problems ?? [];
      const set = new Set(ps.map((p: any) => p.code));
      const allPresent = codes.every((c) => set.has(c));
      const allAbsent = codes.every((c) => !set.has(c));
      const ok = expectAbsent ? allAbsent : allPresent;
      if (ok) {
        clearInterval(t);
        resolve(true);
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(t);
        resolve(false);
      }
    }, intervalMs);
  });
};

// ALWAYS exposed: toggle joined flag on a piece by id (bypasses UI)
(window as any).__testToggleJoined = async (id: string) => {
  const { useSceneStore } = await import('./state/useSceneStore');
  const store = useSceneStore.getState();
  if (store.toggleJoined) {
    store.toggleJoined(id);
  }
  await new Promise((r) => setTimeout(r, 60)); // let validation debounce flush
  return true;
};

// ALWAYS exposed for E2E: force the complete validation pipeline
// Bypasses debouncing to run Draft→V1→validateAll→store synchronously
(window as any).__testForceFullValidation = async () => {
  try {
    // 1) Get current Draft scene from useSceneStore
    const { useSceneStore } = await import('./state/useSceneStore');
    const draft = useSceneStore.getState();

    // 2) Project Draft→V1 using same projector as production
    const { projectDraftToV1 } = await import('./sync/projector');
    const v1 = projectDraftToV1(draft);

    // 3) Call validateAll directly (bypass worker to avoid import.meta issues)
    const { validateAll } = await import('./core/geo/validateAll');
    const problems = await validateAll(v1);

    // 4) Update editorStore directly with problems (bypass debounced validation)
    const { setProblemsDirectly } = await import('./store/editorStore');
    setProblemsDirectly(problems);

    return { ok: true, count: problems?.length ?? 0 };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
};

// Auto-spatial: setup auto-enable logic based on piece count
import { setAutoEnabled, getAutoThreshold, _setOnAutoToggle } from './lib/spatial/globalIndex';
import { setAutoSpatialState, inc } from './lib/metrics';

// Wire callback to update gauge when auto-spatial state changes
_setOnAutoToggle((enabled: boolean) => {
  setAutoSpatialState(enabled);
});

// Debounced auto-evaluator to avoid excessive checks
let autoEvalTimeout: ReturnType<typeof setTimeout> | null = null;
const evaluateAutoSpatial = () => {
  if (autoEvalTimeout) clearTimeout(autoEvalTimeout);
  autoEvalTimeout = setTimeout(async () => {
    const flag = window.__flags?.AUTO_SPATIAL;

    // If flag is explicitly true/false, force that state and don't auto-switch
    if (flag === true) {
      setAutoEnabled(true);
      return;
    }
    if (flag === false) {
      setAutoEnabled(false);
      return;
    }

    // Flag is 'auto' or undefined: apply hysteresis logic
    const { useSceneStore } = await import('./state/useSceneStore');
    const pieceCount = Object.keys(useSceneStore.getState().scene.pieces).length;
    const { minOn, maxOff } = getAutoThreshold();

    const wasEnabled = (window as any).__lastAutoSpatialState ?? false;
    let shouldEnable = wasEnabled;

    if (pieceCount >= minOn) {
      shouldEnable = true;
    } else if (pieceCount <= maxOff) {
      shouldEnable = false;
    }
    // Between maxOff and minOn: keep current state (hysteresis)

    if (shouldEnable !== wasEnabled) {
      setAutoEnabled(shouldEnable);
      (window as any).__lastAutoSpatialState = shouldEnable;
    }
  }, 50); // 50ms debounce
};

// Expose evaluator for store to call after mutations
(window as any).__evaluateAutoSpatial = evaluateAutoSpatial;

// Initial evaluation
evaluateAutoSpatial();

// Start Draft→V1 synchronization bridge
import { startValidationBridge } from './sync/bridge';
startValidationBridge();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
