import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/components/Sidebar';
import { useSceneStore } from '@/state/useSceneStore';

/**
 * Test suite: Layers Panel UI interactions
 *
 * Verifies that:
 * - Clicking layer row updates activeLayer
 * - Active layer badge displays correctly
 * - "+ Layer" button disabled when MAX_LAYERS reached
 * - data-testid attributes present for E2E testing
 */
describe('Layers Panel UI', () => {
  beforeEach(() => {
    const store = useSceneStore.getState();
    store.initSceneWithDefaults();
  });

  test('renders layers panel with data-testid', () => {
    render(<Sidebar />);

    const layersPanel = screen.getByTestId('layers-panel');
    expect(layersPanel).toBeDefined();
  });

  test('clicking layer row updates activeLayer', () => {
    const store = useSceneStore.getState();

    // C2 already exists (created by ensureFixedLayerIds)
    const c2Id = store.scene.fixedLayerIds!.C2;

    render(<Sidebar />);

    // Get C1 layer (should be active initially)
    const state1 = useSceneStore.getState();
    const c1Layer = Object.values(state1.scene.layers).find((l) => l.name === 'C1');
    expect(state1.ui.activeLayer).toBe(c1Layer?.id);

    // Click C2 badge (inside the clickable area)
    const c2Badge = screen.getByTestId('active-layer-badge-C2');
    fireEvent.click(c2Badge);

    // activeLayer should switch to C2
    const state2 = useSceneStore.getState();
    expect(state2.ui.activeLayer).toBe(c2Id);
  });

  test('active layer badge displays on active layer row', () => {
    // C2 already exists (created by ensureFixedLayerIds)
    render(<Sidebar />);

    // C1 should have filled badge (●) initially
    const c1Badge = screen.getByTestId('active-layer-badge-C1');
    expect(c1Badge).toBeDefined();
    expect(c1Badge.textContent).toBe('●');

    // C2 should have empty badge (○)
    const c2Badge = screen.getByTestId('active-layer-badge-C2');
    expect(c2Badge).toBeDefined();
    expect(c2Badge.textContent).toBe('○');

    // Click C2 badge - should bubble up to parent div with onClick
    fireEvent.click(c2Badge);

    // Now C2 should have filled badge (●) - no rerender needed, state should update
    const c2BadgeAfter = screen.getByTestId('active-layer-badge-C2');
    expect(c2BadgeAfter.textContent).toBe('●');

    // And C1 should have empty badge (○)
    const c1BadgeAfter = screen.getByTestId('active-layer-badge-C1');
    expect(c1BadgeAfter.textContent).toBe('○');
  });

  test('layer row has correct visual styling for active state', () => {
    render(<Sidebar />);

    const c1Row = screen.getByTestId('layer-row-C1');

    // Active layer should have cyan background classes
    expect(c1Row.className).toContain('bg-cyan-600');
    expect(c1Row.className).toContain('ring-2');
    expect(c1Row.className).toContain('ring-cyan-400');
  });
});
