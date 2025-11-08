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
    },
  });
});

test('clamps piece to scene bounds when nudging', () => {
  // Init scène avec pièce par défaut (40,40 120×80)
  const { initSceneWithDefaults, selectPiece } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  selectPiece(pieceId);

  render(<App />);

  // Nudge vers la gauche 100× → doit clamper à x=0
  for (let i = 0; i < 100; i++) {
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
  }

  const piece = useSceneStore.getState().scene.pieces[pieceId];
  expect(piece.position.x).toBe(0);
  expect(piece.position.y).toBe(40);

  // Nudge vers le haut 100× → doit clamper à y=0
  for (let i = 0; i < 100; i++) {
    fireEvent.keyDown(window, { key: 'ArrowUp' });
  }

  const piece2 = useSceneStore.getState().scene.pieces[pieceId];
  expect(piece2.position.y).toBe(0);

  // Nudge vers le bas 1000× → doit clamper à y = 600 - 80 = 520
  for (let i = 0; i < 1000; i++) {
    fireEvent.keyDown(window, { key: 'ArrowDown' });
  }

  const piece3 = useSceneStore.getState().scene.pieces[pieceId];
  expect(piece3.position.y).toBe(520);
});

test('blocks nudge and flashes invalid when overlap would occur', () => {
  // Init scène avec pièce par défaut (40,40 120×80)
  const { initSceneWithDefaults, selectPiece } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const state = useSceneStore.getState();
  const pieceId = Object.keys(state.scene.pieces)[0];
  const layerId = state.scene.layerOrder[0];
  const materialId = Object.keys(state.scene.materials)[0];

  // Ajouter une seconde pièce qui chevauche (50,50 80×60)
  const overlappingPiece: Piece = {
    id: 'overlap-piece',
    layerId,
    materialId,
    position: { x: 50, y: 50 },
    rotationDeg: 0,
    scale: { x: 1, y: 1 },
    kind: 'rect',
    size: { w: 80, h: 60 },
  };
  useSceneStore.setState((s) => ({
    scene: { ...s.scene, pieces: { ...s.scene.pieces, [overlappingPiece.id]: overlappingPiece } },
  }));

  selectPiece(pieceId);

  render(<App />);

  const originalPos = { ...useSceneStore.getState().scene.pieces[pieceId].position };

  // Tenter de nudger vers la droite (vers l'overlap)
  fireEvent.keyDown(window, { key: 'ArrowRight' });

  const newPos = useSceneStore.getState().scene.pieces[pieceId].position;

  // La position ne doit PAS avoir changé (bloquée par overlap)
  expect(newPos.x).toBe(originalPos.x);
  expect(newPos.y).toBe(originalPos.y);

  // Le flash invalid doit être présent
  const flashInvalidAt = useSceneStore.getState().ui.flashInvalidAt;
  expect(flashInvalidAt).toBeDefined();

  // Vérifier que la pièce sélectionnée a data-invalid="true"
  const selectedPiece = screen
    .getAllByTestId('piece-rect')
    .find((el) => el.getAttribute('data-selected') === 'true');
  expect(selectedPiece).toBeDefined();
  expect(selectedPiece).toHaveAttribute('data-invalid', 'true');
});
