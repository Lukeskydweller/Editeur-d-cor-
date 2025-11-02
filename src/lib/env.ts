/**
 * Helper pour détection d'environnement et sélection de stratégie de validation.
 */

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export type SupportStrategy = 'PATHOPS' | 'AABB';

/**
 * Détermine la stratégie de validation de support inter-couches.
 *
 * Ordre de priorité:
 * 1. Flag browser: window.__flags.FORCE_SUPPORT_STRATEGY
 * 2. Flag test global: globalThis.__TEST_FORCE_SUPPORT_STRATEGY
 * 3. Défaut: PATHOPS en browser, AABB en Node
 */
export function getSupportStrategy(): SupportStrategy {
  // Browser: honorer le flag explicite
  if (isBrowser() && (window as any).__flags?.FORCE_SUPPORT_STRATEGY) {
    return (window as any).__flags.FORCE_SUPPORT_STRATEGY as SupportStrategy;
  }

  // Test: honorer le flag global (utilisé par Vitest)
  if ((globalThis as any).__TEST_FORCE_SUPPORT_STRATEGY) {
    return (globalThis as any).__TEST_FORCE_SUPPORT_STRATEGY as SupportStrategy;
  }

  // Défaut: PATHOPS en browser (WASM disponible), AABB en Node
  return isBrowser() ? 'PATHOPS' : 'AABB';
}
