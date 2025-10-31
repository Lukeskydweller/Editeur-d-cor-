import { describe, it, expect } from 'vitest';
import { useSceneStore } from './useSceneStore';

describe('useSceneStore', () => {
  it('initSceneWithDefaults creates scene with 1 layer, 1 material, 1 rect piece', () => {
    const { initSceneWithDefaults } = useSceneStore.getState();

    initSceneWithDefaults(600, 600);

    const updatedScene = useSceneStore.getState().scene;

    // Vérifier scène
    expect(updatedScene.size).toEqual({ w: 600, h: 600 });
    expect(updatedScene.layerOrder.length).toBe(1);
    expect(Object.keys(updatedScene.materials).length).toBe(1);
    expect(Object.keys(updatedScene.pieces).length).toBe(1);

    // Récupérer les IDs
    const layerId = updatedScene.layerOrder[0];
    const materialId = Object.keys(updatedScene.materials)[0];
    const pieceId = Object.keys(updatedScene.pieces)[0];

    // Vérifier la pièce
    const piece = updatedScene.pieces[pieceId];
    expect(piece.kind).toBe('rect');
    expect(piece.size).toEqual({ w: 120, h: 80 });
    expect(piece.position).toEqual({ x: 40, y: 40 });
    expect(piece.rotationDeg).toBe(0);

    // Vérifier cohérence croisée
    expect(updatedScene.layers[layerId].pieces).toContain(pieceId);
    expect(piece.layerId).toBe(layerId);
    expect(piece.materialId).toBe(materialId);
  });
});
