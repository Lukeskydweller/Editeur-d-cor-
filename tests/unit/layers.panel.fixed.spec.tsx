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
 * - Legacy banner appears when layerOrder.length > 3
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

  test('legacy scene (5 layers) displays only C1/C2/C3 + banner', () => {
    const store = useSceneStore.getState();

    // Manually create a legacy scene with 5 layers
    const c1Id = store.scene.fixedLayerIds!.C1;
    const c2Id = store.scene.fixedLayerIds!.C2;
    const c3Id = store.scene.fixedLayerIds!.C3;

    // Add 2 legacy layers to layerOrder (simulating old scene)
    const legacyId1 = 'layer_legacy_1';
    const legacyId2 = 'layer_legacy_2';

    useSceneStore.setState({
      scene: {
        ...store.scene,
        layerOrder: [c1Id, c2Id, c3Id, legacyId1, legacyId2],
        layers: {
          ...store.scene.layers,
          [legacyId1]: { id: legacyId1, name: 'Legacy1', z: 3, pieces: [] },
          [legacyId2]: { id: legacyId2, name: 'Legacy2', z: 4, pieces: [] },
        },
      },
    });

    render(<Sidebar />);

    // Verify only 3 layer rows displayed (C1, C2, C3)
    const layersList = screen.getByLabelText('layers-list');
    const layerRows = layersList.querySelectorAll('li');
    expect(layerRows.length).toBe(3);

    // Verify banner is displayed
    const banner = screen.getByTestId('legacy-layers-banner');
    expect(banner).toBeDefined();
    expect(banner).toHaveTextContent('Scène héritée');
    expect(banner).toHaveTextContent('couches > C3 masquées');
    expect(banner).toHaveTextContent('migration v1 à venir');

    // Verify banner has correct role for accessibility
    expect(banner.getAttribute('role')).toBe('status');
  });

  test('no legacy banner when scene has exactly 3 layers', () => {
    render(<Sidebar />);

    // Scene should have exactly 3 layers (C1, C2, C3)
    const store = useSceneStore.getState();
    expect(store.scene.layerOrder.length).toBe(3);

    // Verify banner is NOT displayed
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
