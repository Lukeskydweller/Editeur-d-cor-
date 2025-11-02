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

  // Test hook: create overlap for E2E testing
  (window as any).__testCreateOverlap = async () => {
    const { editorStore } = await import('./store/editorStore');
    const { rebuildIndex } = await import('./core/spatial/rbushIndex');
    const geo = await import('./core/geo/facade');
    const state = editorStore.getState();

    // Ensure we have at least 2 pieces
    if (state.pieces.length < 2 && state.pieces.length >= 1) {
      const p1 = state.pieces[0];
      state.pieces.push({
        id: "test-p2",
        kind: "rect",
        x: p1.x + 150,
        y: p1.y,
        w: p1.w,
        h: p1.h,
        rot: 0,
        layerId: p1.layerId,
        materialId: p1.materialId,
        constraints: {}
      });
      // Rebuild index with new piece
      rebuildIndex(state);
      await geo.rebuildIndex(state);
    }

    if (state.pieces.length >= 2) {
      const [p1, p2] = state.pieces;
      // Move second piece to overlap with first
      editorStore.dispatch({ type: 'movePiece', id: p2.id, dx: p1.x - p2.x + 5, dy: p1.y - p2.y + 5 });
      return true;
    }
    return false;
  };

  // Test hook: check validation results
  (window as any).__testGetProblems = async () => {
    const { selectProblems } = await import('./store/editorStore');
    return selectProblems();
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
