import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// E2E test hook for PathOps (dev only)
if (import.meta.env.DEV) {
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
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
