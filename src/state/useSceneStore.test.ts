import { describe, it, expect } from 'vitest';
import { useSceneStore } from './useSceneStore';

describe('useSceneStore', () => {
  it('initSceneWithDefaults creates scene with 3 fixed layers (C1/C2/C3), 1 material, 1 rect piece', () => {
    const { initSceneWithDefaults } = useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const updatedScene = useSceneStore.getState().scene;

    // Vérifier scène
    expect(updatedScene.size).toEqual({ w: 600, h: 600 });
    expect(updatedScene.layerOrder.length).toBe(3); // C1, C2, C3 are always created
    expect(Object.keys(updatedScene.materials).length).toBe(1);
    expect(Object.keys(updatedScene.pieces).length).toBe(1);

    // Verify fixedLayerIds are set
    expect(updatedScene.fixedLayerIds).toBeDefined();
    expect(updatedScene.fixedLayerIds!.C1).toBeTruthy();
    expect(updatedScene.fixedLayerIds!.C2).toBeTruthy();
    expect(updatedScene.fixedLayerIds!.C3).toBeTruthy();

    // Récupérer les IDs
    const c1Id = updatedScene.fixedLayerIds!.C1; // Use C1 instead of layerOrder[0]
    const materialId = Object.keys(updatedScene.materials)[0];
    const pieceId = Object.keys(updatedScene.pieces)[0];

    // Vérifier la pièce
    const piece = updatedScene.pieces[pieceId];
    expect(piece.kind).toBe('rect');
    expect(piece.size).toEqual({ w: 120, h: 80 });
    expect(piece.position).toEqual({ x: 40, y: 40 });
    expect(piece.rotationDeg).toBe(0);

    // Vérifier cohérence croisée
    expect(updatedScene.layers[c1Id].pieces).toContain(pieceId);
    expect(piece.layerId).toBe(c1Id);
    expect(piece.materialId).toBe(materialId);
  });
});
