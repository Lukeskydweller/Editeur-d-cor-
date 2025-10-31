import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach } from 'vitest';
import App from './App';
import { useSceneStore } from '@/state/useSceneStore';

beforeEach(() => {
  // Reset store entre les tests
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
      flashInvalidAt: undefined,
      dragging: undefined,
    },
  });
});

test('selects piece on click', () => {
  // Init scène avec pièce par défaut
  const { initSceneWithDefaults } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  render(<App />);

  // Vérifier qu'aucune pièce n'est sélectionnée au départ
  expect(useSceneStore.getState().ui.selectedId).toBeUndefined();

  // Cliquer sur le rectangle
  const canvas = screen.getByRole('img', { name: /editor-canvas/i });
  const rect = canvas.querySelector('rect[fill="#60a5fa"]');
  expect(rect).toBeInTheDocument();

  fireEvent.pointerDown(rect!, { clientX: 100, clientY: 100 });

  // Vérifier que la pièce est maintenant sélectionnée
  const selectedId = useSceneStore.getState().ui.selectedId;
  expect(selectedId).toBeDefined();

  // Vérifier le style de sélection
  expect(rect).toHaveAttribute('stroke', '#22d3ee');
  expect(rect).toHaveAttribute('stroke-width', '3');
});

test('nudges selected piece with arrow keys', () => {
  // Init scène avec pièce par défaut
  const { initSceneWithDefaults, selectPiece } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  selectPiece(pieceId);

  render(<App />);

  // Position initiale (40, 40)
  let piece = useSceneStore.getState().scene.pieces[pieceId];
  expect(piece.position).toEqual({ x: 40, y: 40 });

  // ArrowRight → +1 en x
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  piece = useSceneStore.getState().scene.pieces[pieceId];
  expect(piece.position.x).toBe(41);

  // Shift+ArrowRight → +10 en x
  fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });
  piece = useSceneStore.getState().scene.pieces[pieceId];
  expect(piece.position.x).toBe(51);

  // ArrowDown → +1 en y
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  piece = useSceneStore.getState().scene.pieces[pieceId];
  expect(piece.position.y).toBe(41);

  // Shift+ArrowUp → -10 en y
  fireEvent.keyDown(window, { key: 'ArrowUp', shiftKey: true });
  piece = useSceneStore.getState().scene.pieces[pieceId];
  expect(piece.position.y).toBe(31);
});
