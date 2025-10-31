import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
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

test('Group snap to centerX of other piece', () => {
  const { initSceneWithDefaults, addRectPiece, setSelection, setSnap10mm, beginDrag, updateDrag, endDrag } =
    useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const layerId = Object.keys(useSceneStore.getState().scene.layers)[0];
  const materialId = Object.keys(useSceneStore.getState().scene.materials)[0];

  // Ajouter p2 et p3 à des positions spécifiques
  addRectPiece(layerId, materialId, 80, 80, 200, 200);
  addRectPiece(layerId, materialId, 80, 80, 300, 300);

  setSnap10mm(false);

  const pieces = Object.values(useSceneStore.getState().scene.pieces);
  const p1 = pieces[0]; // (40, 40, 120x80) → centerX = 100
  const p2 = pieces[1];
  const p3 = pieces[2];

  // Sélectionner p2 + p3
  setSelection([p2.id, p3.id]);

  render(<App />);

  // Commencer drag sur p2
  beginDrag(p2.id);

  // Groupe bbox actuel : p2=(200,200,80x80), p3=(300,300,80x80)
  // bbox = (200, 200, 180, 180) → centerX = 200 + 90 = 290
  // On veut déplacer pour que centerX ≈ 100 → delta x = 100 - 290 = -190
  // Mais on va faire un delta de -187 pour être à 3mm de p1.centerX
  updateDrag(-187, 0);

  // Guides doivent être actifs
  expect(useSceneStore.getState().ui.guides).toBeDefined();
  expect(useSceneStore.getState().ui.guides!.length).toBeGreaterThan(0);

  endDrag();

  // Vérifier que le groupe a snappé : son bbox centerX devrait être proche de 100
  const updatedPieces = Object.values(useSceneStore.getState().scene.pieces);
  const updated2 = updatedPieces.find((p) => p.id === p2.id)!;
  const updated3 = updatedPieces.find((p) => p.id === p3.id)!;

  const groupMinX = Math.min(updated2.position.x, updated3.position.x);
  const groupMaxX = Math.max(updated2.position.x + updated2.size.w, updated3.position.x + updated3.size.w);
  const groupCenterX = (groupMinX + groupMaxX) / 2;

  expect(groupCenterX).toBeCloseTo(100, 0);

  // Guides nettoyés après endDrag
  expect(useSceneStore.getState().ui.guides).toBeUndefined();
});

test('Group snap to bottom of other piece', () => {
  const { initSceneWithDefaults, addRectPiece, setSelection, setSnap10mm, beginDrag, updateDrag, endDrag } =
    useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const layerId = Object.keys(useSceneStore.getState().scene.layers)[0];
  const materialId = Object.keys(useSceneStore.getState().scene.materials)[0];

  // Ajouter p2 et p3 à des positions spécifiques
  addRectPiece(layerId, materialId, 80, 80, 200, 200);
  addRectPiece(layerId, materialId, 80, 80, 300, 300);

  setSnap10mm(false);

  const pieces = Object.values(useSceneStore.getState().scene.pieces);
  const p1 = pieces[0]; // (40, 40, 120x80) → bottom = 120
  const p2 = pieces[1];
  const p3 = pieces[2];

  // Sélectionner p2 + p3
  setSelection([p2.id, p3.id]);

  render(<App />);

  // Commencer drag sur p2
  beginDrag(p2.id);

  // Groupe bbox actuel : p2=(200,200,80x80), p3=(300,300,80x80)
  // bbox = (200, 200, 180, 180) → top = 200
  // On veut déplacer pour que top ≈ 120 (p1.bottom) → delta y = 120 - 200 = -80
  // Mais on va faire -77 pour être à 3mm de p1.bottom
  updateDrag(0, -77);

  // Guides doivent être actifs
  expect(useSceneStore.getState().ui.guides).toBeDefined();
  expect(useSceneStore.getState().ui.guides!.length).toBeGreaterThan(0);

  endDrag();

  // Vérifier que le groupe top a snappé à p1.bottom = 120
  const updatedPieces = Object.values(useSceneStore.getState().scene.pieces);
  const updated2 = updatedPieces.find((p) => p.id === p2.id)!;
  const updated3 = updatedPieces.find((p) => p.id === p3.id)!;

  const groupTop = Math.min(updated2.position.y, updated3.position.y);

  expect(groupTop).toBeCloseTo(120, 0);

  // Guides nettoyés après endDrag
  expect(useSceneStore.getState().ui.guides).toBeUndefined();
});

test('Group no snap when beyond 5mm threshold', () => {
  const { initSceneWithDefaults, addRectPiece, setSelection, setSnap10mm, beginDrag, updateDrag, endDrag } =
    useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const layerId = Object.keys(useSceneStore.getState().scene.layers)[0];
  const materialId = Object.keys(useSceneStore.getState().scene.materials)[0];

  // Ajouter p2 et p3 loin de p1
  addRectPiece(layerId, materialId, 80, 80, 400, 400);
  addRectPiece(layerId, materialId, 80, 80, 500, 500);

  setSnap10mm(false);

  const pieces = Object.values(useSceneStore.getState().scene.pieces);
  const p1 = pieces[0];
  const p2 = pieces[1];
  const p3 = pieces[2];

  setSelection([p2.id, p3.id]);

  render(<App />);

  // Commencer drag sur p2
  beginDrag(p2.id);

  // Drag loin de p1 (>5mm de tous les bords)
  // Mouvement de 20mm à droite
  updateDrag(20, 0);

  // Pas de guides car >5mm
  expect(useSceneStore.getState().ui.guides).toEqual([]);

  endDrag();

  // Position a bougé de 20mm
  const updated2 = useSceneStore.getState().scene.pieces[p2.id];
  expect(updated2.position.x).toBeCloseTo(420, 0);
});
