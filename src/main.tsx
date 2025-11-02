import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// E2E test hooks for PathOps (dev and preview mode for E2E testing)
// Check if running in development OR if window location is localhost (preview server)
if (import.meta.env.DEV || window.location.hostname === 'localhost') {
  const geoWorker = new Worker(new URL('./workers/geo.worker.ts', import.meta.url), { type: 'module' });
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
        store.addRectAtCenter(p1.size.w, p1.size.h);
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
      // Move p2 to overlap with p1 by directly modifying position
      useSceneStore.setState((state) => ({
        scene: {
          ...state.scene,
          pieces: {
            ...state.scene.pieces,
            [p2.id]: {
              ...p2,
              position: {
                x: p1.position.x + 5,  // Overlap by positioning p2 near p1
                y: p1.position.y + 5
              }
            }
          }
        }
      }));

      // Wait for bridge debounce (75ms) + validation debounce (100ms) + worker round-trip
      await new Promise(resolve => setTimeout(resolve, 300));

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
}

// Start Draft→V1 synchronization bridge
import { startValidationBridge } from './sync/bridge';
startValidationBridge();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
