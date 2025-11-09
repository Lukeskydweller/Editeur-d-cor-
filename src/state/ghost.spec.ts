import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeCommittedGhostState } from './ghost';

describe('computeCommittedGhostState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Freshness checks', () => {
    it('returns not ghost when results are undefined', () => {
      const result = computeCommittedGhostState(undefined, Date.now(), 'piece-1');

      expect(result).toEqual({ isGhost: false, severity: 'none' });
    });

    it('returns not ghost when lastExactCheckAt is undefined', () => {
      const exactSupportResults = { 'piece-1': false };

      const result = computeCommittedGhostState(exactSupportResults, undefined, 'piece-1');

      expect(result).toEqual({ isGhost: false, severity: 'none' });
    });

    it('returns not ghost when results are stale (> freshnessMs)', () => {
      const exactSupportResults = { 'piece-1': false };
      const staleTimestamp = Date.now() - 6000; // 6 seconds ago (default freshness is 5s)

      const result = computeCommittedGhostState(exactSupportResults, staleTimestamp, 'piece-1');

      expect(result).toEqual({ isGhost: false, severity: 'none' });
    });

    it('uses custom freshness window', () => {
      const exactSupportResults = { 'piece-1': false };
      const timestamp = Date.now() - 8000; // 8 seconds ago

      // With default 5s freshness: stale
      const resultDefault = computeCommittedGhostState(
        exactSupportResults,
        timestamp,
        'piece-1',
        5000,
      );
      expect(resultDefault.isGhost).toBe(false);

      // With 10s freshness: fresh
      const resultCustom = computeCommittedGhostState(
        exactSupportResults,
        timestamp,
        'piece-1',
        10000,
      );
      expect(resultCustom.isGhost).toBe(true);
    });
  });

  describe('Support status checks', () => {
    it('returns not ghost when piece is not in exact results (not checked yet)', () => {
      const exactSupportResults = { 'piece-other': false };
      const timestamp = Date.now();

      const result = computeCommittedGhostState(exactSupportResults, timestamp, 'piece-1');

      expect(result).toEqual({ isGhost: false, severity: 'none' });
    });

    it('returns not ghost when piece is fully supported', () => {
      const exactSupportResults = { 'piece-1': true };
      const timestamp = Date.now();

      const result = computeCommittedGhostState(exactSupportResults, timestamp, 'piece-1');

      expect(result).toEqual({ isGhost: false, severity: 'none' });
    });

    it('returns ghost with warn severity when piece is NOT supported', () => {
      const exactSupportResults = { 'piece-1': false };
      const timestamp = Date.now();

      const result = computeCommittedGhostState(exactSupportResults, timestamp, 'piece-1');

      expect(result).toEqual({ isGhost: true, severity: 'warn' });
    });
  });

  describe('Edge cases', () => {
    it('handles empty exactSupportResults', () => {
      const exactSupportResults = {};
      const timestamp = Date.now();

      const result = computeCommittedGhostState(exactSupportResults, timestamp, 'piece-1');

      expect(result).toEqual({ isGhost: false, severity: 'none' });
    });

    it('handles exactly at freshness boundary', () => {
      const exactSupportResults = { 'piece-1': false };
      const timestamp = Date.now() - 5000; // Exactly 5s ago

      const result = computeCommittedGhostState(exactSupportResults, timestamp, 'piece-1');

      // Should be fresh (< 5000ms, not <=)
      expect(result.isGhost).toBe(false);
    });

    it('handles timestamp just before freshness boundary', () => {
      const exactSupportResults = { 'piece-1': false };
      const timestamp = Date.now() - 4999; // Just under 5s

      const result = computeCommittedGhostState(exactSupportResults, timestamp, 'piece-1');

      expect(result.isGhost).toBe(true);
      expect(result.severity).toBe('warn');
    });
  });

  describe('Multiple pieces', () => {
    it('returns correct ghost state for each piece independently', () => {
      const exactSupportResults = {
        'piece-1': false, // Unsupported
        'piece-2': true, // Supported
        'piece-3': false, // Unsupported
      };
      const timestamp = Date.now();

      const result1 = computeCommittedGhostState(exactSupportResults, timestamp, 'piece-1');
      const result2 = computeCommittedGhostState(exactSupportResults, timestamp, 'piece-2');
      const result3 = computeCommittedGhostState(exactSupportResults, timestamp, 'piece-3');
      const result4 = computeCommittedGhostState(exactSupportResults, timestamp, 'piece-4');

      expect(result1).toEqual({ isGhost: true, severity: 'warn' });
      expect(result2).toEqual({ isGhost: false, severity: 'none' });
      expect(result3).toEqual({ isGhost: true, severity: 'warn' });
      expect(result4).toEqual({ isGhost: false, severity: 'none' }); // Not checked yet
    });
  });
});
