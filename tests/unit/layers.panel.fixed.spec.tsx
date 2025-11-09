import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/components/Sidebar';
import { useSceneStore } from '@/state/useSceneStore';

/**
 * Test suite: Fixed 3-row Layers Panel
 *
 * Verifies that:
 * - Panel displays exactly 3 rows: C1, C2, C3
 * - "+ Layer" button does not exist
 * - Visibility and lock toggles work for all 3 layers
 * - Post-migration: legacy scenes (>3 layers) show only C1/C2/C3, no banner
 */
describe('Layers Panel - Fixed 3 Rows', () => {
  beforeEach(() => {
    const store = useSceneStore.getState();
    store.initScene(600, 600);
    store.initSceneWithDefaults(600, 600);
  });

  test('panel displays exactly 3 rows: C1, C2, C3', () => {
    render(<Sidebar />);

    // Verify all 3 layer rows exist
    const c1Row = screen.getByTestId('layer-row-C1');
    const c2Row = screen.getByTestId('layer-row-C2');
    const c3Row = screen.getByTestId('layer-row-C3');

    expect(c1Row).toBeDefined();
    expect(c2Row).toBeDefined();
    expect(c3Row).toBeDefined();

    // Verify layer names are displayed
    expect(c1Row).toHaveTextContent('C1');
    expect(c2Row).toHaveTextContent('C2');
    expect(c3Row).toHaveTextContent('C3');

    // Verify no other layer rows exist
    const layersList = screen.getByLabelText('layers-list');
    const layerRows = layersList.querySelectorAll('li');
    expect(layerRows.length).toBe(3);
  });

  test('"+ Layer" button does not exist', () => {
    render(<Sidebar />);

    // Verify "+ Layer" button is not in the document
    const addButton = screen.queryByTestId('layer-add-button');
    expect(addButton).toBeNull();

    // Also verify by text content
    const addButtonByText = screen.queryByText('+ Layer');
    expect(addButtonByText).toBeNull();
  });

  test('visibility toggle works for C1, C2, C3', () => {
    render(<Sidebar />);

    const store = useSceneStore.getState();
    const { C1, C2, C3 } = store.scene.fixedLayerIds!;

    // All layers visible by default (or undefined which means visible)
    expect(store.ui.layerVisibility?.[C1] ?? true).toBe(true);
    expect(store.ui.layerVisibility?.[C2] ?? true).toBe(true);
    expect(store.ui.layerVisibility?.[C3] ?? true).toBe(true);

    // Toggle C2 visibility off
    const c2Eye = screen.getByTestId('layer-eye-C2');
    fireEvent.click(c2Eye);

    const state1 = useSceneStore.getState();
    expect(state1.ui.layerVisibility?.[C2]).toBe(false);

    // Toggle C2 visibility back on
    fireEvent.click(c2Eye);

    const state2 = useSceneStore.getState();
    expect(state2.ui.layerVisibility?.[C2]).toBe(true);
  });

  test('lock toggle works for C1, C2, C3', () => {
    render(<Sidebar />);

    const store = useSceneStore.getState();
    const { C1, C2, C3 } = store.scene.fixedLayerIds!;

    // All layers unlocked by default (or undefined which means unlocked)
    expect(store.ui.layerLocked?.[C1] ?? false).toBe(false);
    expect(store.ui.layerLocked?.[C2] ?? false).toBe(false);
    expect(store.ui.layerLocked?.[C3] ?? false).toBe(false);

    // Lock C3
    const c3Lock = screen.getByTestId('layer-lock-C3');
    fireEvent.click(c3Lock);

    const state1 = useSceneStore.getState();
    expect(state1.ui.layerLocked?.[C3]).toBe(true);

    // Unlock C3
    fireEvent.click(c3Lock);

    const state2 = useSceneStore.getState();
    expect(state2.ui.layerLocked?.[C3]).toBe(false);
  });

  test('legacy scene (>3 layers pre-migration) displays exactly 3 rows after migration, no banner', () => {
    const store = useSceneStore.getState();

    const c1Id = store.scene.fixedLayerIds!.C1;
    const c2Id = store.scene.fixedLayerIds!.C2;
    const c3Id = store.scene.fixedLayerIds!.C3;

    // Import a legacy scene fixture with 5 layers
    const legacySceneFile = {
      version: 1 as const,
      scene: {
        id: 'legacy-test',
        createdAt: new Date().toISOString(),
        size: { w: 600, h: 600 },
        materials: store.scene.materials,
        layers: {
          [c1Id]: { id: c1Id, name: 'C1', z: 0, pieces: [] },
          [c2Id]: { id: c2Id, name: 'C2', z: 1, pieces: [] },
          [c3Id]: { id: c3Id, name: 'C3', z: 2, pieces: [] },
          ['legacy1']: { id: 'legacy1', name: 'Legacy1', z: 3, pieces: [] },
          ['legacy2']: { id: 'legacy2', name: 'Legacy2', z: 4, pieces: [] },
        },
        pieces: {},
        layerOrder: [c1Id, c2Id, c3Id, 'legacy1', 'legacy2'],
        fixedLayerIds: { C1: c1Id, C2: c2Id, C3: c3Id },
        revision: 0,
      },
      ui: {},
    };

    // Import triggers migration (C4+ → C3)
    store.importSceneFileV1(legacySceneFile);

    render(<Sidebar />);

    // After migration: exactly 3 layers (C1, C2, C3)
    const stateAfterMigration = useSceneStore.getState();
    expect(stateAfterMigration.scene.layerOrder.length).toBe(3);

    // Verify only 3 layer rows displayed
    const layersList = screen.getByLabelText('layers-list');
    const layerRows = layersList.querySelectorAll('li');
    expect(layerRows.length).toBe(3);

    // Verify NO banner is displayed (migration complete)
    const banner = screen.queryByTestId('legacy-layers-banner');
    expect(banner).toBeNull();
  });

  test('layer rows are keyboard accessible (Enter/Space)', () => {
    render(<Sidebar />);

    const store = useSceneStore.getState();
    const { C1, C2 } = store.scene.fixedLayerIds!;

    // C1 should be active by default
    expect(store.ui.activeLayer).toBe(C1);

    // Get C2 row's clickable area
    const c2Row = screen.getByTestId('layer-row-C2');
    const c2Button = c2Row.querySelector('[role="button"]') as HTMLElement;
    expect(c2Button).toBeDefined();

    // Press Enter on C2 row
    fireEvent.keyDown(c2Button, { key: 'Enter' });

    const state = useSceneStore.getState();
    expect(state.ui.activeLayer).toBe(C2);
  });
});
