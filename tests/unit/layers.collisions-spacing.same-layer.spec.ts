import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../../src/state/useSceneStore';
import { validateAll } from '../../src/core/geo/validateAll';
import type { SceneV1, Piece } from '../../src/core/contracts/scene';
import type { SceneDraft } from '../../src/types/scene';

/**
 * Convert SceneDraft to SceneV1 for validation.
 */
function toSceneV1(draft: SceneDraft): SceneV1 {
  const pieces: Piece[] = Object.values(draft.pieces).map((p) => ({
    id: p.id,
    layerId: p.layerId,
    x: p.position.x,
    y: p.position.y,
    w: p.size.w,
    h: p.size.h,
    rot: p.rotation,
    materialId: p.materialId,
    joined: p.joined ?? false,
  }));

  const layers = draft.layerOrder.map((layerId, index) => {
    const layerData = draft.layers[layerId];
    return {
      id: layerId,
      name: layerData?.name ?? `Layer ${index + 1}`,
      index,
    };
  });

  return {
    plateWidth: draft.width,
    plateHeight: draft.height,
    layers,
    pieces,
    materials: Object.values(draft.materials).map((m) => ({
      name: m.id,
      oriented: m.oriented,
    })),
    settings: { minSpacing: 1.5 },
    width: draft.width,
    height: draft.height,
  };
}

describe('collisions and spacing: same-layer only', () => {
  beforeEach(() => {
    const s = useSceneStore.getState();
    s.reset?.();
    s.initSceneWithDefaults(1000, 1000);
  });

  describe('inter-layer overlap allowed', () => {
    it('A∈C1 overlaps B∈C2 → no BLOCK/WARN', async () => {
      const s = useSceneStore.getState();
      const mat = Object.values(s.scene.materials)[0].id;
      const ids = s.scene.fixedLayerIds!;

      // Create piece on C1 at (500, 500, 50×50) - far from default piece
      const p1 = await s.insertRect({ w: 50, h: 50, materialId: mat, layerId: ids.C1 });
      expect(p1).toBeTruthy();

      // Move p1 to specific position
      s.selectPiece(p1!);
      s.movePiece(p1!, 500, 500);

      // Switch to C2 (unlocked because C1 has piece)
      s.setActiveLayer(ids.C2);

      // Create overlapping piece on C2 at (510, 510, 50×50) - overlaps with p1
      const p2 = await s.insertRect({ w: 50, h: 50, materialId: mat, layerId: ids.C2 });
      expect(p2).toBeTruthy();

      // Move p2 to overlap with p1
      s.selectPiece(p2!);
      s.movePiece(p2!, 510, 510);

      // Verify pieces are on different layers and overlap geometrically
      const state = useSceneStore.getState();
      const piece1Final = state.scene.pieces[p1!];
      const piece2Final = state.scene.pieces[p2!];

      expect(piece1Final.layerId).toBe(ids.C1);
      expect(piece2Final.layerId).toBe(ids.C2);

      // Verify AABB overlap (p1: 500-550, p2: 510-560 → overlap 510-550)
      expect(piece1Final.position.x).toBe(500);
      expect(piece2Final.position.x).toBe(510);

      // Validate scene - should have NO overlap problems (inter-layer allowed)
      const sceneV1 = toSceneV1(state.scene);
      const problems = await validateAll(sceneV1);
      const overlapProblems = problems.filter((p) => p.code === 'overlap_same_layer');

      // Filter out any problems with the default piece (not our concern)
      const relevantProblems = overlapProblems.filter(
        (prob) =>
          prob.pieceId === p1 ||
          prob.pieceId === p2 ||
          prob.meta?.otherPieceId === p1 ||
          prob.meta?.otherPieceId === p2,
      );

      expect(relevantProblems).toHaveLength(0);
    });

    it('A∈C2 overlaps B∈C3 → no BLOCK/WARN', async () => {
      const s = useSceneStore.getState();
      const mat = s.addMaterial({ name: 'M', oriented: false });
      const ids = s.scene.fixedLayerIds!;

      // Create piece on C1 to unlock C2
      await s.insertRect({ w: 30, h: 30, materialId: mat, layerId: ids.C1 });

      // Create piece on C2
      s.setActiveLayer(ids.C2);
      const p2 = await s.insertRect({ w: 50, h: 50, materialId: mat, layerId: ids.C2 });
      s.movePiece(p2!, 200, 200);

      // Create piece on C3 (unlocked because C2 has piece)
      s.setActiveLayer(ids.C3);
      const p3 = await s.insertRect({ w: 50, h: 50, materialId: mat, layerId: ids.C3 });
      s.movePiece(p3!, 210, 210);

      const state = useSceneStore.getState();
      const sceneV1 = toSceneV1(state.scene);
      const problems = await validateAll(sceneV1);
      const overlapProblems = problems.filter((p) => p.code === 'overlap_same_layer');

      expect(overlapProblems).toHaveLength(0);
    });
  });

  describe('intra-layer overlap blocked', () => {
    it('A∈C1 overlaps B∈C1 → BLOCK', async () => {
      const s = useSceneStore.getState();
      const mat = s.addMaterial({ name: 'M', oriented: false });
      const ids = s.scene.fixedLayerIds!;

      // Create two pieces on C1
      const p1 = await s.insertRect({ w: 50, h: 50, materialId: mat, layerId: ids.C1 });
      s.movePiece(p1!, 100, 100);

      const p2 = await s.insertRect({ w: 50, h: 50, materialId: mat, layerId: ids.C1 });
      s.movePiece(p2!, 110, 110); // Overlaps with p1

      const state = useSceneStore.getState();
      const sceneV1 = toSceneV1(state.scene);
      const problems = await validateAll(sceneV1);
      const overlapProblems = problems.filter((p) => p.code === 'overlap_same_layer');

      expect(overlapProblems.length).toBeGreaterThan(0);
      expect(overlapProblems[0].severity).toBe('BLOCK');
    });

    it('A∈C2 overlaps B∈C2 → BLOCK', async () => {
      const s = useSceneStore.getState();
      const mat = s.addMaterial({ name: 'M', oriented: false });
      const ids = s.scene.fixedLayerIds!;

      // Unlock C2
      await s.insertRect({ w: 30, h: 30, materialId: mat, layerId: ids.C1 });

      // Create two overlapping pieces on C2
      s.setActiveLayer(ids.C2);
      const p1 = await s.insertRect({ w: 50, h: 50, materialId: mat, layerId: ids.C2 });
      s.movePiece(p1!, 300, 300);

      const p2 = await s.insertRect({ w: 50, h: 50, materialId: mat, layerId: ids.C2 });
      s.movePiece(p2!, 310, 310); // Overlaps with p1

      const state = useSceneStore.getState();
      const sceneV1 = toSceneV1(state.scene);
      const problems = await validateAll(sceneV1);
      const overlapProblems = problems.filter((p) => p.code === 'overlap_same_layer');

      expect(overlapProblems.length).toBeGreaterThan(0);
      expect(overlapProblems[0].severity).toBe('BLOCK');
    });
  });

  describe('spacing: intra-layer only', () => {
    it('A∈C1 close to B∈C2 → no spacing WARN/BLOCK', async () => {
      const s = useSceneStore.getState();
      const mat = s.addMaterial({ name: 'M', oriented: false });
      const ids = s.scene.fixedLayerIds!;

      // Create piece on C1
      const p1 = await s.insertRect({ w: 50, h: 50, materialId: mat, layerId: ids.C1 });
      s.movePiece(p1!, 100, 100);

      // Create piece on C2 very close (0.5mm gap - would trigger BLOCK if same layer)
      s.setActiveLayer(ids.C2);
      const p2 = await s.insertRect({ w: 50, h: 50, materialId: mat, layerId: ids.C2 });
      s.movePiece(p2!, 150.5, 100); // 0.5mm gap from p1

      const state = useSceneStore.getState();
      const sceneV1 = toSceneV1(state.scene);
      const problems = await validateAll(sceneV1);
      const spacingProblems = problems.filter((p) => p.code === 'spacing_too_small');

      // Should have NO spacing problems (different layers)
      expect(spacingProblems).toHaveLength(0);
    });

    it('A∈C1 close to B∈C1 (gap < 1.0mm) → BLOCK', async () => {
      const s = useSceneStore.getState();
      const mat = s.addMaterial({ name: 'M', oriented: false });
      const ids = s.scene.fixedLayerIds!;

      // Create two pieces on C1 with small gap
      const p1 = await s.insertRect({ w: 50, h: 50, materialId: mat, layerId: ids.C1 });
      s.movePiece(p1!, 100, 100);

      const p2 = await s.insertRect({ w: 50, h: 50, materialId: mat, layerId: ids.C1 });
      s.movePiece(p2!, 150.5, 100); // 0.5mm gap - should BLOCK

      const state = useSceneStore.getState();
      const sceneV1 = toSceneV1(state.scene);
      const problems = await validateAll(sceneV1);
      const spacingProblems = problems.filter((p) => p.code === 'spacing_too_small');

      expect(spacingProblems.length).toBeGreaterThan(0);
      expect(spacingProblems[0].severity).toBe('BLOCK');
      expect(spacingProblems[0].meta?.distance).toBeLessThan(1.0);
    });

    it('A∈C2 close to B∈C2 (gap 1.2mm) → WARN', async () => {
      const s = useSceneStore.getState();
      const mat = s.addMaterial({ name: 'M', oriented: false });
      const ids = s.scene.fixedLayerIds!;

      // Unlock C2
      await s.insertRect({ w: 30, h: 30, materialId: mat, layerId: ids.C1 });

      // Create two pieces on C2 with gap in WARN range (1.0-1.5mm)
      s.setActiveLayer(ids.C2);
      const p1 = await s.insertRect({ w: 50, h: 50, materialId: mat, layerId: ids.C2 });
      s.movePiece(p1!, 300, 300);

      const p2 = await s.insertRect({ w: 50, h: 50, materialId: mat, layerId: ids.C2 });
      s.movePiece(p2!, 351.2, 300); // 1.2mm gap - should WARN

      const state = useSceneStore.getState();
      const sceneV1 = toSceneV1(state.scene);
      const problems = await validateAll(sceneV1);
      const spacingProblems = problems.filter((p) => p.code === 'spacing_too_small');

      expect(spacingProblems.length).toBeGreaterThan(0);
      expect(spacingProblems[0].severity).toBe('WARN');
      expect(spacingProblems[0].meta?.distance).toBeGreaterThanOrEqual(1.0);
      expect(spacingProblems[0].meta?.distance).toBeLessThan(1.5);
    });

    it('A∈C1 close to B∈C1 (gap ≥1.5mm) → no WARN', async () => {
      const s = useSceneStore.getState();
      const mat = s.addMaterial({ name: 'M', oriented: false });
      const ids = s.scene.fixedLayerIds!;

      // Create two pieces on C1 with sufficient gap
      const p1 = await s.insertRect({ w: 50, h: 50, materialId: mat, layerId: ids.C1 });
      s.movePiece(p1!, 100, 100);

      const p2 = await s.insertRect({ w: 50, h: 50, materialId: mat, layerId: ids.C1 });
      s.movePiece(p2!, 151.5, 100); // 1.5mm gap - should be OK

      const state = useSceneStore.getState();
      const sceneV1 = toSceneV1(state.scene);
      const problems = await validateAll(sceneV1);
      const spacingProblems = problems.filter((p) => p.code === 'spacing_too_small');

      expect(spacingProblems).toHaveLength(0);
    });
  });
});
