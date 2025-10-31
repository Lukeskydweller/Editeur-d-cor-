import { render, fireEvent } from '@testing-library/react';
import { beforeEach } from 'vitest';
import App from './App';
import { useSceneStore } from '@/state/useSceneStore';

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
      snap10mm: true,
      guides: undefined,
    },
  });
});

test('snap ON: ArrowRight moves by 10mm', () => {
  const { initSceneWithDefaults, selectPiece, setSnap10mm } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  selectPiece(pieceId);

  // Ensure snap is ON
  setSnap10mm(true);

  render(<App />);

  const initialX = useSceneStore.getState().scene.pieces[pieceId].position.x;

  // Press ArrowRight
  fireEvent.keyDown(window, { key: 'ArrowRight' });

  const newX = useSceneStore.getState().scene.pieces[pieceId].position.x;

  // Should move by exactly +10mm
  expect(newX).toBe(initialX + 10);
});

test('snap OFF: ArrowRight moves by 1mm', () => {
  const { initSceneWithDefaults, selectPiece, setSnap10mm } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  selectPiece(pieceId);

  // Ensure snap is OFF
  setSnap10mm(false);

  render(<App />);

  const initialX = useSceneStore.getState().scene.pieces[pieceId].position.x;

  // Press ArrowRight
  fireEvent.keyDown(window, { key: 'ArrowRight' });

  const newX = useSceneStore.getState().scene.pieces[pieceId].position.x;

  // Should move by exactly +1mm
  expect(newX).toBe(initialX + 1);
});

test('snap ON: ArrowDown moves by 10mm', () => {
  const { initSceneWithDefaults, selectPiece, setSnap10mm } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  selectPiece(pieceId);

  setSnap10mm(true);

  render(<App />);

  const initialY = useSceneStore.getState().scene.pieces[pieceId].position.y;

  fireEvent.keyDown(window, { key: 'ArrowDown' });

  const newY = useSceneStore.getState().scene.pieces[pieceId].position.y;

  expect(newY).toBe(initialY + 10);
});

test('snap OFF: ArrowDown moves by 1mm', () => {
  const { initSceneWithDefaults, selectPiece, setSnap10mm } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  selectPiece(pieceId);

  setSnap10mm(false);

  render(<App />);

  const initialY = useSceneStore.getState().scene.pieces[pieceId].position.y;

  fireEvent.keyDown(window, { key: 'ArrowDown' });

  const newY = useSceneStore.getState().scene.pieces[pieceId].position.y;

  expect(newY).toBe(initialY + 1);
});
