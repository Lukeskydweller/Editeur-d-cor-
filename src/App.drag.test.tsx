import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach } from 'vitest';
import App from './App';
import { useSceneStore } from '@/state/useSceneStore';
import type { Piece } from '@/types/scene';

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
  const { initSceneWithDefaults } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];

  render(<App />);

  const canvas = screen.getByRole('img', { name: /editor-canvas/i });
  const rect = canvas.querySelector('rect[fill="#60a5fa"]') as SVGRectElement;

  // Position initiale
  const initialPos = { ...useSceneStore.getState().scene.pieces[pieceId].position };

  // Simuler drag: pointerDown → pointerMove → pointerUp
  fireEvent.pointerDown(rect, { clientX: 100, clientY: 100 });
  fireEvent.pointerMove(canvas.parentElement!, { clientX: 110, clientY: 100 });
  fireEvent.pointerUp(canvas.parentElement!);

  // La position doit avoir augmenté de ~10 en x
  const finalPos = useSceneStore.getState().scene.pieces[pieceId].position;
  expect(finalPos.x).toBe(initialPos.x + 10);
  expect(finalPos.y).toBe(initialPos.y);
});

test('drag invalide shows ghost invalid and does not commit', () => {
  // Init scène avec pièce par défaut (40,40 120×80)
  const { initSceneWithDefaults } = useSceneStore.getState();
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

  render(<App />);

  const canvas = screen.getByRole('img', { name: /editor-canvas/i });
  const pieces = canvas.querySelectorAll('rect[fill="#60a5fa"]');
  const rect = Array.from(pieces).find((r) => {
    const parent = r.parentElement;
    const transform = parent?.getAttribute('transform');
    return transform?.includes('translate(40');
  }) as SVGRectElement;

  const originalPos = { ...useSceneStore.getState().scene.pieces[pieceId].position };

  // Drag vers la droite (vers overlap)
  fireEvent.pointerDown(rect, { clientX: 100, clientY: 100 });
  fireEvent.pointerMove(canvas.parentElement!, { clientX: 150, clientY: 100 }); // +50px

  // Le ghost doit être présent avec data-valid="false"
  const ghost = screen.getByTestId('ghost-piece');
  expect(ghost).toHaveAttribute('data-valid', 'false');

  // PointerUp
  fireEvent.pointerUp(canvas.parentElement!);

  // La position ne doit PAS avoir changé
  const finalPos = useSceneStore.getState().scene.pieces[pieceId].position;
  expect(finalPos.x).toBe(originalPos.x);
  expect(finalPos.y).toBe(originalPos.y);
});

test('drag clamps to scene bounds', () => {
  // Init scène avec pièce par défaut (40,40 120×80)
  const { initSceneWithDefaults } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];

  render(<App />);

  const canvas = screen.getByRole('img', { name: /editor-canvas/i });
  const rect = canvas.querySelector('rect[fill="#60a5fa"]') as SVGRectElement;

  // Drag massivement vers la gauche
  fireEvent.pointerDown(rect, { clientX: 100, clientY: 100 });
  fireEvent.pointerMove(canvas.parentElement!, { clientX: -500, clientY: 100 }); // -600px
  fireEvent.pointerUp(canvas.parentElement!);

  // La position x doit être clampée à 0
  const finalPos = useSceneStore.getState().scene.pieces[pieceId].position;
  expect(finalPos.x).toBe(0);

  // Drag massivement vers le bas
  fireEvent.pointerDown(rect, { clientX: 100, clientY: 100 });
  fireEvent.pointerMove(canvas.parentElement!, { clientX: 100, clientY: 1000 }); // +900px
  fireEvent.pointerUp(canvas.parentElement!);

  // La position y doit être clampée à 600 - 80 = 520
  const finalPos2 = useSceneStore.getState().scene.pieces[pieceId].position;
  expect(finalPos2.y).toBe(520);
});
