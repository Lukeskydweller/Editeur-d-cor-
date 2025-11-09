import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../../src/state/useSceneStore';

describe('addRectAtCenter respects gating', () => {
  beforeEach(() => {
    const s = useSceneStore.getState();
    s.reset?.();
    s.initSceneWithDefaults(1000, 1000);
  });

  it('bloque si couche active verrouillée (C3)', () => {
    const s = useSceneStore.getState();
    const { C3 } = s.scene.fixedLayerIds!;
    const mat = s.addMaterial({ name: 'Test', oriented: false });
    s.setActiveLayer(C3);
    const before = Object.keys(s.scene.pieces).length;
    s.addRectAtCenter(20, 10);
    const after = Object.keys(useSceneStore.getState().scene.pieces).length;
    expect(after).toBe(before);
    expect(useSceneStore.getState().ui.toast?.message).toMatch(/verrouillée/i);
  });

  it('bloque si couche active verrouillée (C2 sans pièce sur C1)', () => {
    const s = useSceneStore.getState();
    // Start fresh without default piece
    s.reset?.();
    s.initScene(1000, 1000);
    const mat = s.addMaterial({ name: 'Test', oriented: false });
    const { C2 } = s.scene.fixedLayerIds!;
    s.setActiveLayer(C2);
    const before = Object.keys(s.scene.pieces).length;
    s.addRectAtCenter(30, 15);
    const after = Object.keys(useSceneStore.getState().scene.pieces).length;
    // Should not create a new piece (C2 locked because C1 is empty)
    expect(after).toBe(before);
    expect(useSceneStore.getState().ui.toast?.message).toMatch(/verrouillée/i);
  });

  it('crée pièce sur C1 active (toujours déverrouillée)', () => {
    const s = useSceneStore.getState();
    const { C1 } = s.scene.fixedLayerIds!;
    s.setActiveLayer(C1);
    const before = Object.keys(s.scene.pieces).length;
    s.addRectAtCenter(25, 25);
    const after = Object.keys(useSceneStore.getState().scene.pieces).length;
    expect(after).toBe(before + 1);
    // Find the newly created piece
    const allPieces = Object.values(useSceneStore.getState().scene.pieces);
    const newPiece = allPieces.find((p) => p.size.w === 25 && p.size.h === 25);
    expect(newPiece?.layerId).toBe(C1);
  });

  it('crée pièce sur C2 active et déverrouillée', () => {
    const s = useSceneStore.getState();
    const { C1, C2 } = s.scene.fixedLayerIds!;
    const mat = s.addMaterial({ name: 'Test', oriented: false });
    // initSceneWithDefaults already created a default piece on C1, so C2 is unlocked
    // Sélectionner C2 puis créer
    s.setActiveLayer(C2);
    const before = Object.keys(s.scene.pieces).length;
    s.addRectAtCenter(35, 20);
    const after = Object.keys(useSceneStore.getState().scene.pieces).length;
    expect(after).toBe(before + 1);
    // Find the newly created piece
    const allPieces = Object.values(useSceneStore.getState().scene.pieces);
    const newPiece = allPieces.find((p) => p.size.w === 35 && p.size.h === 20);
    expect(newPiece?.layerId).toBe(C2);
  });
});
