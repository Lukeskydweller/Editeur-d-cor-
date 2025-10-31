import '@testing-library/jest-dom';
import { beforeEach, afterEach } from 'vitest';

// Isolation forte des tests : on vide localStorage avant chaque test.
beforeEach(() => {
  try {
    localStorage.clear();
  } catch (_) {
    // jsdom fournit localStorage ; en cas d'environnement exotique, on ignore
  }
});

// (optionnel) Ceinture et bretelles
afterEach(() => {
  try {
    localStorage.clear();
  } catch (_) {}
});
