import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, test, expect } from 'vitest';
import App from './App';
import { useSceneStore } from '@/state/useSceneStore';
import type { ID, Milli } from '@/types/scene';

beforeEach(() => {
  // Reset store entre les tests
  useSceneStore.setState({
    scene: {
      id: 'test',
      createdAt: new Date().toISOString(),
      size: { w: 600 as Milli, h: 600 as Milli },
      materials: {
        mat1: { id: 'mat1' as ID, name: 'Mat1', thickness: 18, color: '#333', oriented: false, orientation: 0 },
      },
      layers: {
        layer1: { id: 'layer1' as ID, name: 'Layer1', materialId: 'mat1' as ID, pieces: [] },
      },
      pieces: {},
      layerOrder: ['layer1' as ID],
      revision: 0,
    },
    ui: {
      selectedId: undefined,
      flashInvalidAt: undefined,
      dragging: undefined,
      snap10mm: false,
      history: {
        past: [],
        future: [],
        limit: 100,
      },
    },
  });
});

test('rotate +90 button blocked when would cause overlap', () => {
  const { addRectAtCenter, selectPiece, rotateSelected } = useSceneStore.getState();

  // Créer deux rectangles côte-à-côte horizontalement
  // p1: (100, 100) 40x80 → AABB (100..140, 100..180)
  // p2: (145, 100) 40x80 → AABB (145..185, 100..180)
  // Gap horizontal de 5mm, pas d'overlap
  addRectAtCenter(40 as Milli, 80 as Milli);
  addRectAtCenter(40 as Milli, 80 as Milli);

  const pieceIds = Object.keys(useSceneStore.getState().scene.pieces) as ID[];
  const p1Id = pieceIds[0];
  const p2Id = pieceIds[1];

  // Positionner manuellement pour contrôler la géométrie
  useSceneStore.setState((state) => ({
    scene: {
      ...state.scene,
      pieces: {
        ...state.scene.pieces,
        [p1Id]: { ...state.scene.pieces[p1Id], position: { x: 100 as Milli, y: 100 as Milli } },
        [p2Id]: { ...state.scene.pieces[p2Id], position: { x: 145 as Milli, y: 100 as Milli } },
      },
      revision: (state.scene.revision ?? 0) + 1,
    },
  }));

  // Sélectionner p1 (40x80, rotation 0°)
  selectPiece(p1Id);
  expect(useSceneStore.getState().scene.pieces[p1Id].rotationDeg).toBe(0);

  render(<App />);

  const plus90Button = screen.getByRole('button', { name: /Rotate \+90°/i });

  // Si on tourne p1 à 90°, son AABB devient 80x40 → (100..180, 100..140)
  // Ce qui overlap avec p2 (145..185, 100..180)
  // → La rotation doit être bloquée

  const beforeRotation = useSceneStore.getState().scene.pieces[p1Id].rotationDeg;
  const beforeHistory = useSceneStore.getState().ui.history?.past.length ?? 0;

  fireEvent.click(plus90Button);

  // Vérifier que rotation n'a PAS changé
  expect(useSceneStore.getState().scene.pieces[p1Id].rotationDeg).toBe(beforeRotation);

  // Vérifier qu'aucun historique n'a été ajouté
  expect(useSceneStore.getState().ui.history?.past.length ?? 0).toBe(beforeHistory);

  // Vérifier que flashInvalidAt a été déclenché
  expect(useSceneStore.getState().ui.flashInvalidAt).toBeGreaterThan(0);
});

test('set rotation 90° button blocked when would cause overlap', () => {
  const { addRectAtCenter, selectPiece, setSelectedRotation } = useSceneStore.getState();

  // Même setup : deux rectangles adjacents
  addRectAtCenter(40 as Milli, 80 as Milli);
  addRectAtCenter(40 as Milli, 80 as Milli);

  const pieceIds = Object.keys(useSceneStore.getState().scene.pieces) as ID[];
  const p1Id = pieceIds[0];
  const p2Id = pieceIds[1];

  useSceneStore.setState((state) => ({
    scene: {
      ...state.scene,
      pieces: {
        ...state.scene.pieces,
        [p1Id]: { ...state.scene.pieces[p1Id], position: { x: 100 as Milli, y: 100 as Milli } },
        [p2Id]: { ...state.scene.pieces[p2Id], position: { x: 145 as Milli, y: 100 as Milli } },
      },
      revision: (state.scene.revision ?? 0) + 1,
    },
  }));

  selectPiece(p1Id);

  render(<App />);

  const set90Button = screen.getByRole('button', { name: /Rotation 90°/i });

  const beforeRotation = useSceneStore.getState().scene.pieces[p1Id].rotationDeg;
  const beforeHistory = useSceneStore.getState().ui.history?.past.length ?? 0;

  fireEvent.click(set90Button);

  // Rotation bloquée
  expect(useSceneStore.getState().scene.pieces[p1Id].rotationDeg).toBe(beforeRotation);
  expect(useSceneStore.getState().ui.history?.past.length ?? 0).toBe(beforeHistory);
  expect(useSceneStore.getState().ui.flashInvalidAt).toBeGreaterThan(0);
});

test('rotate -90 button works when no overlap', () => {
  const { addRectAtCenter, selectPiece } = useSceneStore.getState();

  // Rectangle isolé loin de tout
  addRectAtCenter(40 as Milli, 80 as Milli);

  const pieceIds = Object.keys(useSceneStore.getState().scene.pieces) as ID[];
  const p1Id = pieceIds[0];

  useSceneStore.setState((state) => ({
    scene: {
      ...state.scene,
      pieces: {
        ...state.scene.pieces,
        [p1Id]: { ...state.scene.pieces[p1Id], position: { x: 300 as Milli, y: 300 as Milli } },
      },
      revision: (state.scene.revision ?? 0) + 1,
    },
  }));

  selectPiece(p1Id);
  expect(useSceneStore.getState().scene.pieces[p1Id].rotationDeg).toBe(0);

  render(<App />);

  const minus90Button = screen.getByRole('button', { name: /Rotate −90°/i });
  const beforeHistory = useSceneStore.getState().ui.history?.past.length ?? 0;

  fireEvent.click(minus90Button);

  // Rotation appliquée (pas d'overlap)
  expect(useSceneStore.getState().scene.pieces[p1Id].rotationDeg).toBe(270);
  expect(useSceneStore.getState().ui.history?.past.length ?? 0).toBe(beforeHistory + 1);
});
