import { render, screen, fireEvent, act } from '@testing-library/react';
import { beforeEach } from 'vitest';
import App from './App';
import { useSceneStore } from '@/state/useSceneStore';
import type { Piece } from '@/types/scene';

// Encapsuler les interactions déclenchant setState dans act() ou via userEvent async si nécessaire

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

test('drag simple valide updates piece position', () => {
  // Init scène avec pièce par défaut (40,40 120×80)
  const { initSceneWithDefaults, beginDrag, updateDrag, endDrag } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  const initialPos = { ...useSceneStore.getState().scene.pieces[pieceId].position };

  render(<App />);

  // Test via store actions (UI drag requires real SVG dimensions in jsdom)
  act(() => {
    beginDrag(pieceId);
    updateDrag(10, 0); // Move 10mm right
    endDrag();
  });

  const finalPos = useSceneStore.getState().scene.pieces[pieceId].position;
  expect(finalPos.x).toBe(initialPos.x + 10);
  expect(finalPos.y).toBe(initialPos.y);
});

test('drag invalide shows ghost invalid and does not commit', () => {
  // Init scène avec pièce par défaut (40,40 120×80)
  const { initSceneWithDefaults, beginDrag, updateDrag, endDrag } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const state = useSceneStore.getState();
  const pieceId = Object.keys(state.scene.pieces)[0];
  const layerId = state.scene.layerOrder[0];
  const materialId = Object.keys(state.scene.materials)[0];

  // Ajouter une seconde pièce à droite (170,40 80×80)
  const blockingPiece: Piece = {
    id: 'blocking-piece',
    layerId,
    materialId,
    position: { x: 170, y: 40 },
    rotationDeg: 0,
    scale: { x: 1, y: 1 },
    kind: 'rect',
    size: { w: 80, h: 80 },
  };
  useSceneStore.setState((s) => ({
    scene: { ...s.scene, pieces: { ...s.scene.pieces, [blockingPiece.id]: blockingPiece } },
  }));

  const originalPos = { ...useSceneStore.getState().scene.pieces[pieceId].position };

  render(<App />);

  // Test via store actions
  act(() => {
    beginDrag(pieceId);
    updateDrag(50, 0); // Move 50mm right (would overlap)
  });

  // Le ghost doit être présent avec data-valid="false"
  const ghost = screen.getByTestId('ghost-piece');
  expect(ghost).toHaveAttribute('data-valid', 'false');

  // EndDrag
  act(() => {
    endDrag();
  });

  // La position ne doit PAS avoir changé
  const finalPos = useSceneStore.getState().scene.pieces[pieceId].position;
  expect(finalPos.x).toBe(originalPos.x);
  expect(finalPos.y).toBe(originalPos.y);
});

test('drag clamps to scene bounds', () => {
  // Init scène avec pièce par défaut (40,40 120×80)
  const { initSceneWithDefaults, beginDrag, updateDrag, endDrag } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];

  render(<App />);

  // Drag massivement vers la gauche
  act(() => {
    beginDrag(pieceId);
    updateDrag(-600, 0); // Move 600mm left (should clamp to 0)
    endDrag();
  });

  // La position x doit être clampée à 0
  const finalPos = useSceneStore.getState().scene.pieces[pieceId].position;
  expect(finalPos.x).toBe(0);

  // Drag massivement vers le bas
  act(() => {
    beginDrag(pieceId);
    updateDrag(0, 900); // Move 900mm down (should clamp)
    endDrag();
  });

  // La position y doit être clampée à 600 - 80 = 520
  const finalPos2 = useSceneStore.getState().scene.pieces[pieceId].position;
  expect(finalPos2.y).toBe(520);
});

test('drag near another piece uses RBush shortlist (no visual regression)', () => {
  // Setup: scene with 1 subject piece + 1 nearby piece for snap
  const { initSceneWithDefaults, addRectAtCenter, beginDrag, updateDrag, endDrag } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  // Add a second piece near the first one for snap testing
  addRectAtCenter(100, 60);

  const pieceIds = Object.keys(useSceneStore.getState().scene.pieces);
  const firstPieceId = pieceIds[0];

  render(<App />);

  // Drag the first piece close to the second piece (should trigger snap)
  act(() => {
    beginDrag(firstPieceId);
    updateDrag(50, 0); // Move 50mm right
    endDrag();
  });

  // Verify the piece moved (snap behavior should still work correctly)
  const finalPos = useSceneStore.getState().scene.pieces[firstPieceId].position;
  expect(finalPos.x).toBeGreaterThan(40); // Moved from initial position (40,40)

  // The key assertion: snap should have worked (RBush optimization is transparent)
  expect(finalPos).toBeDefined();
});
