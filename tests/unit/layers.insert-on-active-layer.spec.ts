import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../../src/state/useSceneStore';
import type { SceneStoreState } from '../../src/state/useSceneStore';

describe('insert routes to active layer with gating', () => {
  beforeEach(() => {
    const s = useSceneStore.getState() as SceneStoreState;
    s.reset?.();
    s.initSceneWithDefaults(1000, 1000);
  });

  it('C1 active → insertRect sans layerId va sur C1', async () => {
    const store = useSceneStore.getState();
    const ids = store.scene.fixedLayerIds!;
    store.setActiveLayer(ids.C1);
    const mat = store.addMaterial({ name: 'Test', oriented: false });
    const created = await store.insertRect({ w: 40, h: 20, materialId: mat });
    expect(created).toBeTruthy();
    const p = useSceneStore.getState().scene.pieces[created!];
    expect(p.layerId).toBe(ids.C1);
  });

  it('C2 active et déverrouillée → insertRect va sur C2', async () => {
    const store = useSceneStore.getState();
    const ids = store.scene.fixedLayerIds!;
    const mat = store.addMaterial({ name: 'Test', oriented: false });
    // déverrouiller C2
    store.setActiveLayer(ids.C1);
    await store.insertRect({ w: 10, h: 10, materialId: mat });
    // sélectionner C2 puis insérer
    store.setActiveLayer(ids.C2);
    const created = await store.insertRect({ w: 12, h: 12, materialId: mat });
    const p = useSceneStore.getState().scene.pieces[created!];
    expect(p.layerId).toBe(ids.C2);
  });

  it('C3 active mais verrouillée → toast + aucune création', async () => {
    const store = useSceneStore.getState();
    const ids = store.scene.fixedLayerIds!;
    const mat = store.addMaterial({ name: 'Test', oriented: false });
    store.setActiveLayer(ids.C3); // C3 verrouillée au départ
    const before = Object.keys(store.scene.pieces).length;
    const created = await store.insertRect({ w: 10, h: 10, materialId: mat });
    const after = Object.keys(useSceneStore.getState().scene.pieces).length;
    expect(created).toBeNull();
    expect(after).toBe(before);
    const toast = useSceneStore.getState().ui.toast;
    expect(toast?.message).toMatch(/verrouillée/i);
  });

  it('C3 active et déverrouillée → insertRect va sur C3', async () => {
    const store = useSceneStore.getState();
    const ids = store.scene.fixedLayerIds!;
    const mat = store.addMaterial({ name: 'Test', oriented: false });
    // déverrouiller C2 puis C3
    store.setActiveLayer(ids.C1);
    await store.insertRect({ w: 10, h: 10, materialId: mat });
    store.setActiveLayer(ids.C2);
    await store.insertRect({ w: 10, h: 10, materialId: mat });
    // sélectionner C3 puis insérer
    store.setActiveLayer(ids.C3);
    const created = await store.insertRect({ w: 15, h: 15, materialId: mat });
    const p = useSceneStore.getState().scene.pieces[created!];
    expect(p.layerId).toBe(ids.C3);
  });

  it('startGhostInsert respects active layer (C2)', async () => {
    const store = useSceneStore.getState();
    const ids = store.scene.fixedLayerIds!;
    const mat = store.addMaterial({ name: 'Test', oriented: false });
    // déverrouiller C2
    store.setActiveLayer(ids.C1);
    await store.insertRect({ w: 10, h: 10, materialId: mat });
    // sélectionner C2 puis ghost insert
    store.setActiveLayer(ids.C2);
    const ghostId = await store.startGhostInsert({ w: 20, h: 20, materialId: mat });
    expect(ghostId).toBeTruthy();
    const p = useSceneStore.getState().scene.pieces[ghostId];
    expect(p?.layerId).toBe(ids.C2);
  });

  it('startGhostInsert blocked on locked layer', async () => {
    const store = useSceneStore.getState();
    const ids = store.scene.fixedLayerIds!;
    const mat = store.addMaterial({ name: 'Test', oriented: false });
    store.setActiveLayer(ids.C3); // C3 verrouillée
    const before = Object.keys(store.scene.pieces).length;
    const ghostId = await store.startGhostInsert({ w: 20, h: 20, materialId: mat });
    const after = Object.keys(useSceneStore.getState().scene.pieces).length;
    expect(ghostId).toBe(''); // Empty ID when blocked
    expect(after).toBe(before);
    const toast = useSceneStore.getState().ui.toast;
    expect(toast?.message).toMatch(/verrouillée/i);
  });
});
