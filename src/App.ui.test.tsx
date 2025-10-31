import { render, screen } from '@testing-library/react';
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
  });
});

test('displays OK status when no validation problems', () => {
  render(<App />);

  const status = screen.getByRole('status');
  expect(status).toHaveTextContent(/OK — aucune anomalie détectée/i);
});

test('displays BLOCK status when pieces overlap', () => {
  // Init scène avec pièce par défaut
  const { initSceneWithDefaults } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  // Ajouter une seconde pièce qui chevauche la première (40,40 120×80)
  const state = useSceneStore.getState();
  const layerId = state.scene.layerOrder[0];
  const materialId = Object.keys(state.scene.materials)[0];

  const overlappingPiece: Piece = {
    id: 'overlap-piece',
    layerId,
    materialId,
    position: { x: 50, y: 50 }, // chevauche (40,40)-(160,120)
    rotationDeg: 0,
    scale: { x: 1, y: 1 },
    kind: 'rect',
    size: { w: 80, h: 60 },
  };
  useSceneStore.setState((s) => ({
    scene: {
      ...s.scene,
      pieces: { ...s.scene.pieces, [overlappingPiece.id]: overlappingPiece },
    },
  }));

  render(<App />);

  const status = screen.getByRole('status');
  expect(status).toHaveTextContent(/BLOCK/i);
  expect(status).toHaveTextContent(/1 problème/i);
  expect(status).toHaveTextContent(/Chevauchements/i);
});
