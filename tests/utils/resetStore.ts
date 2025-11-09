import { beforeEach } from 'vitest';
import { useSceneStore } from '../../src/state/useSceneStore';

/**
 * Reset Zustand store between tests to prevent state leakage.
 * Recommended practice: https://docs.pmnd.rs/zustand/guides/testing
 */
export function setupStoreReset() {
  beforeEach(() => {
    // Clear localStorage to prevent autosave restoration
    localStorage.clear();

    // Reset store state
    const store = useSceneStore.getState();
    store.reset?.();

    // Initialize with clean defaults
    store.initSceneWithDefaults(1000, 1000);
  });
}
