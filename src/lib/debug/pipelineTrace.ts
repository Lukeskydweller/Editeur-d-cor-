/**
 * Système de traçage du pipeline de drag/nudge/resize (dev only)
 */

import type { BBox } from '@/types/scene';

/**
 * Source de l'opération
 */
export type PipelineSource = 'keyboard' | 'mouse' | 'resize';

/**
 * Type de snap appliqué
 */
export type SnapType = 'guides' | 'grid10mm' | 'edgeCollage' | 'none';

/**
 * Trace d'un appel à snapEdgeCollage
 */
export interface SnapEdgeCollageTrace {
  called: boolean;
  beforeGapPx: number | null;
  afterGapPx: number | null;
  didSnap: boolean;
  dx: number;
  dy: number;
}

/**
 * Trace d'un appel à finalizeCollageGuard
 */
export interface FinalizeCollageGuardTrace {
  called: boolean;
  beforeGapPx: number | null;
  afterGapPx: number | null;
  didSnap: boolean;
  dx: number;
  dy: number;
  blockedByOverlap: boolean;
}

/**
 * Trace de validation
 */
export interface ValidationTrace {
  overlap: boolean;
  outOfBounds: boolean;
  minSpacingWarn: boolean;
  hasBlockingProblems: boolean;
}

/**
 * Entrée de trace complète pour un tick du pipeline
 */
export interface PipelineTraceEntry {
  tickId: number;
  timestamp: number;
  source: PipelineSource;

  // État avant
  preClampBBox: BBox;
  postClampBBox: BBox;

  // Snaps appliqués
  snapsApplied: Array<{ type: SnapType; dx: number; dy: number }>;
  snapGuides: boolean;
  snapGrid10mm: boolean;

  // Collage
  snapEdgeCollage: SnapEdgeCollageTrace;
  finalizeCollageGuard: FinalizeCollageGuardTrace;

  // Index spatial
  spatialIndexUpdated: boolean;

  // Validation
  validation: ValidationTrace;

  // Résultat final
  committed: boolean;
  rolledBack: boolean;
  finalBBox: BBox;
  finalGapPx: number | null;
  finalGapMm: number | null;
}

/**
 * Buffer FIFO de traces (limité à 50 entrées)
 */
const MAX_TRACES = 50;
let traces: PipelineTraceEntry[] = [];
let tickCounter = 0;

/**
 * Flag debug actif (lu depuis env)
 */
export const DEBUG_ENABLED = import.meta.env.DEV && import.meta.env.VITE_DEBUG_NUDGE_GAP === 'true';

/**
 * Ajoute une trace au buffer (dev only)
 */
export function addTrace(entry: PipelineTraceEntry): void {
  if (!DEBUG_ENABLED) return;

  traces.push(entry);
  if (traces.length > MAX_TRACES) {
    traces.shift(); // Remove oldest
  }

  // Exposer dans window pour inspection console
  if (typeof window !== 'undefined') {
    (window as any).__debugGap = traces;
  }
}

/**
 * Génère un nouvel ID de tick
 */
export function nextTickId(): number {
  return ++tickCounter;
}

/**
 * Récupère toutes les traces (pour panneau debug)
 */
export function getAllTraces(): readonly PipelineTraceEntry[] {
  return traces;
}

/**
 * Récupère les N dernières traces
 */
export function getRecentTraces(count: number = 10): readonly PipelineTraceEntry[] {
  return traces.slice(-count);
}

/**
 * Efface toutes les traces
 */
export function clearTraces(): void {
  traces = [];
  tickCounter = 0;
  if (typeof window !== 'undefined') {
    (window as any).__debugGap = [];
  }
}

/**
 * Helper : créer une trace vide (à remplir progressivement)
 */
export function createEmptyTrace(source: PipelineSource, bbox: BBox): PipelineTraceEntry {
  return {
    tickId: nextTickId(),
    timestamp: Date.now(),
    source,
    preClampBBox: bbox,
    postClampBBox: bbox,
    snapsApplied: [],
    snapGuides: false,
    snapGrid10mm: false,
    snapEdgeCollage: {
      called: false,
      beforeGapPx: null,
      afterGapPx: null,
      didSnap: false,
      dx: 0,
      dy: 0,
    },
    finalizeCollageGuard: {
      called: false,
      beforeGapPx: null,
      afterGapPx: null,
      didSnap: false,
      dx: 0,
      dy: 0,
      blockedByOverlap: false,
    },
    spatialIndexUpdated: false,
    validation: {
      overlap: false,
      outOfBounds: false,
      minSpacingWarn: false,
      hasBlockingProblems: false,
    },
    committed: false,
    rolledBack: false,
    finalBBox: bbox,
    finalGapPx: null,
    finalGapMm: null,
  };
}