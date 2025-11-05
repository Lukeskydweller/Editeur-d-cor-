import { beforeEach, test, expect, describe } from 'vitest';
import { useSceneStore } from '@/state/useSceneStore';
import type { ID, Milli } from '@/types/scene';

// Extract store state type from Zustand store
type StoreState = ReturnType<typeof useSceneStore.getState>;

describe('Isotropic group resize', () => {
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
        history: {
          past: [],
          future: [],
          limit: 100,
        },
      },
    });
  });

  test('isotropic scale ×1.5 preserves shape ratios and distances to pivot', () => {
    const { addRectAtCenter } = useSceneStore.getState();

    // Créer motif mixte 0°/90°, bord-à-bord
    addRectAtCenter(40 as Milli, 60 as Milli); // p1: 40×60 à 0°
    addRectAtCenter(30 as Milli, 80 as Milli); // p2: 30×80 à 90° (effectif 80×30)
    addRectAtCenter(50 as Milli, 40 as Milli); // p3: 50×40 à 0°

    const pieceIds = Object.keys(useSceneStore.getState().scene.pieces) as ID[];
    const [p1Id, p2Id, p3Id] = pieceIds;

    // Positionner motif bord-à-bord
    useSceneStore.setState((state: StoreState) => ({
      scene: {
        ...state.scene,
        pieces: {
          ...state.scene.pieces,
          [p1Id]: { ...state.scene.pieces[p1Id], position: { x: 100 as Milli, y: 100 as Milli }, rotationDeg: 0 },
          [p2Id]: { ...state.scene.pieces[p2Id], position: { x: 140 as Milli, y: 100 as Milli }, rotationDeg: 90 },
          [p3Id]: { ...state.scene.pieces[p3Id], position: { x: 170 as Milli, y: 100 as Milli }, rotationDeg: 0 },
        },
        revision: (state.scene.revision ?? 0) + 1,
      },
      ui: {
        ...state.ui,
        selectedIds: [p1Id, p2Id, p3Id],
        selectedId: undefined,
      },
    }));

    // Calculer pivot = centre bbox union
    const getPieceCenter = (id: ID) => {
      const p = useSceneStore.getState().scene.pieces[id];
      const r = ((p.rotationDeg ?? 0) % 360 + 360) % 360;
      const w = r === 90 || r === 270 ? p.size.h : p.size.w;
      const h = r === 90 || r === 270 ? p.size.w : p.size.h;
      return { x: p.position.x + w / 2, y: p.position.y + h / 2 };
    };

    const initialCenters = {
      p1: getPieceCenter(p1Id),
      p2: getPieceCenter(p2Id),
      p3: getPieceCenter(p3Id),
    };

    // Pivot = centre AABB union
    const pieces = useSceneStore.getState().scene.pieces;
    const aabbs = [p1Id, p2Id, p3Id].map(id => {
      const p = pieces[id];
      const r = ((p.rotationDeg ?? 0) % 360 + 360) % 360;
      const w = r === 90 || r === 270 ? p.size.h : p.size.w;
      const h = r === 90 || r === 270 ? p.size.w : p.size.h;
      return { x: p.position.x, y: p.position.y, w, h };
    });
    const minX = Math.min(...aabbs.map(b => b.x));
    const minY = Math.min(...aabbs.map(b => b.y));
    const maxX = Math.max(...aabbs.map(b => b.x + b.w));
    const maxY = Math.max(...aabbs.map(b => b.y + b.h));
    const pivot = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

    // Distances initiales pivot→centres
    const initialDistToPivot = {
      p1: Math.hypot(initialCenters.p1.x - pivot.x, initialCenters.p1.y - pivot.y),
      p2: Math.hypot(initialCenters.p2.x - pivot.x, initialCenters.p2.y - pivot.y),
      p3: Math.hypot(initialCenters.p3.x - pivot.x, initialCenters.p3.y - pivot.y),
    };

    // Distances inter-centres initiales
    const dist12Initial = Math.hypot(initialCenters.p2.x - initialCenters.p1.x, initialCenters.p2.y - initialCenters.p1.y);
    const dist23Initial = Math.hypot(initialCenters.p3.x - initialCenters.p2.x, initialCenters.p3.y - initialCenters.p2.y);

    // Simuler scale ×1.5 via store actions
    const { startGroupResize, updateGroupResize, endGroupResize } = useSceneStore.getState();

    // Pour obtenir scale ×1.5, on doit partir d'une position initiale et aller à 1.5× cette distance
    // Utilisons une distance de référence arbitraire (par exemple 100mm du pivot)
    const startRadius = 100; // mm
    const startPointer = {
      x: (pivot.x + startRadius) as Milli,
      y: pivot.y as Milli,
    };

    // Démarrer le resize avec ce point de départ
    startGroupResize('se', startPointer);

    // Calculer pointeur à distance 1.5× du rayon initial pour obtenir scale ×1.5
    // Avec smoothing 1% (0.01), 1.5 = 150% devrait être atteint exactement
    const targetRadius = startRadius * 1.5;
    const targetPointer = {
      x: (pivot.x + targetRadius) as Milli,
      y: pivot.y as Milli,
    };

    updateGroupResize(targetPointer);
    endGroupResize(true);

    // Vérifier tailles scalées ×1.5
    const finalPieces = useSceneStore.getState().scene.pieces;
    expect(finalPieces[p1Id].size.w).toBeCloseTo(40 * 1.5, 1);
    expect(finalPieces[p1Id].size.h).toBeCloseTo(60 * 1.5, 1);
    expect(finalPieces[p2Id].size.w).toBeCloseTo(30 * 1.5, 1);
    expect(finalPieces[p2Id].size.h).toBeCloseTo(80 * 1.5, 1);

    // Vérifier centres scalés ×1.5 par rapport au pivot
    const finalCenters = {
      p1: getPieceCenter(p1Id),
      p2: getPieceCenter(p2Id),
      p3: getPieceCenter(p3Id),
    };

    const expectedCenters = {
      p1: { x: pivot.x + (initialCenters.p1.x - pivot.x) * 1.5, y: pivot.y + (initialCenters.p1.y - pivot.y) * 1.5 },
      p2: { x: pivot.x + (initialCenters.p2.x - pivot.x) * 1.5, y: pivot.y + (initialCenters.p2.y - pivot.y) * 1.5 },
      p3: { x: pivot.x + (initialCenters.p3.x - pivot.x) * 1.5, y: pivot.y + (initialCenters.p3.y - pivot.y) * 1.5 },
    };

    expect(Math.abs(finalCenters.p1.x - expectedCenters.p1.x)).toBeLessThan(0.1);
    expect(Math.abs(finalCenters.p1.y - expectedCenters.p1.y)).toBeLessThan(0.1);
    expect(Math.abs(finalCenters.p2.x - expectedCenters.p2.x)).toBeLessThan(0.1);
    expect(Math.abs(finalCenters.p2.y - expectedCenters.p2.y)).toBeLessThan(0.1);

    // Vérifier distances inter-centres scalées ×1.5
    const dist12Final = Math.hypot(finalCenters.p2.x - finalCenters.p1.x, finalCenters.p2.y - finalCenters.p1.y);
    const dist23Final = Math.hypot(finalCenters.p3.x - finalCenters.p2.x, finalCenters.p3.y - finalCenters.p2.y);

    expect(Math.abs(dist12Final - dist12Initial * 1.5)).toBeLessThan(0.1);
    expect(Math.abs(dist23Final - dist23Initial * 1.5)).toBeLessThan(0.1);

    // Vérifier history commit
    expect(useSceneStore.getState().ui.history?.past.length).toBeGreaterThan(0);
  });

  test('inverse cycle: ×1.5 puis ×(1/1.5) returns to initial positions', () => {
    const { addRectAtCenter } = useSceneStore.getState();

    addRectAtCenter(40 as Milli, 60 as Milli); // p1
    addRectAtCenter(40 as Milli, 60 as Milli); // p2

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
        revision: (state.scene.revision ?? 0) + 1,
      },
      ui: {
        ...state.ui,
        selectedIds: [p1Id, p2Id],
        selectedId: undefined,
      },
    }));

    const initialPos1 = { ...useSceneStore.getState().scene.pieces[p1Id].position };
    const initialPos2 = { ...useSceneStore.getState().scene.pieces[p2Id].position };
    const initialSize1 = { ...useSceneStore.getState().scene.pieces[p1Id].size };
    const initialSize2 = { ...useSceneStore.getState().scene.pieces[p2Id].size };

    const { startGroupResize, updateGroupResize, endGroupResize } = useSceneStore.getState();

    // Calculer le pivot réel (centre de la bbox union)
    const pieces = useSceneStore.getState().scene.pieces;
    const aabbs = [p1Id, p2Id].map(id => {
      const p = pieces[id];
      const r = ((p.rotationDeg ?? 0) % 360 + 360) % 360;
      const w = r === 90 || r === 270 ? p.size.h : p.size.w;
      const h = r === 90 || r === 270 ? p.size.w : p.size.h;
      return { x: p.position.x, y: p.position.y, w, h };
    });
    const minX = Math.min(...aabbs.map(b => b.x));
    const minY = Math.min(...aabbs.map(b => b.y));
    const maxX = Math.max(...aabbs.map(b => b.x + b.w));
    const maxY = Math.max(...aabbs.map(b => b.y + b.h));
    const pivot = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

    // Scale ×1.5 avec distance de référence
    const startRadius = 100; // mm
    const startPointer = { x: (pivot.x + startRadius) as Milli, y: pivot.y as Milli };

    startGroupResize('se', startPointer);
    const targetRadius1 = startRadius * 1.5;
    updateGroupResize({ x: (pivot.x + targetRadius1) as Milli, y: pivot.y as Milli });
    endGroupResize(true);

    // Scale ×(1/1.5) pour retour - nouvelle distance de départ après le premier scale
    const startRadius2 = 100; // même distance de référence
    const startPointer2 = { x: (pivot.x + startRadius2) as Milli, y: pivot.y as Milli };

    startGroupResize('se', startPointer2);
    const targetRadius2 = startRadius2 / 1.5;
    updateGroupResize({ x: (pivot.x + targetRadius2) as Milli, y: pivot.y as Milli });
    endGroupResize(true);

    // Vérifier retour positions (±0.1mm)
    const finalPos1 = useSceneStore.getState().scene.pieces[p1Id].position;
    const finalPos2 = useSceneStore.getState().scene.pieces[p2Id].position;
    const finalSize1 = useSceneStore.getState().scene.pieces[p1Id].size;
    const finalSize2 = useSceneStore.getState().scene.pieces[p2Id].size;

    expect(Math.abs(finalPos1.x - initialPos1.x)).toBeLessThan(0.1);
    expect(Math.abs(finalPos1.y - initialPos1.y)).toBeLessThan(0.1);
    expect(Math.abs(finalPos2.x - initialPos2.x)).toBeLessThan(0.1);
    expect(Math.abs(finalPos2.y - initialPos2.y)).toBeLessThan(0.1);
    expect(Math.abs(finalSize1.w - initialSize1.w)).toBeLessThan(0.1);
    expect(Math.abs(finalSize1.h - initialSize1.h)).toBeLessThan(0.1);
  });

  test('blocked when would overlap external piece', () => {
    const { addRectAtCenter } = useSceneStore.getState();

    // 2 pièces sélectionnées + 1 externe proche
    addRectAtCenter(40 as Milli, 60 as Milli); // p1
    addRectAtCenter(40 as Milli, 60 as Milli); // p2
    addRectAtCenter(50 as Milli, 80 as Milli); // p3 (externe, bloque scale up)

    const pieceIds = Object.keys(useSceneStore.getState().scene.pieces) as ID[];
    const [p1Id, p2Id, p3Id] = pieceIds;

    useSceneStore.setState((state: StoreState) => ({
      scene: {
        ...state.scene,
        pieces: {
          ...state.scene.pieces,
          [p1Id]: { ...state.scene.pieces[p1Id], position: { x: 100 as Milli, y: 100 as Milli } },
          [p2Id]: { ...state.scene.pieces[p2Id], position: { x: 150 as Milli, y: 100 as Milli } },
          [p3Id]: { ...state.scene.pieces[p3Id], position: { x: 200 as Milli, y: 100 as Milli } }, // proche de p2
        },
        revision: (state.scene.revision ?? 0) + 1,
      },
      ui: {
        ...state.ui,
        selectedIds: [p1Id, p2Id], // Sélectionner seulement p1+p2
        selectedId: undefined,
      },
    }));

    const initialPos1 = { ...useSceneStore.getState().scene.pieces[p1Id].position };
    const initialSize1 = { ...useSceneStore.getState().scene.pieces[p1Id].size };

    const { startGroupResize, updateGroupResize, endGroupResize } = useSceneStore.getState();

    const pivot = { x: 125, y: 130 };

    // Tenter scale ×2 (devrait causer overlap avec p3)
    startGroupResize('se', { x: pivot.x as Milli, y: pivot.y as Milli });
    const r1 = 50;
    updateGroupResize({ x: (pivot.x + r1 * 2) as Milli, y: (pivot.y + r1 * 2) as Milli });
    endGroupResize(true);

    // Vérifier rollback (positions inchangées)
    const finalPos1 = useSceneStore.getState().scene.pieces[p1Id].position;
    const finalSize1 = useSceneStore.getState().scene.pieces[p1Id].size;

    expect(finalPos1.x).toBe(initialPos1.x);
    expect(finalPos1.y).toBe(initialPos1.y);
    expect(finalSize1.w).toBe(initialSize1.w);
    expect(finalSize1.h).toBe(initialSize1.h);

    // Vérifier flashInvalidAt déclenché
    expect(useSceneStore.getState().ui.flashInvalidAt).toBeGreaterThan(0);
  });

  test('blocked under min size (5mm)', () => {
    const { addRectAtCenter } = useSceneStore.getState();

    addRectAtCenter(10 as Milli, 10 as Milli); // p1 (petite pièce)
    addRectAtCenter(10 as Milli, 10 as Milli); // p2

    const pieceIds = Object.keys(useSceneStore.getState().scene.pieces) as ID[];
    const [p1Id, p2Id] = pieceIds;

    useSceneStore.setState((state: StoreState) => ({
      scene: {
        ...state.scene,
        pieces: {
          ...state.scene.pieces,
          [p1Id]: { ...state.scene.pieces[p1Id], position: { x: 100 as Milli, y: 100 as Milli } },
          [p2Id]: { ...state.scene.pieces[p2Id], position: { x: 120 as Milli, y: 100 as Milli } },
        },
        revision: (state.scene.revision ?? 0) + 1,
      },
      ui: {
        ...state.ui,
        selectedIds: [p1Id, p2Id],
        selectedId: undefined,
      },
    }));

    const initialSize1 = { ...useSceneStore.getState().scene.pieces[p1Id].size };

    const { startGroupResize, updateGroupResize, endGroupResize } = useSceneStore.getState();

    // Calculer le pivot réel (centre de la bbox union)
    const pieces = useSceneStore.getState().scene.pieces;
    const aabbs = [p1Id, p2Id].map(id => {
      const p = pieces[id];
      const r = ((p.rotationDeg ?? 0) % 360 + 360) % 360;
      const w = r === 90 || r === 270 ? p.size.h : p.size.w;
      const h = r === 90 || r === 270 ? p.size.w : p.size.h;
      return { x: p.position.x, y: p.position.y, w, h };
    });
    const minX = Math.min(...aabbs.map(b => b.x));
    const minY = Math.min(...aabbs.map(b => b.y));
    const maxX = Math.max(...aabbs.map(b => b.x + b.w));
    const maxY = Math.max(...aabbs.map(b => b.y + b.h));
    const pivot = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

    // Tenter scale ×0.3 (devrait violer min size 5mm car 10mm × 0.3 = 3mm < 5mm)
    // Utilisons une distance de référence de 50mm
    const startRadius = 50; // mm
    const startPointer = {
      x: (pivot.x + startRadius) as Milli,
      y: pivot.y as Milli,
    };
    startGroupResize('se', startPointer);

    // Pointer cible à 0.3× la distance (scale ×0.3)
    const targetRadius = startRadius * 0.3;
    updateGroupResize({ x: (pivot.x + targetRadius) as Milli, y: pivot.y as Milli });
    endGroupResize(true);

    // Vérifier rollback (taille inchangée)
    const finalSize1 = useSceneStore.getState().scene.pieces[p1Id].size;

    expect(finalSize1.w).toBe(initialSize1.w);
    expect(finalSize1.h).toBe(initialSize1.h);

    // Vérifier flashInvalidAt déclenché
    expect(useSceneStore.getState().ui.flashInvalidAt).toBeGreaterThan(0);
  });
});
