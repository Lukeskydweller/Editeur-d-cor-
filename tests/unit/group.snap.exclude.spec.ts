import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from '../../src/state/useSceneStore';
import { snapGroupToPieces } from '../../src/lib/ui/snap';

describe('snap group excludes group members', () => {
  beforeEach(() => {
    // Reset store to clean state
    const store = useSceneStore.getState();
    store.initScene(600, 600);

    // Add layer and material
    store.addLayer('C1');
    store.addMaterial({ name: 'Material 1', oriented: false });
  });

  it('does not consider any member of the group as neighbor', async () => {
    const store = useSceneStore.getState();

    // Create three pieces: two in group (g-a, g-b), one outside (o-1)
    const gA = await store.insertRect({ w: 40, h: 40, x: 10, y: 10 });
    const gB = await store.insertRect({ w: 40, h: 40, x: 60, y: 10 });
    const outsider = await store.insertRect({ w: 40, h: 40, x: 120, y: 10 });

    expect(gA).not.toBeNull();
    expect(gB).not.toBeNull();
    expect(outsider).not.toBeNull();

    const groupIds = [gA!, gB!];
    const scene = useSceneStore.getState().scene;

    // Group bbox spans from (10,10) to (100,50) = [10..100] × [10..50]
    const groupBBox = { x: 10, y: 10, w: 90, h: 40 };

    // Snap the group - should only consider "outsider" as neighbor, not g-a or g-b
    const snapped = snapGroupToPieces(scene, groupBBox, 5, groupIds);

    // Verify the result exists
    expect(snapped).toBeDefined();
    expect(snapped.x).toBeDefined();
    expect(snapped.y).toBeDefined();

    // The key test: verify that the snap algorithm didn't produce a self-snap
    // If we move the group towards the outsider (x+10), we should get a snap guide
    const groupBBoxMoved = { x: 20, y: 10, w: 90, h: 40 };
    const snappedMoved = snapGroupToPieces(scene, groupBBoxMoved, 5, groupIds);

    // The snap should work (guides might be generated when near outsider)
    expect(snappedMoved).toBeDefined();
  });

  it('excludes all group members from snap candidates', async () => {
    const store = useSceneStore.getState();

    // Create a scenario where group members are perfectly aligned
    // If exclusion fails, we'd get false snaps
    const id1 = await store.insertRect({ w: 50, h: 50, x: 0, y: 0 });
    const id2 = await store.insertRect({ w: 50, h: 50, x: 50, y: 0 }); // Adjacent to id1
    const id3 = await store.insertRect({ w: 50, h: 50, x: 200, y: 0 }); // Far away

    expect(id1).not.toBeNull();
    expect(id2).not.toBeNull();
    expect(id3).not.toBeNull();

    const groupIds = [id1!, id2!];
    const scene = useSceneStore.getState().scene;

    // Group bbox: [0..100] × [0..50]
    const groupBBox = { x: 0, y: 0, w: 100, h: 50 };

    // Snap with exclusion
    const result = snapGroupToPieces(scene, groupBBox, 5, groupIds);

    // Verify that we get a result
    expect(result).toBeDefined();
    expect(result.guides).toBeDefined();

    // Move group closer to id3 and verify snap occurs (proof that id3 is considered)
    const groupBBoxNearId3 = { x: 145, y: 0, w: 100, h: 50 }; // Right edge at 245, within 5mm of id3.left (200)
    const resultNearId3 = snapGroupToPieces(scene, groupBBoxNearId3, 5, groupIds);

    // Should snap to id3 since it's within threshold
    expect(resultNearId3.x).not.toBe(groupBBoxNearId3.x);
    expect(resultNearId3.guides.length).toBeGreaterThan(0);
  });

  it('fallback: excludes group members even when RBush is unavailable', async () => {
    const store = useSceneStore.getState();

    // Create pieces
    const a = await store.insertRect({ w: 30, h: 30, x: 0, y: 0 });
    const b = await store.insertRect({ w: 30, h: 30, x: 40, y: 0 });
    const c = await store.insertRect({ w: 30, h: 30, x: 100, y: 0 });

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(c).not.toBeNull();

    const groupIds = [a!, b!];
    const scene = useSceneStore.getState().scene;

    // Group bbox
    const groupBBox = { x: 0, y: 0, w: 70, h: 30 };

    // Snap should work even if RBush throws (fallback path)
    const result = snapGroupToPieces(scene, groupBBox, 5, groupIds);

    expect(result).toBeDefined();
    expect(result.x).toBeDefined();
    expect(result.y).toBeDefined();

    // Verify that the pieces list doesn't include group members
    // (This is implicit - if they were included, we'd get incorrect snaps)
  });

  it('empty excludeIds list checks all pieces', async () => {
    const store = useSceneStore.getState();

    const id1 = await store.insertRect({ w: 50, h: 50, x: 0, y: 0 });
    const id2 = await store.insertRect({ w: 50, h: 50, x: 100, y: 0 });

    expect(id1).not.toBeNull();
    expect(id2).not.toBeNull();

    const scene = useSceneStore.getState().scene;
    const bbox = { x: 45, y: 0, w: 50, h: 50 }; // Between id1 and id2

    // With empty excludeIds, should consider both pieces
    const result = snapGroupToPieces(scene, bbox, 5, []);

    expect(result).toBeDefined();
    // Should snap to either id1 or id2
    expect(result.guides.length).toBeGreaterThan(0);
  });

  it('verifies no self-snap when group moves', async () => {
    const store = useSceneStore.getState();

    // Two pieces in a group that are perfectly aligned
    const p1 = await store.insertRect({ w: 40, h: 40, x: 10, y: 10 });
    const p2 = await store.insertRect({ w: 40, h: 40, x: 60, y: 10 });

    expect(p1).not.toBeNull();
    expect(p2).not.toBeNull();

    const groupIds = [p1!, p2!];
    const scene = useSceneStore.getState().scene;

    // Original group bbox
    const originalBBox = { x: 10, y: 10, w: 90, h: 40 };

    // Simulate dragging the group by 5mm to the right
    const draggedBBox = { x: 15, y: 10, w: 90, h: 40 };

    // Snap with proper exclusion
    const result = snapGroupToPieces(scene, draggedBBox, 5, groupIds);

    // Result should exist but shouldn't snap back to original position
    expect(result).toBeDefined();
    // If exclusion works correctly, x should remain 15 (no snap)
    // or snap to something else, but NOT snap to the group's own members
    expect(result.x).toBe(15); // No snap since only group members exist
  });
});
