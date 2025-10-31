import { render, screen, fireEvent, act } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import App from './App';
import { useSceneStore } from '@/state/useSceneStore';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
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
      history: {
        past: [],
        future: [],
        limit: 100,
      },
    },
  });
});

test('Ctrl+Z triggers undo', () => {
  const { addLayer, addMaterial, addRectPiece, selectPiece, duplicateSelected } = useSceneStore.getState();

  addLayer('Layer 1');
  const [layerId] = useSceneStore.getState().scene.layerOrder;
  const materialId = addMaterial({ name: 'Mat1', oriented: false });
  addRectPiece(layerId, materialId, 100, 50, 10, 10);

  const pieces1 = Object.keys(useSceneStore.getState().scene.pieces);
  selectPiece(pieces1[0]);

  render(<App />);

  duplicateSelected();

  const pieces2 = Object.keys(useSceneStore.getState().scene.pieces);
  expect(pieces2.length).toBe(2);

  // Trigger Ctrl+Z
  act(() => {
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  });

  const pieces3 = Object.keys(useSceneStore.getState().scene.pieces);
  expect(pieces3.length).toBe(1);
});

test('Ctrl+Y triggers redo', () => {
  const { addLayer, addMaterial, addRectPiece, selectPiece, duplicateSelected } = useSceneStore.getState();

  addLayer('Layer 1');
  const [layerId] = useSceneStore.getState().scene.layerOrder;
  const materialId = addMaterial({ name: 'Mat1', oriented: false });
  addRectPiece(layerId, materialId, 100, 50, 10, 10);

  const pieces1 = Object.keys(useSceneStore.getState().scene.pieces);
  selectPiece(pieces1[0]);

  render(<App />);

  duplicateSelected();

  const pieces2 = Object.keys(useSceneStore.getState().scene.pieces);
  expect(pieces2.length).toBe(2);

  // Undo
  act(() => {
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  });

  const pieces3 = Object.keys(useSceneStore.getState().scene.pieces);
  expect(pieces3.length).toBe(1);

  // Redo with Ctrl+Y
  act(() => {
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
  });

  const pieces4 = Object.keys(useSceneStore.getState().scene.pieces);
  expect(pieces4.length).toBe(2);
});

test('Ctrl+Shift+Z triggers redo', () => {
  const { addLayer, addMaterial, addRectPiece, selectPiece, duplicateSelected } = useSceneStore.getState();

  addLayer('Layer 1');
  const [layerId] = useSceneStore.getState().scene.layerOrder;
  const materialId = addMaterial({ name: 'Mat1', oriented: false });
  addRectPiece(layerId, materialId, 100, 50, 10, 10);

  const pieces1 = Object.keys(useSceneStore.getState().scene.pieces);
  selectPiece(pieces1[0]);

  render(<App />);

  duplicateSelected();

  const pieces2 = Object.keys(useSceneStore.getState().scene.pieces);
  expect(pieces2.length).toBe(2);

  // Undo
  act(() => {
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  });

  const pieces3 = Object.keys(useSceneStore.getState().scene.pieces);
  expect(pieces3.length).toBe(1);

  // Redo with Ctrl+Shift+Z
  act(() => {
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
  });

  const pieces4 = Object.keys(useSceneStore.getState().scene.pieces);
  expect(pieces4.length).toBe(2);
});

test('undo restores state visually after drag', () => {
  const { addLayer, addMaterial, addRectPiece, selectPiece, nudgeSelected } = useSceneStore.getState();

  addLayer('Layer 1');
  const [layerId] = useSceneStore.getState().scene.layerOrder;
  const materialId = addMaterial({ name: 'Mat1', oriented: false });
  addRectPiece(layerId, materialId, 100, 50, 10, 10);

  const pieces = Object.keys(useSceneStore.getState().scene.pieces);
  selectPiece(pieces[0]);

  render(<App />);

  const originalPos = { ...useSceneStore.getState().scene.pieces[pieces[0]].position };

  // Nudge the piece
  nudgeSelected(20, 20);

  const newPos = useSceneStore.getState().scene.pieces[pieces[0]].position;
  expect(newPos.x).toBe(originalPos.x + 20);
  expect(newPos.y).toBe(originalPos.y + 20);

  // Undo
  act(() => {
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  });

  const restoredPos = useSceneStore.getState().scene.pieces[pieces[0]].position;
  expect(restoredPos.x).toBe(originalPos.x);
  expect(restoredPos.y).toBe(originalPos.y);
});

test('multiple undo/redo operations work correctly', () => {
  const { addLayer, addMaterial, addRectPiece, selectPiece, duplicateSelected } = useSceneStore.getState();

  addLayer('Layer 1');
  const [layerId] = useSceneStore.getState().scene.layerOrder;
  const materialId = addMaterial({ name: 'Mat1', oriented: false });
  addRectPiece(layerId, materialId, 100, 50, 10, 10);

  const pieces1 = Object.keys(useSceneStore.getState().scene.pieces);
  selectPiece(pieces1[0]);

  render(<App />);

  // Duplicate 3 times
  duplicateSelected();
  expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(2);

  duplicateSelected();
  expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(3);

  duplicateSelected();
  expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(4);

  // Undo 3 times
  act(() => {
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  });
  expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(3);

  act(() => {
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  });
  expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(2);

  act(() => {
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  });
  expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(1);

  // Redo 2 times
  act(() => {
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
  });
  expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(2);

  act(() => {
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
  });
  expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(3);
});

test('autosave persists after reload', () => {
  const { addRectAtCenter } = useSceneStore.getState();

  // Use a commit action that triggers autosave
  addRectAtCenter(100, 50);

  render(<App />);

  // Check that localStorage has been updated
  const saved = localStorageMock.getItem('editeur.scene.v1');
  expect(saved).not.toBeNull();

  const parsed = JSON.parse(saved!);
  expect(Object.keys(parsed.scene.pieces).length).toBe(1);

  // Simulate reload: clear store and call initSceneWithDefaults
  useSceneStore.setState({
    scene: {
      id: 'empty',
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
      history: {
        past: [],
        future: [],
        limit: 100,
      },
    },
  });

  const { initSceneWithDefaults } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const restoredScene = useSceneStore.getState().scene;
  expect(Object.keys(restoredScene.pieces).length).toBe(1);
});
