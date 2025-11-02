import '@testing-library/jest-dom';
import { beforeEach, afterEach } from 'vitest';

// Silence console errors for expected async validation warnings
const originalError = console.error;
beforeEach(() => {
  console.error = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    // Suppress act() warnings from async validation (StatusBadge/ProblemsPanel worker updates)
    if (message.includes('An update to') && message.includes('was not wrapped in act')) {
      return;
    }
    originalError.call(console, ...args);
  };

  try {
    localStorage.clear();
  } catch (_) {
    // jsdom fournit localStorage ; en cas d'environnement exotique, on ignore
  }
});

afterEach(() => {
  console.error = originalError;
  try {
    localStorage.clear();
  } catch (_) {}
});
