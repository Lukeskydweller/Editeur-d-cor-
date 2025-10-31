import './App.css';
import { useCounter } from '@/state/useCounter';

export default function App() {
  const { count, inc, reset } = useCounter();

  return (
    <>
      <h1>Éditeur — Demo Zustand + Immer</h1>
      <div className="card" style={{ display: 'flex', gap: 12 }}>
        <button onClick={inc}>count is {count}</button>
        <button onClick={reset}>reset</button>
      </div>
      <p style={{ opacity: 0.6 }}>
        Edit <code>src/App.tsx</code> and save to test HMR
      </p>
    </>
  );
}
