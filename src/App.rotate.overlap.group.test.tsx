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
      selectedIds: undefined,
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

test('group rotation +90 blocked when would cause overlap with external piece', () => {
  const { addRectAtCenter } = useSceneStore.getState();

  // Créer trois rectangles :
  // p1, p2 forment un groupe horizontal
  // p3 est placé de sorte que la rotation rigide +90° du groupe cause overlap
  // Avec rotation rigide, le groupe tourne autour de son pivot central

  addRectAtCenter(30 as Milli, 60 as Milli); // p1
  addRectAtCenter(30 as Milli, 60 as Milli); // p2
  addRectAtCenter(40 as Milli, 80 as Milli); // p3

  const pieceIds = Object.keys(useSceneStore.getState().scene.pieces) as ID[];
  const p1Id = pieceIds[0];
  const p2Id = pieceIds[1];
  const p3Id = pieceIds[2];

  // Positionner : groupe (p1+p2) horizontal, p3 placé pour bloquer la rotation
  // Groupe bbox: (100..170, 100..160), pivot ~(135, 130)
  // Après +90°: le groupe devient vertical et overlap p3
  useSceneStore.setState((state) => ({
    scene: {
      ...state.scene,
      pieces: {
        ...state.scene.pieces,
        [p1Id]: { ...state.scene.pieces[p1Id], position: { x: 100 as Milli, y: 100 as Milli } },
        [p2Id]: { ...state.scene.pieces[p2Id], position: { x: 140 as Milli, y: 100 as Milli } },
        [p3Id]: { ...state.scene.pieces[p3Id], position: { x: 130 as Milli, y: 155 as Milli } },
      },
      revision: (state.scene.revision ?? 0) + 1,
    },
    ui: {
      ...state.ui,
      selectedIds: [p1Id, p2Id], // Multisélection p1 + p2
      selectedId: undefined,
    },
  }));

  expect(useSceneStore.getState().scene.pieces[p1Id].rotationDeg).toBe(0);
  expect(useSceneStore.getState().scene.pieces[p2Id].rotationDeg).toBe(0);

  render(<App />);

  const plus90Button = screen.getByRole('button', { name: /Rotate \+90°/i });

  const beforeRotationP1 = useSceneStore.getState().scene.pieces[p1Id].rotationDeg;
  const beforeRotationP2 = useSceneStore.getState().scene.pieces[p2Id].rotationDeg;
  const beforeHistory = useSceneStore.getState().ui.history?.past.length ?? 0;

  fireEvent.click(plus90Button);

  // Vérifier qu'aucune des deux pièces n'a tourné
  expect(useSceneStore.getState().scene.pieces[p1Id].rotationDeg).toBe(beforeRotationP1);
  expect(useSceneStore.getState().scene.pieces[p2Id].rotationDeg).toBe(beforeRotationP2);

  // Vérifier qu'aucun historique n'a été ajouté
  expect(useSceneStore.getState().ui.history?.past.length ?? 0).toBe(beforeHistory);

  // Vérifier que flashInvalidAt a été déclenché
  expect(useSceneStore.getState().ui.flashInvalidAt).toBeGreaterThan(0);
});

test('group rotation -90 works when no overlap with external pieces', () => {
  const { addRectAtCenter } = useSceneStore.getState();

  // Deux rectangles isolés, loin de tout
  addRectAtCenter(30 as Milli, 60 as Milli); // p1
  addRectAtCenter(30 as Milli, 60 as Milli); // p2

  const pieceIds = Object.keys(useSceneStore.getState().scene.pieces) as ID[];
  const p1Id = pieceIds[0];
  const p2Id = pieceIds[1];

  // Positionner loin de tout
  useSceneStore.setState((state) => ({
    scene: {
      ...state.scene,
      pieces: {
        ...state.scene.pieces,
        [p1Id]: { ...state.scene.pieces[p1Id], position: { x: 300 as Milli, y: 300 as Milli } },
        [p2Id]: { ...state.scene.pieces[p2Id], position: { x: 340 as Milli, y: 300 as Milli } },
      },
      revision: (state.scene.revision ?? 0) + 1,
    },
    ui: {
      ...state.ui,
      selectedIds: [p1Id, p2Id],
      selectedId: undefined,
    },
  }));

  render(<App />);

  const minus90Button = screen.getByRole('button', { name: /Rotate −90°/i });
  const beforeHistory = useSceneStore.getState().ui.history?.past.length ?? 0;

  fireEvent.click(minus90Button);

  // Rotation appliquée (pas d'overlap externe)
  expect(useSceneStore.getState().scene.pieces[p1Id].rotationDeg).toBe(270);
  expect(useSceneStore.getState().scene.pieces[p2Id].rotationDeg).toBe(270);
  expect(useSceneStore.getState().ui.history?.past.length ?? 0).toBe(beforeHistory + 1);
});

test('group rotation ignores internal collisions within group', () => {
  const { addRectAtCenter } = useSceneStore.getState();

  // Deux rectangles TRÈS proches (quasi-overlap interne au groupe)
  // mais loin de toute autre pièce → rotation doit passer
  addRectAtCenter(40 as Milli, 80 as Milli); // p1
  addRectAtCenter(40 as Milli, 80 as Milli); // p2

  const pieceIds = Object.keys(useSceneStore.getState().scene.pieces) as ID[];
  const p1Id = pieceIds[0];
  const p2Id = pieceIds[1];

  // p1 et p2 se touchent presque (gap < 1mm)
  useSceneStore.setState((state) => ({
    scene: {
      ...state.scene,
      pieces: {
        ...state.scene.pieces,
        [p1Id]: { ...state.scene.pieces[p1Id], position: { x: 300 as Milli, y: 300 as Milli } },
        [p2Id]: { ...state.scene.pieces[p2Id], position: { x: 340 as Milli, y: 300 as Milli } },
      },
      revision: (state.scene.revision ?? 0) + 1,
    },
    ui: {
      ...state.ui,
      selectedIds: [p1Id, p2Id],
      selectedId: undefined,
    },
  }));

  render(<App />);

  const plus90Button = screen.getByRole('button', { name: /Rotate \+90°/i });
  const beforeHistory = useSceneStore.getState().ui.history?.past.length ?? 0;

  fireEvent.click(plus90Button);

  // Rotation appliquée malgré proximité interne (validateNoOverlapForCandidate ignore internal)
  expect(useSceneStore.getState().scene.pieces[p1Id].rotationDeg).toBe(90);
  expect(useSceneStore.getState().scene.pieces[p2Id].rotationDeg).toBe(90);
  expect(useSceneStore.getState().ui.history?.past.length ?? 0).toBe(beforeHistory + 1);
});
