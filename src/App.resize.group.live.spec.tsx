import { beforeEach, test, expect, describe } from 'vitest';
import { useSceneStore } from '@/state/useSceneStore';
import type { ID, Milli } from '@/types/scene';

// Extract store state type from Zustand store
type StoreState = ReturnType<typeof useSceneStore.getState>;

describe('Group resize live preview (no scene mutations)', () => {
  beforeEach(() => {
    // Reset store entre les tests
    useSceneStore.setState({
      scene: {
        id: 'test',
        createdAt: new Date().toISOString(),
        size: { w: 600 as Milli, h: 600 as Milli },
        materials: {
          mat1: { id: 'mat1' as ID, name: 'Mat1', oriented: false },
        },
        layers: {
          layer1: { id: 'layer1' as ID, name: 'Layer1', z: 0, pieces: [] },
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
        isTransientActive: false,
        handlesEpoch: 0,
        history: {
          past: [],
          future: [],
          limit: 100,
        },
      },
    });
  });

  test('preview matrices computed without mutating scene.pieces', () => {
    const { addRectAtCenter, startGroupResize, _updateGroupResizeRafSafe } = useSceneStore.getState();

    // Créer 3 pièces
    addRectAtCenter(40 as Milli, 60 as Milli); // p1
    addRectAtCenter(50 as Milli, 50 as Milli); // p2
    addRectAtCenter(60 as Milli, 40 as Milli); // p3

    const pieceIds = Object.keys(useSceneStore.getState().scene.pieces) as ID[];
    const [p1Id, p2Id, p3Id] = pieceIds;

    // Positionner les pièces
    useSceneStore.setState((state: StoreState) => ({
      scene: {
        ...state.scene,
        pieces: {
          ...state.scene.pieces,
          [p1Id]: { ...state.scene.pieces[p1Id], position: { x: 100 as Milli, y: 100 as Milli } },
          [p2Id]: { ...state.scene.pieces[p2Id], position: { x: 150 as Milli, y: 100 as Milli } },
          [p3Id]: { ...state.scene.pieces[p3Id], position: { x: 200 as Milli, y: 100 as Milli } },
        },
      },
      ui: {
        ...state.ui,
        selectedIds: [p1Id, p2Id, p3Id],
        selectedId: undefined,
      },
    }));

    // Snapshot des pièces AVANT le resize
    const piecesBefore = JSON.parse(JSON.stringify(useSceneStore.getState().scene.pieces));

    // Commencer le resize
    const pivot = { x: 165 as Milli, y: 120 as Milli }; // centre approximatif
    const startPointer = { x: 200 as Milli, y: 120 as Milli };
    startGroupResize('se', startPointer);

    // Simuler une mise à jour (RAF call) avec un facteur ×1.5
    const targetPointer = { x: 252.5 as Milli, y: 120 as Milli }; // 1.5× distance
    _updateGroupResizeRafSafe({ pointer: targetPointer, altKey: false });

    // Snapshot des pièces APRÈS updateGroupResize
    const piecesAfter = useSceneStore.getState().scene.pieces;

    // ASSERTION CRITIQUE: scene.pieces NE DOIT PAS avoir changé
    expect(JSON.stringify(piecesAfter)).toBe(JSON.stringify(piecesBefore));

    // Vérifier que preview.previewPieces existe et contient des matrices
    const preview = useSceneStore.getState().ui.groupResizing?.preview;
    expect(preview).toBeDefined();
    expect(preview?.previewPieces).toBeDefined();
    expect(preview?.previewPieces?.length).toBe(3);

    // Vérifier que les matrices sont définies
    for (const pp of preview!.previewPieces!) {
      expect(pp.matrix).toBeDefined();
      expect(pp.matrix.a).toBeGreaterThan(0); // scale factor
      expect(pp.matrix.d).toBeGreaterThan(0);
    }
  });

  test('corner handle isotropic: scaleX === scaleY in preview matrices', () => {
    const { addRectAtCenter, startGroupResize, _updateGroupResizeRafSafe } = useSceneStore.getState();

    // Créer 2 pièces
    addRectAtCenter(40 as Milli, 60 as Milli);
    addRectAtCenter(50 as Milli, 50 as Milli);

    const pieceIds = Object.keys(useSceneStore.getState().scene.pieces) as ID[];
    const [p1Id, p2Id] = pieceIds;

    useSceneStore.setState((state: StoreState) => ({
      scene: {
        ...state.scene,
        pieces: {
          ...state.scene.pieces,
          [p1Id]: { ...state.scene.pieces[p1Id], position: { x: 100 as Milli, y: 100 as Milli } },
          [p2Id]: { ...state.scene.pieces[p2Id], position: { x: 150 as Milli, y: 100 as Milli } },
        },
      },
      ui: {
        ...state.ui,
        selectedIds: [p1Id, p2Id],
        selectedId: undefined,
      },
    }));

    const pivot = { x: 145 as Milli, y: 120 as Milli };
    const startPointer = { x: 180 as Milli, y: 120 as Milli };
    startGroupResize('se', startPointer);

    const targetPointer = { x: 215 as Milli, y: 120 as Milli }; // scale ×1.5 environ
    _updateGroupResizeRafSafe({ pointer: targetPointer, altKey: false });

    const preview = useSceneStore.getState().ui.groupResizing?.preview;
    expect(preview?.previewPieces).toBeDefined();

    // Vérifier que toutes les matrices sont isotropes (a === d)
    for (const pp of preview!.previewPieces!) {
      expect(pp.matrix.a).toBeCloseTo(pp.matrix.d, 5);
      expect(pp.matrix.b).toBe(0); // no rotation in scale transform
      expect(pp.matrix.c).toBe(0);
    }
  });
});
