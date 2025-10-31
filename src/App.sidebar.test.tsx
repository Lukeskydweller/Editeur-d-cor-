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

test('sidebar shows layers and materials counts', () => {
  // Init avec scène par défaut + ajout d'une pièce
  const { initSceneWithDefaults, addRectAtCenter } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);
  addRectAtCenter(100, 60);

  render(<App />);

  // Vérifier que les listes existent
  expect(screen.getByLabelText(/layers-list/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/materials-list/i)).toBeInTheDocument();

  // Vérifier les titres
  expect(screen.getByText(/Layers/i)).toBeInTheDocument();
  expect(screen.getByText(/Materials/i)).toBeInTheDocument();

  // Vérifier qu'il y a au moins un compteur de pièces (2 pièces au total)
  const counts = screen.getAllByText('2');
  expect(counts.length).toBeGreaterThan(0);
});

test('material select appears when a piece is selected', () => {
  const { initSceneWithDefaults, selectPiece } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  // Sélectionner la première pièce
  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  selectPiece(pieceId);

  render(<App />);

  // Le select doit être présent
  expect(screen.getByLabelText(/material-select/i)).toBeInTheDocument();
});

test('material select changes piece material', () => {
  const { initSceneWithDefaults, selectPiece } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  // Ajouter un second matériau manuellement
  const newMaterialId = 'mat_test2';
  useSceneStore.setState((s) => ({
    scene: {
      ...s.scene,
      materials: {
        ...s.scene.materials,
        [newMaterialId]: {
          id: newMaterialId,
          name: 'Matériau 2',
          oriented: false,
        },
      },
    },
  }));

  // Sélectionner la première pièce
  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  const initialMaterialId = useSceneStore.getState().scene.pieces[pieceId].materialId;
  selectPiece(pieceId);

  render(<App />);

  const select = screen.getByLabelText(/material-select/i) as HTMLSelectElement;
  expect(select.value).toBe(initialMaterialId);

  // Changer le matériau
  fireEvent.change(select, { target: { value: newMaterialId } });

  // Vérifier que le matériau a changé
  const updatedPiece = useSceneStore.getState().scene.pieces[pieceId];
  expect(updatedPiece.materialId).toBe(newMaterialId);
});
