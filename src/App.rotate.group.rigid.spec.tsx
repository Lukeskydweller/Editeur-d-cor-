import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, test, expect, describe } from 'vitest';
import App from './App';
import { useSceneStore } from '@/state/useSceneStore';
import type { ID, Milli } from '@/types/scene';

// Extract store state type from Zustand store
type StoreState = ReturnType<typeof useSceneStore.getState>;

describe('Rigid group rotation', () => {
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

  test('group -90° keeps relative layout (rigid rotation)', () => {
    const { addRectAtCenter } = useSceneStore.getState();

    // Créer 3 rectangles espacés formant un motif en "L"
    // p1: (100, 100) 40x60
    // p2: (150, 100) 40x60  (à droite de p1)
    // p3: (100, 170) 40x60  (en dessous de p1)
    addRectAtCenter(40 as Milli, 60 as Milli); // p1
    addRectAtCenter(40 as Milli, 60 as Milli); // p2
    addRectAtCenter(40 as Milli, 60 as Milli); // p3

    const pieceIds = Object.keys(useSceneStore.getState().scene.pieces) as ID[];
    const p1Id = pieceIds[0];
    const p2Id = pieceIds[1];
    const p3Id = pieceIds[2];

    // Positionner en "L"
    useSceneStore.setState((state: StoreState) => ({
      scene: {
        ...state.scene,
        pieces: {
          ...state.scene.pieces,
          [p1Id]: { ...state.scene.pieces[p1Id], position: { x: 100 as Milli, y: 100 as Milli } },
          [p2Id]: { ...state.scene.pieces[p2Id], position: { x: 150 as Milli, y: 100 as Milli } },
          [p3Id]: { ...state.scene.pieces[p3Id], position: { x: 100 as Milli, y: 170 as Milli } },
        },
        revision: (state.scene.revision ?? 0) + 1,
      },
      ui: {
        ...state.ui,
        selectedIds: [p1Id, p2Id, p3Id],
        selectedId: undefined,
      },
    }));

    // Capturer centres et distances avant rotation
    const getPieceCenter = (id: ID) => {
      const p = useSceneStore.getState().scene.pieces[id];
      const bbox = { x: p.position.x, y: p.position.y, w: p.size.w, h: p.size.h };
      return { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 };
    };

    const before = {
      p1: getPieceCenter(p1Id),
      p2: getPieceCenter(p2Id),
      p3: getPieceCenter(p3Id),
    };

    // Distance entre centres (devrait rester identique après rotation rigide)
    const dist12Before = Math.hypot(before.p2.x - before.p1.x, before.p2.y - before.p1.y);
    const dist13Before = Math.hypot(before.p3.x - before.p1.x, before.p3.y - before.p1.y);

    render(<App />);

    const minus90Button = screen.getByRole('button', { name: /Rotate −90°/i });
    const beforeHistory = useSceneStore.getState().ui.history?.past.length ?? 0;

    fireEvent.click(minus90Button);

    // Vérifier que la rotation a été appliquée
    expect(useSceneStore.getState().scene.pieces[p1Id].rotationDeg).toBe(270);
    expect(useSceneStore.getState().scene.pieces[p2Id].rotationDeg).toBe(270);
    expect(useSceneStore.getState().scene.pieces[p3Id].rotationDeg).toBe(270);

    // Vérifier historique
    expect(useSceneStore.getState().ui.history?.past.length ?? 0).toBe(beforeHistory + 1);

    // Vérifier que les distances entre centres sont conservées (rotation rigide)
    const after = {
      p1: getPieceCenter(p1Id),
      p2: getPieceCenter(p2Id),
      p3: getPieceCenter(p3Id),
    };

    const dist12After = Math.hypot(after.p2.x - after.p1.x, after.p2.y - after.p1.y);
    const dist13After = Math.hypot(after.p3.x - after.p1.x, after.p3.y - after.p1.y);

    // Tolérance de 0.1mm pour les erreurs d'arrondi
    expect(Math.abs(dist12After - dist12Before)).toBeLessThan(0.1);
    expect(Math.abs(dist13After - dist13Before)).toBeLessThan(0.1);

    // Conservation des distances au pivot (rigidité)
    const pivot = {
      x: (Math.min(before.p1.x, before.p2.x, before.p3.x) + Math.max(before.p1.x, before.p2.x, before.p3.x)) / 2,
      y: (Math.min(before.p1.y, before.p2.y, before.p3.y) + Math.max(before.p1.y, before.p2.y, before.p3.y)) / 2,
    };

    const distP1ToPivotBefore = Math.hypot(before.p1.x - pivot.x, before.p1.y - pivot.y);
    const distP2ToPivotBefore = Math.hypot(before.p2.x - pivot.x, before.p2.y - pivot.y);
    const distP3ToPivotBefore = Math.hypot(before.p3.x - pivot.x, before.p3.y - pivot.y);

    const pivotAfter = {
      x: (Math.min(after.p1.x, after.p2.x, after.p3.x) + Math.max(after.p1.x, after.p2.x, after.p3.x)) / 2,
      y: (Math.min(after.p1.y, after.p2.y, after.p3.y) + Math.max(after.p1.y, after.p2.y, after.p3.y)) / 2,
    };

    const distP1ToPivotAfter = Math.hypot(after.p1.x - pivotAfter.x, after.p1.y - pivotAfter.y);
    const distP2ToPivotAfter = Math.hypot(after.p2.x - pivotAfter.x, after.p2.y - pivotAfter.y);
    const distP3ToPivotAfter = Math.hypot(after.p3.x - pivotAfter.x, after.p3.y - pivotAfter.y);

    // Chaque pièce garde sa distance au pivot
    expect(Math.abs(distP1ToPivotAfter - distP1ToPivotBefore)).toBeLessThan(0.1);
    expect(Math.abs(distP2ToPivotAfter - distP2ToPivotBefore)).toBeLessThan(0.1);
    expect(Math.abs(distP3ToPivotAfter - distP3ToPivotBefore)).toBeLessThan(0.1);

    // Vérifier qu'il n'y a pas de chevauchement interne (validation passe)
    // Si la rotation était "pièce par pièce" indépendante, il pourrait y avoir overlap
    expect(useSceneStore.getState().ui.flashInvalidAt).toBeUndefined();
  });

  test('group +90° blocked if would overlap external piece', () => {
    const { addRectAtCenter } = useSceneStore.getState();

    // Créer 3 rectangles : 2 dans le groupe, 1 externe
    // Le groupe forme une barre horizontale qui, après +90°, devient verticale
    // et entrerait en collision avec p3 placé stratégiquement
    addRectAtCenter(40 as Milli, 60 as Milli); // p1
    addRectAtCenter(40 as Milli, 60 as Milli); // p2
    addRectAtCenter(50 as Milli, 80 as Milli); // p3

    const pieceIds = Object.keys(useSceneStore.getState().scene.pieces) as ID[];
    const p1Id = pieceIds[0];
    const p2Id = pieceIds[1];
    const p3Id = pieceIds[2];

    // Positionner de sorte que rotation +90° du groupe causerait overlap avec p3
    // Groupe: bbox (100..190, 100..160), pivot ~(145, 130)
    // Après +90°, le groupe s'étend verticalement et overlap p3
    useSceneStore.setState((state: StoreState) => ({
      scene: {
        ...state.scene,
        pieces: {
          ...state.scene.pieces,
          [p1Id]: { ...state.scene.pieces[p1Id], position: { x: 100 as Milli, y: 100 as Milli } },
          [p2Id]: { ...state.scene.pieces[p2Id], position: { x: 150 as Milli, y: 100 as Milli } },
          [p3Id]: { ...state.scene.pieces[p3Id], position: { x: 140 as Milli, y: 170 as Milli } },
        },
        revision: (state.scene.revision ?? 0) + 1,
      },
      ui: {
        ...state.ui,
        selectedIds: [p1Id, p2Id], // Sélectionner seulement p1 et p2
        selectedId: undefined,
      },
    }));

    expect(useSceneStore.getState().scene.pieces[p1Id].rotationDeg).toBe(0);
    expect(useSceneStore.getState().scene.pieces[p2Id].rotationDeg).toBe(0);

    render(<App />);

    const plus90Button = screen.getByRole('button', { name: /Rotate \+90°/i });
    const beforeHistory = useSceneStore.getState().ui.history?.past.length ?? 0;

    fireEvent.click(plus90Button);

    // Vérifier que la rotation a été BLOQUÉE (angles inchangés)
    expect(useSceneStore.getState().scene.pieces[p1Id].rotationDeg).toBe(0);
    expect(useSceneStore.getState().scene.pieces[p2Id].rotationDeg).toBe(0);

    // Vérifier qu'aucun historique n'a été ajouté
    expect(useSceneStore.getState().ui.history?.past.length ?? 0).toBe(beforeHistory);

    // Vérifier que flashInvalidAt a été déclenché
    expect(useSceneStore.getState().ui.flashInvalidAt).toBeGreaterThan(0);
  });

  test('set rotation 90° (absolute) behaves rigid for group', () => {
    const { addRectAtCenter } = useSceneStore.getState();

    // Créer 2 rectangles espacés
    addRectAtCenter(40 as Milli, 60 as Milli); // p1
    addRectAtCenter(40 as Milli, 60 as Milli); // p2

    const pieceIds = Object.keys(useSceneStore.getState().scene.pieces) as ID[];
    const p1Id = pieceIds[0];
    const p2Id = pieceIds[1];

    // Positionner loin de tout pour que rotation soit valide
    useSceneStore.setState((state: StoreState) => ({
      scene: {
        ...state.scene,
        pieces: {
          ...state.scene.pieces,
          [p1Id]: { ...state.scene.pieces[p1Id], position: { x: 200 as Milli, y: 200 as Milli } },
          [p2Id]: { ...state.scene.pieces[p2Id], position: { x: 250 as Milli, y: 200 as Milli } },
        },
        revision: (state.scene.revision ?? 0) + 1,
      },
      ui: {
        ...state.ui,
        selectedIds: [p1Id, p2Id],
        selectedId: undefined,
      },
    }));

    // Capturer centres avant
    const getPieceCenter = (id: ID) => {
      const p = useSceneStore.getState().scene.pieces[id];
      const bbox = { x: p.position.x, y: p.position.y, w: p.size.w, h: p.size.h };
      return { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 };
    };

    const before = {
      p1: getPieceCenter(p1Id),
      p2: getPieceCenter(p2Id),
    };

    const distBefore = Math.hypot(before.p2.x - before.p1.x, before.p2.y - before.p1.y);

    render(<App />);

    const set90Button = screen.getByRole('button', { name: /Rotation 90°/i });
    const beforeHistory = useSceneStore.getState().ui.history?.past.length ?? 0;

    fireEvent.click(set90Button);

    // Vérifier que la rotation a été appliquée
    expect(useSceneStore.getState().scene.pieces[p1Id].rotationDeg).toBe(90);
    expect(useSceneStore.getState().scene.pieces[p2Id].rotationDeg).toBe(90);

    // Vérifier historique
    expect(useSceneStore.getState().ui.history?.past.length ?? 0).toBe(beforeHistory + 1);

    // Vérifier que la distance entre centres est conservée (rotation rigide)
    const after = {
      p1: getPieceCenter(p1Id),
      p2: getPieceCenter(p2Id),
    };

    const distAfter = Math.hypot(after.p2.x - after.p1.x, after.p2.y - after.p1.y);

    // Conservation de la distance entre centres (forme globale)
    expect(Math.abs(distAfter - distBefore)).toBeLessThan(0.1);

    // Conservation des distances au pivot
    const pivot = {
      x: (before.p1.x + before.p2.x) / 2,
      y: (before.p1.y + before.p2.y) / 2,
    };

    const distP1ToPivotBefore = Math.hypot(before.p1.x - pivot.x, before.p1.y - pivot.y);
    const distP2ToPivotBefore = Math.hypot(before.p2.x - pivot.x, before.p2.y - pivot.y);

    const pivotAfter = {
      x: (after.p1.x + after.p2.x) / 2,
      y: (after.p1.y + after.p2.y) / 2,
    };

    const distP1ToPivotAfter = Math.hypot(after.p1.x - pivotAfter.x, after.p1.y - pivotAfter.y);
    const distP2ToPivotAfter = Math.hypot(after.p2.x - pivotAfter.x, after.p2.y - pivotAfter.y);

    expect(Math.abs(distP1ToPivotAfter - distP1ToPivotBefore)).toBeLessThan(0.1);
    expect(Math.abs(distP2ToPivotAfter - distP2ToPivotBefore)).toBeLessThan(0.1);
  });

  test('cycle 4× +90° returns to exact initial positions (rigidity invariant)', () => {
    const { addRectAtCenter } = useSceneStore.getState();

    // Créer un motif avec pièces horizontales et verticales, bord-à-bord
    // p1: 40x60 horizontal
    // p2: 60x40 vertical (90°)
    // p3: 40x60 horizontal
    addRectAtCenter(40 as Milli, 60 as Milli); // p1
    addRectAtCenter(60 as Milli, 40 as Milli); // p2
    addRectAtCenter(40 as Milli, 60 as Milli); // p3

    const pieceIds = Object.keys(useSceneStore.getState().scene.pieces) as ID[];
    const p1Id = pieceIds[0];
    const p2Id = pieceIds[1];
    const p3Id = pieceIds[2];

    // Positionner en motif bord-à-bord
    useSceneStore.setState((state: StoreState) => ({
      scene: {
        ...state.scene,
        pieces: {
          ...state.scene.pieces,
          [p1Id]: {
            ...state.scene.pieces[p1Id],
            position: { x: 200 as Milli, y: 200 as Milli },
            rotationDeg: 0,
          },
          [p2Id]: {
            ...state.scene.pieces[p2Id],
            position: { x: 240 as Milli, y: 200 as Milli },
            rotationDeg: 90,
          },
          [p3Id]: {
            ...state.scene.pieces[p3Id],
            position: { x: 200 as Milli, y: 260 as Milli },
            rotationDeg: 0,
          },
        },
        revision: (state.scene.revision ?? 0) + 1,
      },
      ui: {
        ...state.ui,
        selectedIds: [p1Id, p2Id, p3Id],
        selectedId: undefined,
      },
    }));

    // Capturer positions et rotations initiales
    const initialState = {
      p1: {
        pos: { ...useSceneStore.getState().scene.pieces[p1Id].position },
        rot: useSceneStore.getState().scene.pieces[p1Id].rotationDeg,
      },
      p2: {
        pos: { ...useSceneStore.getState().scene.pieces[p2Id].position },
        rot: useSceneStore.getState().scene.pieces[p2Id].rotationDeg,
      },
      p3: {
        pos: { ...useSceneStore.getState().scene.pieces[p3Id].position },
        rot: useSceneStore.getState().scene.pieces[p3Id].rotationDeg,
      },
    };

    render(<App />);

    const plus90Button = screen.getByRole('button', { name: /Rotate \+90°/i });

    // Appliquer 4× +90° (cycle complet)
    fireEvent.click(plus90Button); // 1st rotation
    fireEvent.click(plus90Button); // 2nd rotation
    fireEvent.click(plus90Button); // 3rd rotation
    fireEvent.click(plus90Button); // 4th rotation (back to 0°/360°)

    // Vérifier que les rotations sont revenues à l'état initial (modulo 360°)
    const finalP1Rot = ((useSceneStore.getState().scene.pieces[p1Id].rotationDeg % 360) + 360) % 360;
    const finalP2Rot = ((useSceneStore.getState().scene.pieces[p2Id].rotationDeg % 360) + 360) % 360;
    const finalP3Rot = ((useSceneStore.getState().scene.pieces[p3Id].rotationDeg % 360) + 360) % 360;

    const expectedP1Rot = ((initialState.p1.rot % 360) + 360) % 360;
    const expectedP2Rot = ((initialState.p2.rot % 360) + 360) % 360;
    const expectedP3Rot = ((initialState.p3.rot % 360) + 360) % 360;

    expect(finalP1Rot).toBe(expectedP1Rot);
    expect(finalP2Rot).toBe(expectedP2Rot);
    expect(finalP3Rot).toBe(expectedP3Rot);

    // Vérifier que les positions sont revenues exactement à l'état initial
    // Tolérance de 0.1mm (EPS_UI_MM) pour les erreurs d'arrondi numériques
    const finalState = {
      p1: useSceneStore.getState().scene.pieces[p1Id].position,
      p2: useSceneStore.getState().scene.pieces[p2Id].position,
      p3: useSceneStore.getState().scene.pieces[p3Id].position,
    };

    expect(Math.abs(finalState.p1.x - initialState.p1.pos.x)).toBeLessThan(0.1);
    expect(Math.abs(finalState.p1.y - initialState.p1.pos.y)).toBeLessThan(0.1);
    expect(Math.abs(finalState.p2.x - initialState.p2.pos.x)).toBeLessThan(0.1);
    expect(Math.abs(finalState.p2.y - initialState.p2.pos.y)).toBeLessThan(0.1);
    expect(Math.abs(finalState.p3.x - initialState.p3.pos.x)).toBeLessThan(0.1);
    expect(Math.abs(finalState.p3.y - initialState.p3.pos.y)).toBeLessThan(0.1);

    // Vérifier qu'aucune validation d'overlap n'a été déclenchée pendant le cycle
    expect(useSceneStore.getState().ui.flashInvalidAt).toBeUndefined();
  });

  test('golden oracle: complex pattern (5-6 pieces mixed 0°/90°) preserves exact geometry', () => {
    const { addRectAtCenter } = useSceneStore.getState();

    // Construire motif complexe type "captures" : 5 pièces en croix + 1 décalée
    // p1: horizontal (40x60, 0°)
    // p2: vertical (30x80, 90°)
    // p3: horizontal (50x40, 0°)
    // p4: vertical (40x70, 90°)
    // p5: horizontal (60x30, 0°)
    addRectAtCenter(40 as Milli, 60 as Milli); // p1
    addRectAtCenter(30 as Milli, 80 as Milli); // p2
    addRectAtCenter(50 as Milli, 40 as Milli); // p3
    addRectAtCenter(40 as Milli, 70 as Milli); // p4
    addRectAtCenter(60 as Milli, 30 as Milli); // p5

    const pieceIds = Object.keys(useSceneStore.getState().scene.pieces) as ID[];
    const [p1Id, p2Id, p3Id, p4Id, p5Id] = pieceIds;

    // Positionner bord-à-bord en motif croix
    useSceneStore.setState((state: StoreState) => ({
      scene: {
        ...state.scene,
        pieces: {
          ...state.scene.pieces,
          [p1Id]: { ...state.scene.pieces[p1Id], position: { x: 150 as Milli, y: 150 as Milli }, rotationDeg: 0 },
          [p2Id]: { ...state.scene.pieces[p2Id], position: { x: 190 as Milli, y: 150 as Milli }, rotationDeg: 90 },
          [p3Id]: { ...state.scene.pieces[p3Id], position: { x: 150 as Milli, y: 210 as Milli }, rotationDeg: 0 },
          [p4Id]: { ...state.scene.pieces[p4Id], position: { x: 200 as Milli, y: 210 as Milli }, rotationDeg: 90 },
          [p5Id]: { ...state.scene.pieces[p5Id], position: { x: 240 as Milli, y: 150 as Milli }, rotationDeg: 0 },
        },
        revision: (state.scene.revision ?? 0) + 1,
      },
      ui: {
        ...state.ui,
        selectedIds: [p1Id, p2Id, p3Id, p4Id, p5Id],
        selectedId: undefined,
      },
    }));

    // Fonction golden indépendante : calcul AABB à partir de intrinsics uniquement
    const goldenBBox = (id: ID) => {
      const p = useSceneStore.getState().scene.pieces[id];
      const { x, y } = p.position;
      const { w: w0, h: h0 } = p.size; // intrinsèques
      const r = ((p.rotationDeg ?? 0) % 360 + 360) % 360;

      if (r === 90 || r === 270) {
        const cx = x + w0 / 2;
        const cy = y + h0 / 2;
        return { x: cx - h0 / 2, y: cy - w0 / 2, w: h0, h: w0 };
      }
      return { x, y, w: w0, h: h0 };
    };

    const goldenCenter = (id: ID) => {
      const b = goldenBBox(id);
      return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    };

    // Calcul pivot golden (centre bbox union)
    const goldenPivot = (ids: ID[]) => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const id of ids) {
        const b = goldenBBox(id);
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.w);
        maxY = Math.max(maxY, b.y + b.h);
      }
      return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    };

    // Rotation +90° d'un point autour d'un pivot
    const rotate90Golden = (p: { x: number; y: number }, pivot: { x: number; y: number }) => {
      const dx = p.x - pivot.x;
      const dy = p.y - pivot.y;
      return { x: pivot.x - dy, y: pivot.y + dx };
    };

    // État initial golden
    const selectedIds = [p1Id, p2Id, p3Id, p4Id, p5Id];
    const pivotBefore = goldenPivot(selectedIds);
    const centersBefore = selectedIds.map((id) => ({ id, ...goldenCenter(id) }));

    // Distances inter-centres avant (échantillon 3 paires)
    const dist12Before = Math.hypot(centersBefore[1].x - centersBefore[0].x, centersBefore[1].y - centersBefore[0].y);
    const dist23Before = Math.hypot(centersBefore[2].x - centersBefore[1].x, centersBefore[2].y - centersBefore[1].y);
    const dist34Before = Math.hypot(centersBefore[3].x - centersBefore[2].x, centersBefore[3].y - centersBefore[2].y);

    // Distances pivot avant
    const distPivotBefore = centersBefore.map((c) => Math.hypot(c.x - pivotBefore.x, c.y - pivotBefore.y));

    // Centres attendus après +90° (golden math)
    const centersExpectedAfter1 = centersBefore.map((c) => ({
      id: c.id,
      ...rotate90Golden({ x: c.x, y: c.y }, pivotBefore),
    }));

    // Capturer état initial AVANT toute rotation pour test cycle complet
    const initialPositions = selectedIds.map((id) => ({
      id,
      pos: { ...useSceneStore.getState().scene.pieces[id].position },
      rot: useSceneStore.getState().scene.pieces[id].rotationDeg,
    }));

    render(<App />);
    const plus90Button = screen.getByRole('button', { name: /Rotate \+90°/i });

    // Appliquer +90° (1ère rotation)
    fireEvent.click(plus90Button);

    // Vérifier centres observés vs attendus (golden)
    const centersAfter1 = selectedIds.map((id) => ({ id, ...goldenCenter(id) }));

    // Debug: Log any significant deviations
    for (let i = 0; i < selectedIds.length; i++) {
      const deltaX = Math.abs(centersAfter1[i].x - centersExpectedAfter1[i].x);
      const deltaY = Math.abs(centersAfter1[i].y - centersExpectedAfter1[i].y);
      if (deltaX > 0.1 || deltaY > 0.1) {
        console.log(`Piece ${i} deviation: deltaX=${deltaX.toFixed(3)}, deltaY=${deltaY.toFixed(3)}`);
        console.log(`  Expected: (${centersExpectedAfter1[i].x.toFixed(2)}, ${centersExpectedAfter1[i].y.toFixed(2)})`);
        console.log(`  Actual:   (${centersAfter1[i].x.toFixed(2)}, ${centersAfter1[i].y.toFixed(2)})`);

        // Log piece details
        const p = useSceneStore.getState().scene.pieces[selectedIds[i]];
        console.log(`  Position: (${p.position.x}, ${p.position.y}), Rot: ${p.rotationDeg}, Size: ${p.size.w}x${p.size.h}`);
      }
      expect(deltaX).toBeLessThan(0.1);
      expect(deltaY).toBeLessThan(0.1);
    }

    // Vérifier invariance forme (distances inter-centres)
    const dist12After = Math.hypot(centersAfter1[1].x - centersAfter1[0].x, centersAfter1[1].y - centersAfter1[0].y);
    const dist23After = Math.hypot(centersAfter1[2].x - centersAfter1[1].x, centersAfter1[2].y - centersAfter1[1].y);
    const dist34After = Math.hypot(centersAfter1[3].x - centersAfter1[2].x, centersAfter1[3].y - centersAfter1[2].y);

    expect(Math.abs(dist12After - dist12Before)).toBeLessThan(0.1);
    expect(Math.abs(dist23After - dist23Before)).toBeLessThan(0.1);
    expect(Math.abs(dist34After - dist34Before)).toBeLessThan(0.1);

    // Vérifier invariance distance pivot
    const pivotAfter1 = goldenPivot(selectedIds);
    const distPivotAfter = centersAfter1.map((c) => Math.hypot(c.x - pivotAfter1.x, c.y - pivotAfter1.y));

    for (let i = 0; i < selectedIds.length; i++) {
      expect(Math.abs(distPivotAfter[i] - distPivotBefore[i])).toBeLessThan(0.1);
    }

    // Appliquer 3 rotations supplémentaires (total 4× +90° depuis l'état initial = cycle complet)
    fireEvent.click(plus90Button); // 2nd
    fireEvent.click(plus90Button); // 3rd
    fireEvent.click(plus90Button); // 4th

    // Vérifier retour exact à l'état initial
    for (let i = 0; i < selectedIds.length; i++) {
      const id = selectedIds[i];
      const final = useSceneStore.getState().scene.pieces[id];
      const initial = initialPositions[i];

      // Rotations modulo 360°
      const finalRot = ((final.rotationDeg % 360) + 360) % 360;
      const expectedRot = ((initial.rot % 360) + 360) % 360;
      expect(finalRot).toBe(expectedRot);

      // Positions exactes
      expect(Math.abs(final.position.x - initial.pos.x)).toBeLessThan(0.1);
      expect(Math.abs(final.position.y - initial.pos.y)).toBeLessThan(0.1);
    }

    // Vérifier aucune validation déclenchée
    expect(useSceneStore.getState().ui.flashInvalidAt).toBeUndefined();
  });
});
