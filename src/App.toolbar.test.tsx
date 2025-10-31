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

test('adds rectangle on button click', () => {
  // Init scène avec pièce par défaut
  const { initSceneWithDefaults } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  render(<App />);

  // Vérifier qu'il y a 1 pièce au départ
  const initialPieces = Object.keys(useSceneStore.getState().scene.pieces);
  expect(initialPieces.length).toBe(1);

  // Cliquer sur le bouton "Ajouter rectangle"
  const addButton = screen.getByRole('button', { name: /ajouter rectangle/i });
  fireEvent.click(addButton);

  // Vérifier qu'il y a maintenant 2 pièces
  const finalPieces = Object.keys(useSceneStore.getState().scene.pieces);
  expect(finalPieces.length).toBe(2);

  // Vérifier que la nouvelle pièce est sélectionnée
  const selectedId = useSceneStore.getState().ui.selectedId;
  expect(selectedId).toBeDefined();
  expect(finalPieces).toContain(selectedId);

  // Vérifier que la nouvelle pièce est au centre
  const newPiece = useSceneStore.getState().scene.pieces[selectedId!];
  expect(newPiece.size).toEqual({ w: 100, h: 60 });
  expect(newPiece.position.x).toBe((600 - 100) / 2);
  expect(newPiece.position.y).toBe((600 - 60) / 2);
});

test('deletes selected piece on button click', () => {
  // Init scène avec pièce par défaut
  const { initSceneWithDefaults, selectPiece } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  selectPiece(pieceId);

  render(<App />);

  // Vérifier qu'il y a 1 pièce au départ
  expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(1);
  expect(useSceneStore.getState().ui.selectedId).toBe(pieceId);

  // Cliquer sur le bouton "Supprimer"
  const deleteButton = screen.getByRole('button', { name: /supprimer/i });
  fireEvent.click(deleteButton);

  // Vérifier qu'il n'y a plus de pièce
  expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(0);
  expect(useSceneStore.getState().ui.selectedId).toBeUndefined();
});

test('deletes selected piece on Delete key', () => {
  // Init scène avec pièce par défaut
  const { initSceneWithDefaults, selectPiece } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  selectPiece(pieceId);

  render(<App />);

  // Vérifier qu'il y a 1 pièce au départ
  expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(1);
  expect(useSceneStore.getState().ui.selectedId).toBe(pieceId);

  // Appuyer sur Delete
  fireEvent.keyDown(window, { key: 'Delete' });

  // Vérifier qu'il n'y a plus de pièce
  expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(0);
  expect(useSceneStore.getState().ui.selectedId).toBeUndefined();
});
