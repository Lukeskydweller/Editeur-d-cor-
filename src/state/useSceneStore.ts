import { create } from 'zustand';
import { produce } from 'immer';
import type { SceneDraft, ID, Layer, Piece, Milli, Deg, MaterialRef } from '@/types/scene';
import { validateNoOverlap, validateNoOverlapForCandidate as validateNoOverlapForCandidateDraft, validateInsideScene } from '@/lib/sceneRules';
import { snapToPieces, snapGroupToPieces, snapEdgeCollage, computeMinGap, finalizeCollageGuard, normalizeGapToThreshold, MM_TO_PX, type SnapGuide } from '@/lib/ui/snap';
import { MIN_GAP_MM, SNAP_EDGE_THRESHOLD_MM, NORMALIZE_GAP_TARGET_MM, EPSILON_GAP_NORMALIZE_MM, ENABLE_GAP_NORMALIZATION } from '@/constants/validation';
import { isSceneFileV1, normalizeSceneFileV1, type SceneFileV1 } from '@/lib/io/schema';
import type { Problem } from '@/core/contracts/scene';
import {
  listDrafts,
  saveDraft,
  loadDraft,
  deleteDraft as deleteDraftFromStorage,
  upsertDraftName,
  newDraftName,
  type DraftMeta,
} from '@/lib/drafts';
import { applyHandle, applyHandleWithRotation, type ResizeHandle } from '@/lib/ui/resize';
import { pieceBBox, aabbToPiecePosition } from '@/lib/geom';
import { clampAABBToScene } from '@/lib/geom/aabb';
import { syncPieceToIndex, removePieceFromIndex } from '@/lib/spatial/globalIndex';
import { validateOverlapsAsync } from '@/core/geo/facade';
import { projectDraftToV1 } from '@/sync/projector';
import { incResizeBlockPreview, incResizeBlockCommitBlocked, incResizeBlockCommitSuccess } from '@/lib/metrics';
import { collisionsForCandidate, spacingForCandidate, validateNoOverlapForCandidate, type ResizeContext } from '@/core/geo/validateAll';
import { getRotatedAABB } from '@/core/geo/geometry';
import { EPS_UI_MM, EMPTY_ARR } from '@/state/constants';

// Helper to notify auto-spatial module after structural mutations
function notifyAutoSpatial() {
  const evalFn = (window as any).__evaluateAutoSpatial;
  if (evalFn) evalFn();
}

// ─────────────────────────────────────────────────────────────────────────
// RAF scheduler for smooth group resize updates (throttle pointermove)
// ─────────────────────────────────────────────────────────────────────────

type RafJob = {
  pending?: boolean;
  rafId?: number;
  lastArgs?: { pointer: {x: Milli; y: Milli}; altKey: boolean }
};
const rafGroupResize: RafJob = {};

function scheduleGroupResize(
  fn: (args: {pointer: {x: Milli; y: Milli}; altKey: boolean}) => void,
  args: {pointer: {x: Milli; y: Milli}; altKey: boolean}
) {
  rafGroupResize.lastArgs = args;
  if (rafGroupResize.pending) return;
  rafGroupResize.pending = true;
  rafGroupResize.rafId = requestAnimationFrame(() => {
    rafGroupResize.pending = false;
    rafGroupResize.rafId = undefined;
    if (rafGroupResize.lastArgs) fn(rafGroupResize.lastArgs);
  });
}

function cancelGroupResizeRaf() {
  if (rafGroupResize.rafId !== undefined) {
    cancelAnimationFrame(rafGroupResize.rafId);
    rafGroupResize.rafId = undefined;
  }
  rafGroupResize.pending = false;
  rafGroupResize.lastArgs = undefined;
}

function genId(prefix = 'id'): ID {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// helper interne : clamp pour garder la bbox rect dans la scène (rotation ignorée V1)
function clampToScene(x: number, y: number, w: number, h: number, sceneW: number, sceneH: number) {
  const nx = Math.min(Math.max(0, x), Math.max(0, sceneW - w));
  const ny = Math.min(Math.max(0, y), Math.max(0, sceneH - h));
  return { x: nx, y: ny };
}

// helper interne : snap à la grille 10mm
function snapTo10mm(x: number): number {
  return Math.round(x / 10) * 10;
}

// helpers internes : normalisation et rotation d'angles
function normDeg(d: number): Deg {
  // normalise en {0,90,180,270} via modulo 360
  const n = ((Math.round(d) % 360) + 360) % 360;
  return (n === 0 || n === 90 || n === 180 || n === 270 ? n : (Math.round(n / 90) * 90) % 360) as Deg;
}
function add90(d: Deg): Deg {
  return normDeg((d + 90) % 360);
}
function sub90(d: Deg): Deg {
  return normDeg((d + 270) % 360);
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers: rotation rigide de groupe autour d'un pivot commun
// ─────────────────────────────────────────────────────────────────────────

/**
 * Fait tourner un point autour d'un pivot pour des angles multiples de 90°.
 * Utilisé pour la rotation rigide de groupe (centres des pièces tournent autour du pivot).
 */
function rotatePoint90Deg(
  p: { x: Milli; y: Milli },
  pivot: { x: Milli; y: Milli },
  deltaDeg: 0 | 90 | -90 | 180
): { x: Milli; y: Milli } {
  const dx = (p.x - pivot.x) as Milli;
  const dy = (p.y - pivot.y) as Milli;

  switch (deltaDeg) {
    case 0:
      return { x: p.x, y: p.y };
    case 180:
      return { x: (pivot.x - dx) as Milli, y: (pivot.y - dy) as Milli };
    case 90:
      return { x: (pivot.x - dy) as Milli, y: (pivot.y + dx) as Milli };
    case -90:
      return { x: (pivot.x + dy) as Milli, y: (pivot.y - dx) as Milli };
  }
}

/**
 * Calcule le centre visuel d'une pièce (centre de son AABB rotation-aware).
 */
function pieceCenter(p: Piece): { x: Milli; y: Milli } {
  const bbox = pieceBBox(p);
  return {
    x: (bbox.x + bbox.w / 2) as Milli,
    y: (bbox.y + bbox.h / 2) as Milli,
  };
}

/**
 * Calcule le pivot (centre de la bbox union) pour un groupe de pièces.
 */
function groupPivot(scene: SceneDraft, ids: ID[]): { x: Milli; y: Milli } {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const id of ids) {
    const p = scene.pieces[id];
    if (!p) continue;
    const b = pieceBBox(p);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }

  return {
    x: ((minX + maxX) / 2) as Milli,
    y: ((minY + maxY) / 2) as Milli,
  };
}

/**
 * Construit une scène candidate avec rotation rigide de groupe.
 * Chaque pièce voit son centre tourner autour du pivot, et sa rotation individuelle incrémentée.
 * Les dimensions nominales (size.w/h) restent inchangées.
 */
function buildRigidRotationCandidate(
  scene: SceneDraft,
  ids: ID[],
  opts: { deltaDeg?: 90 | -90; targetDeg?: Deg }
): SceneDraft {
  const pivot = groupPivot(scene, ids);
  const next: SceneDraft = { ...scene, pieces: { ...scene.pieces } };

  for (const id of ids) {
    const p = next.pieces[id];
    if (!p) continue;

    const curDeg = (p.rotationDeg ?? 0) as Deg;
    const nxtDeg =
      opts.targetDeg != null
        ? opts.targetDeg
        : opts.deltaDeg === 90
        ? add90(curDeg)
        : sub90(curDeg);

    // Calculer l'angle de rotation réel pour rotatePoint90Deg
    let actualDelta: 0 | 90 | -90 | 180;
    if (opts.targetDeg != null) {
      const raw = ((nxtDeg - curDeg + 360) % 360);
      actualDelta = raw === 270 ? -90 : raw as 0 | 90 | -90 | 180;
    } else {
      actualDelta = opts.deltaDeg! as 0 | 90 | -90 | 180;
    }

    // Centre actuel (AABB-aware)
    const curCenter = pieceCenter(p);

    // Nouveau centre après rotation autour du pivot
    const rotatedCenter = rotatePoint90Deg(curCenter, pivot, actualDelta);

    // Dimensions intrinsèques (invariantes par rotation)
    const { w: w0, h: h0 } = p.size;

    // Extents AABB finaux selon nxtDeg (angles multiples de 90°)
    const r = ((nxtDeg ?? 0) % 360 + 360) % 360;
    const AABBwFinal = (r === 90 || r === 270 ? h0 : w0) as Milli;
    const AABBhFinal = (r === 90 || r === 270 ? w0 : h0) as Milli;

    // Top-left de l'AABB finale = centre rotated - (AABB_final / 2)
    const aabbTopLeft = {
      x: (rotatedCenter.x - AABBwFinal / 2) as Milli,
      y: (rotatedCenter.y - AABBhFinal / 2) as Milli,
    };

    // Créer une pièce temporaire avec la nouvelle rotation pour utiliser aabbToPiecePosition
    const tempPiece: Piece = { ...p, rotationDeg: nxtDeg };
    const newPosition = aabbToPiecePosition(aabbTopLeft.x, aabbTopLeft.y, tempPiece);

    // Ne modifier que position et rotationDeg (size reste inchangé)
    next.pieces[id] = {
      ...p,
      rotationDeg: nxtDeg,
      position: { x: newPosition.x as Milli, y: newPosition.y as Milli },
    };
  }

  return next;
}

/**
 * Calcule les extents du groupe (L, R, T, B) depuis le pivot jusqu'aux bords de la bbox union.
 * Retourne les distances radiales du pivot aux extrêmes gauche/droite/haut/bas du groupe.
 * Utile pour calculer les facteurs de scale max qui gardent le groupe dans la scène.
 */
function groupExtentsAroundPivot(
  scene: SceneDraft,
  ids: ID[],
  pivot: { x: Milli; y: Milli }
): { L: Milli; R: Milli; T: Milli; B: Milli } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const id of ids) {
    const p = scene.pieces[id];
    if (!p) continue;

    // Calculer AABB de la pièce
    const center = pieceCenter(p);
    const ext = aabbExtentsFromIntrinsic(p.size, (p.rotationDeg ?? 0) as Deg);
    const aabbLeft = center.x - ext.w / 2;
    const aabbRight = center.x + ext.w / 2;
    const aabbTop = center.y - ext.h / 2;
    const aabbBottom = center.y + ext.h / 2;

    minX = Math.min(minX, aabbLeft);
    maxX = Math.max(maxX, aabbRight);
    minY = Math.min(minY, aabbTop);
    maxY = Math.max(maxY, aabbBottom);
  }

  // Distances du pivot aux bords
  const L = (pivot.x - minX) as Milli; // distance vers la gauche
  const R = (maxX - pivot.x) as Milli; // distance vers la droite
  const T = (pivot.y - minY) as Milli; // distance vers le haut
  const B = (maxY - pivot.y) as Milli; // distance vers le bas

  return { L, R, T, B };
}

/**
 * Distance euclidienne entre deux points.
 */
function distance(a: { x: Milli; y: Milli }, b: { x: Milli; y: Milli }): Milli {
  return Math.hypot(a.x - b.x, a.y - b.y) as Milli;
}

/**
 * Calcule les extents AABB d'une pièce en fonction de son angle de rotation.
 * Pour 90°/270°, les dimensions w/h sont swappées.
 */
function aabbExtentsFromIntrinsic(
  size: { w: Milli; h: Milli },
  deg: Deg
): { w: Milli; h: Milli } {
  const r = ((deg % 360) + 360) % 360;
  return r === 90 || r === 270
    ? { w: size.h as Milli, h: size.w as Milli }
    : { w: size.w as Milli, h: size.h as Milli };
}

/**
 * Construit une scène candidate avec scaling isotrope de groupe autour d'un pivot.
 * Chaque pièce voit:
 * - son centre se déplacer selon une homothétie de centre `pivot` et facteur `scale`
 * - ses dimensions intrinsèques (size.w/h) multipliées par `scale`
 * - sa rotation (rotationDeg) inchangée
 * - sa position recalculée pour que son AABB corresponde au nouveau centre et à la nouvelle taille
 *
 * Note: Le pivot est le centre de la bbox union (cohérent avec rotation rigide),
 * pas la moyenne des centres des pièces.
 */
function buildGroupScaleCandidate(
  scene: SceneDraft,
  ids: ID[],
  pivot: { x: Milli; y: Milli },
  scale: number
): SceneDraft {
  const next: SceneDraft = { ...scene, pieces: { ...scene.pieces } };

  for (const id of ids) {
    const p = next.pieces[id];
    if (!p) continue;

    // Centre actuel (AABB-aware)
    const curCenter = pieceCenter(p);

    // Nouveau centre après scaling about pivot: center' = pivot + scale * (center - pivot)
    const newCenter = {
      x: (pivot.x + (curCenter.x - pivot.x) * scale) as Milli,
      y: (pivot.y + (curCenter.y - pivot.y) * scale) as Milli,
    };

    // Dimensions intrinsèques scalées
    const w1 = (p.size.w * scale) as Milli;
    const h1 = (p.size.h * scale) as Milli;

    // AABB finale selon l'angle courant (rotation inchangée)
    const ext = aabbExtentsFromIntrinsic({ w: w1, h: h1 }, (p.rotationDeg ?? 0) as Deg);

    // Top-left de l'AABB finale = centre - (extents / 2)
    const aabbTopLeft = {
      x: (newCenter.x - ext.w / 2) as Milli,
      y: (newCenter.y - ext.h / 2) as Milli,
    };

    // Convertir AABB → piece.position en tenant compte de la rotation
    const tempPiece: Piece = { ...p, size: { w: w1, h: h1 } };
    const newPosition = aabbToPiecePosition(aabbTopLeft.x, aabbTopLeft.y, tempPiece);

    // Ne modifier que size et position (rotationDeg reste inchangé)
    next.pieces[id] = {
      ...p,
      size: { w: w1, h: h1 },
      position: { x: newPosition.x as Milli, y: newPosition.y as Milli },
    };
  }

  return next;
}

// Helper to convert resize handle to moved direction
function handleToMoved(handle: ResizeHandle): ResizeContext['moved'] {
  return handle.toUpperCase() as ResizeContext['moved'];
}

// Helper functions for resize baseline tracking
function aabbGapLocal(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number {
  const dx = Math.max(0, Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)));
  const dy = Math.max(0, Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h)));
  if (dx === 0 && dy === 0) {
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return -Math.min(overlapX, overlapY);
  }
  if (dy === 0) return dx;
  if (dx === 0) return dy;
  return Math.min(dx, dy);
}

function dominantSpacingAxisLocal(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): 'X' | 'Y' {
  const xOverlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const yOverlapRatio = yOverlap / Math.min(a.h, b.h);
  const xOverlapRatio = xOverlap / Math.min(a.w, b.w);
  if (yOverlapRatio > 0.5) return 'X';
  if (xOverlapRatio > 0.5) return 'Y';
  return yOverlapRatio > xOverlapRatio ? 'X' : 'Y';
}

// helpers sélection multiple
function uniqueIds(ids: ID[]): ID[] {
  return Array.from(new Set(ids));
}

function groupBBox(scene: SceneDraft, ids: ID[]) {
  const rects = ids
    .map((id) => scene.pieces[id])
    .filter(Boolean)
    .map((p) => pieceBBox(p)); // Use rotation-aware AABB
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Compute and update group bbox in UI state
 */
function computeGroupBBox(draft: SceneState) {
  const selectedIds = draft.ui.selectedIds ?? (draft.ui.selectedId ? [draft.ui.selectedId] : []);
  if (selectedIds.length < 2) {
    draft.ui.groupBBox = undefined;
    return;
  }
  draft.ui.groupBBox = groupBBox(draft.scene, selectedIds);
}

/**
 * Bump handles epoch to force remount of overlays/handles
 * Call this at the end of any transient operation or selection change
 */
function bumpHandlesEpoch(draft: SceneState) {
  draft.ui.handlesEpoch = (draft.ui.handlesEpoch ?? 0) + 1;
}

/**
 * Clears transient UI state (drag/resize previews, guides, marquee)
 * while preserving selection state (selectedId/selectedIds/primaryId)
 */
function clearTransientUI(ui: SceneState['ui']) {
  ui.dragging = undefined;
  ui.resizing = undefined;
  ui.groupResizing = undefined;
  ui.guides = undefined;
  ui.marquee = undefined;
  ui.isTransientActive = false;
  ui.transientBBox = undefined;
  ui.transientDelta = undefined;
  // Keep selection intact: selectedId, selectedIds, primaryId
}

type SceneStateSnapshot = {
  scene: SceneDraft;
  ui: {
    snap10mm?: boolean;
    selectedIds?: ID[];
    selectedId?: ID;
    primaryId?: ID;
  };
};

type SceneState = {
  scene: SceneDraft;
  ui: {
    selectedId?: ID;
    selectedIds?: ID[];
    primaryId?: ID;
    flashInvalidAt?: number;
    dragging?: {
      id: ID;
      start: { x: number; y: number };
      candidate?: { x: number; y: number; valid: boolean };
      groupOffsets?: Record<ID, { dx: number; dy: number }>;
      /**
       * True si le drag en cours concerne la sélection courante
       * (solo: selectedId; groupe: selectedIds).
       * Utilisé par le tooltip pour éviter de suivre un autre drag.
       */
      affectsSelection?: boolean;
    };
    marquee?: { x0: number; y0: number; x1: number; y1: number };
    snap10mm?: boolean;
    guides?: SnapGuide[];
    resizing?: {
      pieceId: ID;
      handle: ResizeHandle;
      origin: { x: Milli; y: Milli; w: Milli; h: Milli };
      startPointerMm: { x: Milli; y: Milli };
      rotationDeg: Deg;
      snapshot: SceneStateSnapshot;
      baseline?: Record<string, { axis: 'X' | 'Y'; gap: number }>;
      _lastResizeValidateMm?: { x: Milli; y: Milli };
    };
    groupResizing?: {
      isResizing: boolean;
      pivot: { x: Milli; y: Milli };
      startSnapshot: SceneStateSnapshot;
      startPointer: { x: Milli; y: Milli };
      startRadius: Milli;
      lastScale?: number;
      preview?: {
        scale: number;
        bbox: { x: Milli; y: Milli; w: Milli; h: Milli };
        selectedIds: ID[];
        groupDiagMm: number; // Diagonal for dynamic precision
        previewPieces?: Array<{
          id: ID;
          matrix: { a: number; b: number; c: number; d: number; e: number; f: number };
        }>;
      };
    };
    groupBBox?: { x: Milli; y: Milli; w: Milli; h: Milli };
    lockEdge?: boolean;
    history?: {
      past: SceneStateSnapshot[];
      future: SceneStateSnapshot[];
      limit: number;
    };
    effects?: {
      focusId?: ID;
      flashId?: ID;
      flashUntil?: number;
    };
    toast?: {
      message: string;
      until: number;
    };
    ghost?: {
      pieceId: ID;
      problems: Problem[];
      startedAt: number;
    };
    // Transient UI state during drag/resize (before commit)
    isTransientActive: boolean;
    transientBBox?: { x: Milli; y: Milli; w: Milli; h: Milli; rotationDeg?: Deg };
    transientOpsRev?: number; // Counter incremented on begin/end/cancel to force remount of overlays
    handlesEpoch: number; // Force remount of handles/overlays on selection/operation change

    // Transient delta for group ghost overlay during drag
    transientDelta?: { dx: Milli; dy: Milli };
    // Selection bbox (solo/group) for handles rendering
    selectionBBox?: { x: Milli; y: Milli; w: Milli; h: Milli };

    // Active layer for editing (only pieces in this layer are interactive)
    activeLayer?: ID;
  };
};

type SceneActions = {
  initScene: (w: Milli, h: Milli) => void;
  addMaterial: (m: Omit<MaterialRef, 'id'> & { id?: ID }) => ID;
  setMaterialOrientation: (materialId: ID, orientationDeg: Deg) => void;

  addLayer: (name: string) => ID;
  setActiveLayer: (layerId: ID) => void;
  addRectPiece: (layerId: ID, materialId: ID, w: Milli, h: Milli, x: Milli, y: Milli, rotationDeg?: Deg) => ID;
  movePiece: (pieceId: ID, x: Milli, y: Milli) => void;
  rotatePiece: (pieceId: ID, rotationDeg: Deg) => void;
  initSceneWithDefaults: (w: Milli, h: Milli) => void;
  selectPiece: (id: ID | undefined) => void;
  nudgeSelected: (dx: Milli, dy: Milli) => void;
  selectOnly: (id: ID) => void;
  toggleSelect: (id: ID) => void;
  clearSelection: () => void;
  selectAll: () => void;
  setSelection: (ids: ID[]) => void;
  startMarquee: (x: Milli, y: Milli) => void;
  updateMarquee: (x: Milli, y: Milli) => void;
  endMarquee: () => void;
  beginDrag: (id: ID) => void;
  updateDrag: (dx: number, dy: number) => void;
  endDrag: () => void;
  cancelDrag: () => void;
  addRectAtCenter: (w: Milli, h: Milli) => void;
  deleteSelected: () => void;
  setPieceMaterial: (pieceId: ID, materialId: ID) => void;
  toggleJoined: (pieceId: ID) => void;
  setSnap10mm: (on: boolean) => void;
  setMaterialOriented: (materialId: ID, oriented: boolean) => void;
  rotateSelected: (deltaDeg: 90 | -90) => void;
  setSelectedRotation: (deg: 0 | 90) => void;
  duplicateSelected: () => void;
  moveLayerForward: (layerId: ID) => void;
  moveLayerBackward: (layerId: ID) => void;
  moveLayerToFront: (layerId: ID) => void;
  moveLayerToBack: (layerId: ID) => void;
  undo: () => void;
  redo: () => void;
  toSceneFileV1: () => SceneFileV1;
  importSceneFileV1: (file: SceneFileV1) => void;
  createDraft: () => void;
  saveToDraft: (id: string) => void;
  loadDraftById: (id: string) => void;
  renameDraft: (id: string, name: string) => void;
  deleteDraftById: (id: string) => void;
  startResize: (pieceId: ID, handle: ResizeHandle, startPointerMm?: { x: Milli; y: Milli }) => void;
  updateResize: (pointerMm: { x: Milli; y: Milli }) => void;
  endResize: (commit: boolean) => void;
  startGroupResize: (handle: ResizeHandle, startPointerMm?: { x: Milli; y: Milli }) => void;
  updateGroupResize: (pointerMm: { x: Milli; y: Milli }, altKey?: boolean) => void;
  _updateGroupResizeRafSafe: (args: {pointer: {x: Milli; y: Milli}; altKey: boolean}) => void;
  endGroupResize: (commit: boolean) => void;
  cancelGroupResize: () => void;
  setLockEdge: (on: boolean) => void;
  focusPiece: (id: ID) => void;
  flashOutline: (id: ID) => void;
  findFreeSpot: (w: number, h: number) => Promise<{ x: number; y: number } | null>;
  insertRect: (opts: { w: number; h: number; x?: number; y?: number; layerId?: ID; materialId?: ID }) => Promise<ID | null>;
  startGhostInsert: (opts: { w: number; h: number; layerId?: ID; materialId?: ID }) => Promise<ID>;
  commitGhost: () => void;
  cancelGhost: () => void;
  validateGhost: () => Promise<void>;
};

// Helper: deep clone minimal snapshot
function takeSnapshot(s: SceneState): SceneStateSnapshot {
  return {
    scene: JSON.parse(JSON.stringify(s.scene)),
    ui: {
      snap10mm: s.ui.snap10mm,
      selectedIds: s.ui.selectedIds ? [...s.ui.selectedIds] : undefined,
      selectedId: s.ui.selectedId,
      primaryId: s.ui.primaryId,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Helper: pré-validation rotation
// ─────────────────────────────────────────────────────────────────────────
// Construit une scène candidate avec les rotations appliquées, puis valide
// overlap (AABB rotation-aware) + inside scene. Retourne true si valide.
// Utilisé par rotateSelected et setSelectedRotation pour empêcher overlaps.
function rotationWouldBeValid(
  sceneDraft: SceneDraft,
  candidateIds: ID[],
  nextDegById: Record<ID, Deg>
): boolean {
  // Construire une scène candidate pour validation (deep copy pour sécurité)
  const sceneCandidate: SceneDraft = JSON.parse(JSON.stringify(sceneDraft));

  // Appliquer la rotation candidate aux pièces concernées
  for (const id of candidateIds) {
    const p = sceneCandidate.pieces[id];
    if (!p) continue;
    const nxt = nextDegById[id];
    if (nxt === undefined) continue;
    sceneCandidate.pieces[id].rotationDeg = nxt;
  }

  // 1) Valider collisions (ignore auto-collisions internes au groupe)
  const overlap = validateNoOverlapForCandidateDraft(sceneCandidate, candidateIds);
  if (!overlap.ok) return false;

  // 2) Valider bornes de scène (AABB rotation-aware via pieceBBox)
  const inside = validateInsideScene(sceneCandidate);
  if (!inside.ok) return false;

  return true;
}

// Helper: restore snapshot
function applySnapshot(draft: SceneState, snap: SceneStateSnapshot): void {
  draft.scene = JSON.parse(JSON.stringify(snap.scene));
  draft.ui.snap10mm = snap.ui.snap10mm;
  draft.ui.selectedIds = snap.ui.selectedIds ? [...snap.ui.selectedIds] : undefined;
  draft.ui.selectedId = snap.ui.selectedId;
  draft.ui.primaryId = snap.ui.primaryId;
}

// Helper: push to history with FIFO limit
function pushHistory(draft: SceneState, snap: SceneStateSnapshot): void {
  if (!draft.ui.history) {
    draft.ui.history = { past: [], future: [], limit: 100 };
  }
  draft.ui.history.past.push(snap);
  if (draft.ui.history.past.length > draft.ui.history.limit) {
    draft.ui.history.past.shift(); // FIFO drop
  }
  draft.ui.history.future = []; // Clear future on new action
}

// Helper: autosave to localStorage
function autosave(snap: SceneStateSnapshot): void {
  try {
    localStorage.setItem('editeur.scene.v1', JSON.stringify(snap));
  } catch (e) {
    console.error('Autosave failed:', e);
  }
}

// Helper: restore from localStorage
function restoreFromAutosave(): SceneStateSnapshot | null {
  try {
    const stored = localStorage.getItem('editeur.scene.v1');
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (e) {
    console.error('Restore failed:', e);
    return null;
  }
}

export const useSceneStore = create<SceneState & SceneActions>((set) => ({
  // État initial minimal
  scene: {
    id: genId('scene'),
    createdAt: new Date().toISOString(),
    size: { w: 600, h: 600 },
    materials: {},
    layers: {},
    pieces: {},
    layerOrder: [],
    revision: 0,
  },
  ui: {
    selectedId: undefined,
    selectedIds: undefined,
    primaryId: undefined,
    flashInvalidAt: undefined,
    dragging: undefined,
    marquee: undefined,
    snap10mm: true,
    guides: undefined,
    isTransientActive: false,
    handlesEpoch: 0,
    history: {
      past: [],
      future: [],
      limit: 100,
    },
  },

  // Actions
  initScene: (w, h) =>
    set(produce((draft: SceneState) => {
      draft.scene = {
        id: genId('scene'),
        createdAt: new Date().toISOString(),
        size: { w, h },
        materials: {},
        layers: {},
        pieces: {},
        layerOrder: [],
      };
      draft.ui.activeLayer = undefined; // Reset active layer
    })),

  addMaterial: (m) =>
    set(produce((draft: SceneState) => {
      const id = m.id ?? genId('mat');
      draft.scene.materials[id] = { id, name: m.name, oriented: m.oriented, orientationDeg: m.orientationDeg };
    })) as unknown as ID,

  setMaterialOrientation: (materialId, orientationDeg) =>
    set(produce((draft: SceneState) => {
      const mat = draft.scene.materials[materialId];
      if (mat && mat.oriented) {
        const snap = takeSnapshot(draft);
        mat.orientationDeg = orientationDeg;
        pushHistory(draft, snap);
        autosave(takeSnapshot(draft));
      }
    })),

  addLayer: (name) =>
    set(produce((draft: SceneState) => {
      const id = genId('layer');
      const z = draft.scene.layerOrder.length;
      const layer: Layer = { id, name, z, pieces: [] };
      draft.scene.layers[id] = layer;
      draft.scene.layerOrder.push(id);
    })) as unknown as ID,

  setActiveLayer: (layerId) =>
    set(produce((draft: SceneState) => {
      if (draft.scene.layers[layerId]) {
        draft.ui.activeLayer = layerId;
      }
    })),

  addRectPiece: (layerId, materialId, w, h, x, y, rotationDeg = 0) => {
    const result = set(produce((draft: SceneState) => {
      const id = genId('piece');
      const piece: Piece = {
        id,
        layerId,
        materialId,
        position: { x, y },
        rotationDeg,
        scale: { x: 1, y: 1 },
        kind: 'rect',
        size: { w, h },
      };
      draft.scene.pieces[id] = piece;
      draft.scene.layers[layerId]?.pieces.push(id);

      // Sync to spatial index if flag enabled
      if (window.__flags?.USE_GLOBAL_SPATIAL) {
        syncPieceToIndex(id, { x, y, w, h });
      }
    })) as unknown as ID;
    return result;
  },

  movePiece: (pieceId, x, y) =>
    set(produce((draft: SceneState) => {
      const p = draft.scene.pieces[pieceId];
      if (p) {
        p.position = { x, y };

        // Sync to spatial index if flag enabled
        if (window.__flags?.USE_GLOBAL_SPATIAL) {
          syncPieceToIndex(pieceId, { x, y, w: p.size.w, h: p.size.h });
        }
      }
    })),

  rotatePiece: (pieceId, rotationDeg) =>
    set(produce((draft: SceneState) => {
      const p = draft.scene.pieces[pieceId];
      if (p) p.rotationDeg = rotationDeg;
    })),

  initSceneWithDefaults: (w, h) =>
    set(produce((draft: SceneState) => {
      // Try to restore from autosave (skip in test mode)
      const isTest = typeof import.meta !== 'undefined' && (import.meta as any).vitest === true;
      if (!isTest) {
        const restored = restoreFromAutosave();
        if (restored && restored.scene.layerOrder.length > 0) {
          applySnapshot(draft, restored);
          return;
        }
      }

      // Reset scène
      draft.scene = {
        id: genId('scene'),
        createdAt: new Date().toISOString(),
        size: { w, h },
        materials: {},
        layers: {},
        pieces: {},
        layerOrder: [],
        revision: 0,
      };

      // Créer layer, material, piece atomiquement
      const layerId = genId('layer');
      const materialId = genId('mat');
      const pieceId = genId('piece');

      draft.scene.layers[layerId] = { id: layerId, name: 'C1', z: 0, pieces: [pieceId] };
      draft.scene.layerOrder.push(layerId);
      draft.ui.activeLayer = layerId; // Set C1 as default active layer
      draft.scene.materials[materialId] = { id: materialId, name: 'Paper White 200gsm', oriented: false };
      draft.scene.pieces[pieceId] = {
        id: pieceId, layerId, materialId, position: { x: 40, y: 40 }, rotationDeg: 0, scale: { x: 1, y: 1 }, kind: 'rect', size: { w: 120, h: 80 },
      };
    })),

  selectPiece: (id) =>
    set(produce((draft: SceneState) => {
      draft.ui.selectedId = id;
      draft.ui.selectedIds = id ? [id] : undefined;
      draft.ui.primaryId = id;
      computeGroupBBox(draft);
      bumpHandlesEpoch(draft);
    })),

  selectOnly: (id) =>
    set(produce((draft: SceneState) => {
      draft.ui.selectedId = id;
      draft.ui.selectedIds = [id];
      draft.ui.primaryId = id;
      computeGroupBBox(draft);
      bumpHandlesEpoch(draft);
    })),

  toggleSelect: (id) =>
    set(produce((draft: SceneState) => {
      const current = draft.ui.selectedIds ?? (draft.ui.selectedId ? [draft.ui.selectedId] : []);
      if (current.includes(id)) {
        const newIds = current.filter((x) => x !== id);
        draft.ui.selectedIds = newIds.length > 0 ? newIds : undefined;
        draft.ui.selectedId = newIds[0];
        draft.ui.primaryId = newIds[0];
      } else {
        draft.ui.selectedIds = uniqueIds([...current, id]);
        draft.ui.selectedId = id;
        draft.ui.primaryId = id;
      }
      computeGroupBBox(draft);
      bumpHandlesEpoch(draft);
    })),

  clearSelection: () =>
    set(produce((draft: SceneState) => {
      draft.ui.selectedId = undefined;
      draft.ui.selectedIds = undefined;
      draft.ui.primaryId = undefined;
      computeGroupBBox(draft);
      bumpHandlesEpoch(draft);
    })),

  selectAll: () =>
    set(produce((draft: SceneState) => {
      const allIds = Object.keys(draft.scene.pieces);
      draft.ui.selectedIds = allIds;
      draft.ui.selectedId = allIds[0];
      draft.ui.primaryId = allIds[0];
      computeGroupBBox(draft);
      bumpHandlesEpoch(draft);
    })),

  setSelection: (ids) =>
    set(produce((draft: SceneState) => {
      const validIds = uniqueIds(ids.filter((id) => draft.scene.pieces[id]));
      draft.ui.selectedIds = validIds.length > 0 ? validIds : undefined;
      draft.ui.selectedId = validIds[0];
      draft.ui.primaryId = validIds[0];
      computeGroupBBox(draft);
      bumpHandlesEpoch(draft);
    })),

  startMarquee: (x, y) =>
    set(produce((draft: SceneState) => {
      draft.ui.marquee = { x0: x, y0: y, x1: x, y1: y };
    })),

  updateMarquee: (x, y) =>
    set(produce((draft: SceneState) => {
      if (!draft.ui.marquee) return;
      draft.ui.marquee.x1 = x;
      draft.ui.marquee.y1 = y;
    })),

  endMarquee: () =>
    set(produce((draft: SceneState) => {
      if (!draft.ui.marquee) return;
      const { x0, y0, x1, y1 } = draft.ui.marquee;
      const minX = Math.min(x0, x1);
      const maxX = Math.max(x0, x1);
      const minY = Math.min(y0, y1);
      const maxY = Math.max(y0, y1);

      const intersected = Object.values(draft.scene.pieces)
        .filter((p) => {
          const bbox = pieceBBox(p); // Use rotation-aware AABB
          const pRight = bbox.x + bbox.w;
          const pBottom = bbox.y + bbox.h;
          return !(pRight < minX || bbox.x > maxX || pBottom < minY || bbox.y > minY);
        })
        .map((p) => p.id);

      draft.ui.selectedIds = intersected.length > 0 ? intersected : undefined;
      draft.ui.selectedId = intersected[0];
      draft.ui.primaryId = intersected[0];
      draft.ui.marquee = undefined;
      computeGroupBBox(draft);
    })),

  nudgeSelected: (dx, dy) =>
    set(produce((draft: SceneState) => {
      const selectedIds = draft.ui.selectedIds ?? (draft.ui.selectedId ? [draft.ui.selectedId] : []);
      if (selectedIds.length === 0) return;

      const snap = takeSnapshot(draft);

      // Nudge de groupe : calculer bbox du groupe (AABB rotation-aware)
      const bbox = groupBBox(draft.scene, selectedIds);

      // Clamp group AABB to scene
      const candidateAABB = { x: bbox.x + dx, y: bbox.y + dy, w: bbox.w, h: bbox.h };
      const clamped = clampAABBToScene(candidateAABB, draft.scene.size.w, draft.scene.size.h);

      const actualDx = clamped.x - bbox.x;
      const actualDy = clamped.y - bbox.y;

      // Appliquer snap grille si activé (sur AABB)
      let finalDx = actualDx;
      let finalDy = actualDy;
      if (draft.ui.snap10mm) {
        const snappedX = snapTo10mm(bbox.x + actualDx);
        const snappedY = snapTo10mm(bbox.y + actualDy);
        finalDx = snappedX - bbox.x;
        finalDy = snappedY - bbox.y;
      }

      // FEAT_GAP_COLLAGE: Appliquer snap collage bord-à-bord si gap < 1,0mm
      // Calculer prevGap pour directionnalité (ne coller que si on s'approche)
      const currentBBox = { x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h };
      const candidateWithSnap = { x: bbox.x + finalDx, y: bbox.y + finalDy, w: bbox.w, h: bbox.h };

      // Récupérer voisins externes (exclure membres groupe)
      const neighbors = Object.values(draft.scene.pieces).filter(p => !selectedIds.includes(p.id));
      const prevGap = computeMinGap(currentBBox, neighbors);

      const collageResult = snapEdgeCollage(
        candidateWithSnap,
        draft.scene,
        selectedIds,
        SNAP_EDGE_THRESHOLD_MM,
        prevGap
      );
      finalDx = collageResult.x - bbox.x;
      finalDy = collageResult.y - bbox.y;

      // GARDE-FOU FINAL: Force collage à gap=0 si gap ∈ (0 ; MIN_GAP_MM)
      // Indépendant des toggles snap, appliqué juste avant commit
      let finalBBox = { x: bbox.x + finalDx, y: bbox.y + finalDy, w: bbox.w, h: bbox.h };
      const guardResult = finalizeCollageGuard({
        subjectBBox: finalBBox,
        neighbors,
        maxGapMm: MIN_GAP_MM,
      });

      if (guardResult.didSnap) {
        finalDx += guardResult.dx;
        finalDy += guardResult.dy;
        finalBBox = { x: bbox.x + finalDx, y: bbox.y + finalDy, w: bbox.w, h: bbox.h };
      }

      // NORMALIZATION: Normalize gap to exact 1.00mm if in [1.00, 1.00+ε] window
      if (ENABLE_GAP_NORMALIZATION) {
        const normalizeResult = normalizeGapToThreshold({
          subjectBBox: finalBBox,
          neighbors,
          targetMm: NORMALIZE_GAP_TARGET_MM,
          epsilonMm: EPSILON_GAP_NORMALIZE_MM,
          sceneBounds: { w: draft.scene.size.w, h: draft.scene.size.h },
        });

        if (normalizeResult.didNormalize) {
          finalDx += normalizeResult.dx;
          finalDy += normalizeResult.dy;
        }
      }

      // For each piece, compute new AABB position with final clamp, then convert to piece.position
      // This ensures rotation-aware nudge and prevents escaping scene after snaps
      const testScene = { ...draft.scene, pieces: { ...draft.scene.pieces } };
      for (const id of selectedIds) {
        const p = draft.scene.pieces[id];
        if (!p) continue;
        const pBBox = pieceBBox(p);
        let newAABBPos = { x: pBBox.x + finalDx, y: pBBox.y + finalDy, w: pBBox.w, h: pBBox.h };
        // Clamp final pour garantir que la pièce reste dans la scène
        newAABBPos = clampAABBToScene(newAABBPos, draft.scene.size.w, draft.scene.size.h);
        const newPiecePos = aabbToPiecePosition(newAABBPos.x, newAABBPos.y, p);
        testScene.pieces[id] = { ...p, position: newPiecePos };
      }

      // Use validateNoOverlapForCandidate to avoid rollback from internal group collisions
      const validation = selectedIds.length > 1
        ? validateNoOverlapForCandidateDraft(testScene, selectedIds)
        : validateNoOverlap(testScene);

      if (!validation.ok) {
        draft.ui.flashInvalidAt = Date.now();
      } else {
        if (finalDx !== 0 || finalDy !== 0) {
          for (const id of selectedIds) {
            const p = draft.scene.pieces[id];
            if (!p) continue;
            const pBBox = pieceBBox(p);
            let newAABBPos = { x: pBBox.x + finalDx, y: pBBox.y + finalDy, w: pBBox.w, h: pBBox.h };
            // Clamp final pour garantir que la pièce reste dans la scène
            newAABBPos = clampAABBToScene(newAABBPos, draft.scene.size.w, draft.scene.size.h);
            const newPiecePos = aabbToPiecePosition(newAABBPos.x, newAABBPos.y, p);
            p.position.x = newPiecePos.x;
            p.position.y = newPiecePos.y;
          }
          draft.scene.revision++;
          pushHistory(draft, snap);
          autosave(takeSnapshot(draft));
        }
      }
    })),

  beginDrag: (id) =>
    set(produce((draft: SceneState) => {
      const piece = draft.scene.pieces[id];
      if (!piece) return;

      const selectedIds = draft.ui.selectedIds ?? (draft.ui.selectedId ? [draft.ui.selectedId] : []);

      // Déterminer si le drag concerne la sélection courante
      const selId = draft.ui.selectedId ?? null;
      const selIds = draft.ui.selectedIds ?? null;
      let affectsSelection = false;

      if (selIds && selIds.length > 0) {
        affectsSelection = selIds.includes(id);
      } else if (selId) {
        affectsSelection = selId === id;
      } else {
        // Aucune sélection : auto-select la pièce, donc affecte la sélection
        affectsSelection = true;
      }

      // Si la pièce n'est pas dans la sélection, selectOnly
      if (!selectedIds.includes(id)) {
        draft.ui.selectedId = id;
        draft.ui.selectedIds = [id];
        draft.ui.primaryId = id;
      }

      const finalSelectedIds = draft.ui.selectedIds ?? [id];

      // CRITICAL: Store AABB position (not piece.position) for rotation-aware drag
      // For rotated pieces, AABB position differs from piece.position
      const primaryBBox = pieceBBox(piece);

      // Stocker les offsets pour le groupe (AABB-based for rotation awareness)
      const groupOffsets: Record<ID, { dx: number; dy: number }> = {};
      for (const sid of finalSelectedIds) {
        const sp = draft.scene.pieces[sid];
        if (!sp) continue;
        const spBBox = pieceBBox(sp);
        groupOffsets[sid] = {
          dx: spBBox.x - primaryBBox.x,
          dy: spBBox.y - primaryBBox.y,
        };
      }

      draft.ui.dragging = {
        id,
        start: { x: primaryBBox.x, y: primaryBBox.y }, // AABB position, not piece.position
        candidate: undefined,
        groupOffsets,
        affectsSelection,
      };
      draft.ui.transientOpsRev = (draft.ui.transientOpsRev ?? 0) + 1;
    })),

  updateDrag: (dx, dy) =>
    set(produce((draft: SceneState) => {
      const dragging = draft.ui.dragging;
      if (!dragging) return;

      const piece = draft.scene.pieces[dragging.id];
      if (!piece) return;

      const selectedIds = draft.ui.selectedIds ?? [dragging.id];
      const isGroupDrag = selectedIds.length > 1;

      // Drag de groupe : désactiver snap entre pièces
      const candidateX = dragging.start.x + dx;
      const candidateY = dragging.start.y + dy;

      let finalX = candidateX;
      let finalY = candidateY;

      if (isGroupDrag) {
        // Clamp de groupe
        const offsets = dragging.groupOffsets ?? {};
        const groupRects = selectedIds
          .map((sid) => {
            const off = offsets[sid] ?? { dx: 0, dy: 0 };
            const sp = draft.scene.pieces[sid];
            if (!sp) return null;
            const bbox = pieceBBox(sp); // Use rotation-aware AABB
            return {
              x: candidateX + off.dx,
              y: candidateY + off.dy,
              w: bbox.w,
              h: bbox.h,
            };
          })
          .filter(Boolean) as Array<{ x: number; y: number; w: number; h: number }>;

        if (groupRects.length > 0) {
          const gMinX = Math.min(...groupRects.map((r) => r.x));
          const gMinY = Math.min(...groupRects.map((r) => r.y));
          const gMaxX = Math.max(...groupRects.map((r) => r.x + r.w));
          const gMaxY = Math.max(...groupRects.map((r) => r.y + r.h));
          const gW = gMaxX - gMinX;
          const gH = gMaxY - gMinY;

          // Clamp group AABB to scene
          const groupAABB = { x: gMinX, y: gMinY, w: gW, h: gH };
          const clamped = clampAABBToScene(groupAABB, draft.scene.size.w, draft.scene.size.h);
          const clampDx = clamped.x - gMinX;
          const clampDy = clamped.y - gMinY;
          const clampedX = candidateX + clampDx;
          const clampedY = candidateY + clampDy;

          // Snap groupe à pièces
          const snapResult = snapGroupToPieces(draft.scene, clamped, 5, selectedIds);
          draft.ui.guides = snapResult.guides;

          // Appliquer le delta de snap uniformément
          const snapDx = snapResult.x - clamped.x;
          const snapDy = snapResult.y - clamped.y;
          finalX = clampedX + snapDx;
          finalY = clampedY + snapDy;
        } else {
          draft.ui.guides = undefined;
        }
      } else {
        // Drag simple : clamp AABB + snap entre pièces
        const bbox = pieceBBox(piece); // Use rotation-aware AABB
        const candidateAABB = { x: candidateX, y: candidateY, w: bbox.w, h: bbox.h };
        const clamped = clampAABBToScene(candidateAABB, draft.scene.size.w, draft.scene.size.h);
        const snapResult = snapToPieces(draft.scene, clamped, 5, dragging.id);
        draft.ui.guides = snapResult.guides;
        finalX = snapResult.x;
        finalY = snapResult.y;
      }

      // Snap grille optionnel
      if (draft.ui.snap10mm) {
        finalX = snapTo10mm(finalX);
        finalY = snapTo10mm(finalY);
      }

      // FEAT_GAP_COLLAGE: Appliquer snap collage bord-à-bord si gap < 1,0mm
      const bbox = pieceBBox(piece);
      const currentBBox = { x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h };
      const candidateForCollage = { x: finalX, y: finalY, w: bbox.w, h: bbox.h };

      // Calculer prevGap pour directionnalité
      const neighbors = Object.values(draft.scene.pieces).filter(p => !selectedIds.includes(p.id));
      const prevGap = computeMinGap(currentBBox, neighbors);

      const collageResult = snapEdgeCollage(
        candidateForCollage,
        draft.scene,
        selectedIds,
        SNAP_EDGE_THRESHOLD_MM,
        prevGap
      );
      finalX = collageResult.x;
      finalY = collageResult.y;

      // GARDE-FOU FINAL: Force collage à gap=0 si gap ∈ (0 ; MIN_GAP_MM)
      // Indépendant des toggles snap, appliqué avant commit
      const finalBBoxBeforeClamp = { x: finalX, y: finalY, w: bbox.w, h: bbox.h };
      const guardResult = finalizeCollageGuard({
        subjectBBox: finalBBoxBeforeClamp,
        neighbors,
        maxGapMm: MIN_GAP_MM,
      });

      if (guardResult.didSnap) {
        finalX += guardResult.dx;
        finalY += guardResult.dy;
      }

      // Clamp final après tous les snaps (garantit qu'on ne dépasse jamais la scène)
      const finalAABB = { x: finalX, y: finalY, w: bbox.w, h: bbox.h };
      const finalClamped = clampAABBToScene(finalAABB, draft.scene.size.w, draft.scene.size.h);
      finalX = finalClamped.x;
      finalY = finalClamped.y;

      // Simuler et valider
      const testScene = { ...draft.scene, pieces: { ...draft.scene.pieces } };

      if (isGroupDrag) {
        const offsets = dragging.groupOffsets ?? {};
        for (const sid of selectedIds) {
          const off = offsets[sid] ?? { dx: 0, dy: 0 };
          const sp = draft.scene.pieces[sid];
          if (!sp) continue;
          // Convert AABB position to piece.position for validation
          const aabbPos = { x: finalX + off.dx, y: finalY + off.dy };
          const piecePos = aabbToPiecePosition(aabbPos.x, aabbPos.y, sp);
          testScene.pieces[sid] = { ...sp, position: piecePos };
        }
      } else {
        // Convert AABB position to piece.position for validation
        const piecePos = aabbToPiecePosition(finalX, finalY, piece);
        testScene.pieces[dragging.id] = { ...piece, position: piecePos };
      }

      const validation = validateNoOverlap(testScene);

      dragging.candidate = {
        x: finalX,
        y: finalY,
        valid: validation.ok,
      };

      // Calculer transientBBox pour tooltip temps réel
      if (isGroupDrag) {
        // Groupe : calculer bbox union rotation-aware
        const offsets = dragging.groupOffsets ?? {};
        const groupBBoxes = selectedIds
          .map((sid) => {
            const off = offsets[sid] ?? { dx: 0, dy: 0 };
            const sp = draft.scene.pieces[sid];
            if (!sp) return null;
            const spBBox = pieceBBox(sp);
            return {
              x: finalX + off.dx,
              y: finalY + off.dy,
              w: spBBox.w,
              h: spBBox.h,
            };
          })
          .filter(Boolean) as Array<{ x: number; y: number; w: number; h: number }>;

        if (groupBBoxes.length > 0) {
          const minX = Math.min(...groupBBoxes.map((r) => r.x));
          const minY = Math.min(...groupBBoxes.map((r) => r.y));
          const maxX = Math.max(...groupBBoxes.map((r) => r.x + r.w));
          const maxY = Math.max(...groupBBoxes.map((r) => r.y + r.h));
          draft.ui.transientBBox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
          draft.ui.isTransientActive = true;

          // Calculer delta entre bbox commit et bbox transitoire pour les ghosts
          const commitBBoxes = selectedIds
            .map((sid) => {
              const sp = draft.scene.pieces[sid];
              if (!sp) return null;
              const spBBox = pieceBBox(sp);
              return spBBox;
            })
            .filter(Boolean) as Array<{ x: number; y: number; w: number; h: number }>;

          if (commitBBoxes.length > 0) {
            const commitMinX = Math.min(...commitBBoxes.map((r) => r.x));
            const commitMinY = Math.min(...commitBBoxes.map((r) => r.y));
            draft.ui.transientDelta = {
              dx: minX - commitMinX,
              dy: minY - commitMinY,
            };
          }
        }
      } else {
        // Solo : utiliser la bbox rotation-aware
        draft.ui.transientBBox = { x: finalX, y: finalY, w: bbox.w, h: bbox.h, rotationDeg: piece.rotationDeg };
        draft.ui.isTransientActive = true;

        // Calculer delta pour solo
        const commitBBox = pieceBBox(piece);
        draft.ui.transientDelta = {
          dx: finalX - commitBBox.x,
          dy: finalY - commitBBox.y,
        };
      }
    })),

  endDrag: () =>
    set(produce((draft: SceneState) => {
      const dragging = draft.ui.dragging;
      if (!dragging || !dragging.candidate) {
        draft.ui.dragging = undefined;
        draft.ui.guides = undefined;
        clearTransientUI(draft.ui);
        return;
      }

      const snap = takeSnapshot(draft);
      const selectedIds = draft.ui.selectedIds ?? [dragging.id];
      const isGroupDrag = selectedIds.length > 1;

      // Store commit positions before any changes
      const commitPositions: Record<ID, { x: Milli; y: Milli }> = {};
      for (const id of selectedIds) {
        const p = draft.scene.pieces[id];
        if (p) {
          commitPositions[id] = { x: p.position.x, y: p.position.y };
        }
      }

      if (isGroupDrag) {
        // ─────────────────────────────────────────────────────────────
        // CONSTRUCTION D'UNE SCÈNE CANDIDATE AVANT VALIDATION
        // On applique le delta (dx,dy) à CHAQUE pièce sélectionnée,
        // puis on valide la scène candidate contre les voisins externes.
        // ─────────────────────────────────────────────────────────────
        const sceneCandidate: SceneDraft = JSON.parse(JSON.stringify(draft.scene));

        // Récupérer le delta uniforme issu du drag
        const dx = draft.ui.transientDelta?.dx ?? (0 as Milli);
        const dy = draft.ui.transientDelta?.dy ?? (0 as Milli);

        // Appliquer le delta aux positions commit des membres du groupe
        for (const id of selectedIds) {
          const p = sceneCandidate.pieces[id];
          if (!p) continue;
          const commitPos = commitPositions[id];
          if (!commitPos) continue;
          p.position = { x: (commitPos.x + dx) as Milli, y: (commitPos.y + dy) as Milli };
        }

        // Valider chevauchements: ignorer auto-collisions internes au groupe
        const overlapResult = validateNoOverlapForCandidateDraft(sceneCandidate, selectedIds);

        // Autres validations sur la scène candidate
        const insideResult = validateInsideScene(sceneCandidate);

        const allProblems = [
          ...(overlapResult.conflicts.map(([a, b]) => ({
            code: 'overlap_same_layer' as const,
            severity: 'BLOCK' as const,
            pieceIds: [a, b],
            message: 'Overlap detected'
          }))),
          ...(insideResult.outside.map(id => ({
            code: 'outside_scene' as const,
            severity: 'BLOCK' as const,
            pieceIds: [id],
            message: 'Outside scene bounds'
          }))),
        ];

        const hasBlock = allProblems.length > 0;

        if (hasBlock) {
          // Rollback: restaurer positions commit
          selectedIds.forEach((id) => {
            if (commitPositions[id] && draft.scene.pieces[id]) {
              draft.scene.pieces[id].position = commitPositions[id];
            }
          });

          draft.scene.validation = {
            ok: false,
            problems: allProblems
          };
          clearTransientUI(draft.ui);
          draft.ui.dragging = undefined;
          draft.ui.guides = undefined;
          draft.ui.flashInvalidAt = Date.now();
          return;
        }

        // Succès: commit des positions translatées
        for (const id of selectedIds) {
          const p = draft.scene.pieces[id];
          if (!p) continue;
          const commitPos = commitPositions[id];
          if (!commitPos) continue;
          p.position = { x: (commitPos.x + dx) as Milli, y: (commitPos.y + dy) as Milli };
        }
        draft.scene.validation = { ok: true, problems: [] };
        draft.scene.revision++;
        pushHistory(draft, snap);
        autosave(takeSnapshot(draft));
      } else {
        // Solo drag: existing logic
        let finalX = dragging.candidate.x;
        let finalY = dragging.candidate.y;

        if (ENABLE_GAP_NORMALIZATION && dragging.candidate.valid) {
          const candidateBBox = { x: finalX, y: finalY, w: dragging.candidate.w, h: dragging.candidate.h };
          const neighbors = Object.values(draft.scene.pieces).filter(p => !selectedIds.includes(p.id));

          const normalizeResult = normalizeGapToThreshold({
            subjectBBox: candidateBBox,
            neighbors,
            targetMm: NORMALIZE_GAP_TARGET_MM,
            epsilonMm: EPSILON_GAP_NORMALIZE_MM,
            sceneBounds: { w: draft.scene.size.w, h: draft.scene.size.h },
          });

          if (normalizeResult.didNormalize) {
            finalX += normalizeResult.dx;
            finalY += normalizeResult.dy;
          }
        }

        if (dragging.candidate.valid) {
          const piece = draft.scene.pieces[dragging.id];
          if (piece) {
            const piecePos = aabbToPiecePosition(finalX, finalY, piece);
            piece.position.x = piecePos.x;
            piece.position.y = piecePos.y;
          }
          draft.scene.revision++;
          pushHistory(draft, snap);
          autosave(takeSnapshot(draft));
        } else {
          draft.ui.flashInvalidAt = Date.now();
        }
      }

      draft.ui.dragging = undefined;
      draft.ui.guides = undefined;
      draft.ui.isTransientActive = false;
      draft.ui.transientBBox = undefined;
      draft.ui.transientDelta = undefined;
      draft.ui.transientOpsRev = (draft.ui.transientOpsRev ?? 0) + 1;
      bumpHandlesEpoch(draft);

      // If ghost is active, validate after drag
      const hasGhost = draft.ui.ghost !== undefined;
      if (hasGhost) {
        // Trigger validation async (after state update)
        Promise.resolve().then(() => {
          useSceneStore.getState().validateGhost().then(() => {
            // Auto-commit if no BLOCK problems
            const state = useSceneStore.getState();
            if (state.ui.ghost) {
              const hasBlock = state.ui.ghost.problems.some(p => p.severity === 'BLOCK');
              if (!hasBlock) {
                useSceneStore.getState().commitGhost();
              }
            }
          });
        });
      }
    })),

  cancelDrag: () =>
    set(produce((draft: SceneState) => {
      draft.ui.dragging = undefined;
      draft.ui.guides = undefined;
      draft.ui.isTransientActive = false;
      draft.ui.transientBBox = undefined;
      draft.ui.transientOpsRev = (draft.ui.transientOpsRev ?? 0) + 1;
      bumpHandlesEpoch(draft);
    })),

  addRectAtCenter: (w, h) =>
    set(produce((draft: SceneState) => {
      const snap = takeSnapshot(draft);

      // Utiliser le premier layer (pour l'instant)
      let layerId = draft.scene.layerOrder[0];
      if (!layerId) {
        // Créer un layer si absent
        layerId = genId('layer');
        draft.scene.layers[layerId] = {
          id: layerId,
          name: 'Calque 1',
          z: 0,
          pieces: [],
        };
        draft.scene.layerOrder.push(layerId);
      }

      // Utiliser le premier matériau
      let materialId = Object.keys(draft.scene.materials)[0];
      if (!materialId) {
        // Créer un matériau si absent
        materialId = genId('mat');
        draft.scene.materials[materialId] = {
          id: materialId,
          name: 'Matériau 1',
          oriented: false,
        };
      }

      // Créer la nouvelle pièce au centre
      const pieceId = genId('piece');
      const centerX = (draft.scene.size.w - w) / 2;
      const centerY = (draft.scene.size.h - h) / 2;

      const newPiece: Piece = {
        id: pieceId,
        layerId,
        materialId,
        position: { x: centerX, y: centerY },
        rotationDeg: 0,
        scale: { x: 1, y: 1 },
        kind: 'rect',
        size: { w, h },
      };

      draft.scene.pieces[pieceId] = newPiece;
      draft.scene.layers[layerId].pieces.push(pieceId);

      // Auto-sélectionner la nouvelle pièce
      draft.ui.selectedId = pieceId;

      pushHistory(draft, snap);
      autosave(takeSnapshot(draft));
      notifyAutoSpatial();
    })),

  deleteSelected: () =>
    set(produce((draft: SceneState) => {
      const selectedIds = draft.ui.selectedIds ?? (draft.ui.selectedId ? [draft.ui.selectedId] : []);
      if (selectedIds.length === 0) return;

      const snap = takeSnapshot(draft);

      for (const selectedId of selectedIds) {
        const piece = draft.scene.pieces[selectedId];
        if (!piece) continue;

        const layer = draft.scene.layers[piece.layerId];
        if (layer) {
          layer.pieces = layer.pieces.filter((id) => id !== selectedId);
        }

        delete draft.scene.pieces[selectedId];

        // Remove from spatial index if flag enabled
        if (window.__flags?.USE_GLOBAL_SPATIAL) {
          removePieceFromIndex(selectedId);
        }
      }

      // Clear transient UI before clearing selection
      clearTransientUI(draft.ui);

      draft.ui.selectedId = undefined;
      draft.ui.selectedIds = undefined;
      draft.ui.primaryId = undefined;

      pushHistory(draft, snap);
      autosave(takeSnapshot(draft));
      notifyAutoSpatial();
    })),

  setPieceMaterial: (pieceId, materialId) =>
    set(produce((draft: SceneState) => {
      const p = draft.scene.pieces[pieceId];
      if (p && draft.scene.materials[materialId]) {
        const snap = takeSnapshot(draft);
        p.materialId = materialId;
        // Clear transient UI after material change
        clearTransientUI(draft.ui);
        pushHistory(draft, snap);
        autosave(takeSnapshot(draft));
      }
    })),

  toggleJoined: (pieceId) =>
    set(produce((draft: SceneState) => {
      const p = draft.scene.pieces[pieceId];
      if (p) {
        p.joined = !p.joined;
        autosave(takeSnapshot(draft));
      }
    })),

  setSnap10mm: (on) =>
    set(produce((draft: SceneState) => {
      draft.ui.snap10mm = on;
    })),

  setMaterialOriented: (materialId, oriented) =>
    set(produce((draft: SceneState) => {
      const m = draft.scene.materials[materialId];
      if (m) {
        const snap = takeSnapshot(draft);
        m.oriented = oriented;
        if (!oriented) {
          // Retirer orientationDeg si on désactive oriented
          delete m.orientationDeg;
        } else if (m.orientationDeg === undefined) {
          // Initialiser à 0 par défaut
          m.orientationDeg = 0;
        }
        pushHistory(draft, snap);
        autosave(takeSnapshot(draft));
      }
    })),

  rotateSelected: (deltaDeg) =>
    set(produce((draft: SceneState) => {
      const selectedIds = draft.ui.selectedIds ?? (draft.ui.selectedId ? [draft.ui.selectedId] : []);
      if (selectedIds.length === 0) return;

      // Groupe (>1 pièce) → rotation rigide autour du pivot commun
      if (selectedIds.length > 1) {
        const candidate = buildRigidRotationCandidate(draft.scene, selectedIds, {
          deltaDeg: deltaDeg as 90 | -90,
        });
        const overlap = validateNoOverlapForCandidateDraft(candidate, selectedIds);
        const inside = validateInsideScene(candidate);

        if (!overlap.ok || !inside.ok) {
          draft.ui.flashInvalidAt = Date.now();
          return; // NO-OP
        }

        const snap = takeSnapshot(draft);
        draft.scene = candidate;
        clearTransientUI(draft.ui);
        draft.scene.revision++;
        bumpHandlesEpoch(draft);
        pushHistory(draft, snap);
        autosave(takeSnapshot(draft));
        return;
      }

      // Solo → rotation simple (pré-validation déjà en place)
      const nextDegById: Record<ID, Deg> = {};
      for (const id of selectedIds) {
        const piece = draft.scene.pieces[id];
        if (!piece) continue;
        const cur = (piece.rotationDeg ?? 0) as Deg;
        nextDegById[id] = (deltaDeg === 90 ? add90(cur) : sub90(cur)) as Deg;
      }

      const ok = rotationWouldBeValid(draft.scene, selectedIds, nextDegById);
      if (!ok) {
        draft.ui.flashInvalidAt = Date.now();
        return; // NO-OP
      }

      const snap = takeSnapshot(draft);
      for (const id of selectedIds) {
        const piece = draft.scene.pieces[id];
        if (!piece) continue;
        piece.rotationDeg = nextDegById[id]!;
      }

      clearTransientUI(draft.ui);
      draft.scene.revision++;
      bumpHandlesEpoch(draft);
      pushHistory(draft, snap);
      autosave(takeSnapshot(draft));
    })),

  setSelectedRotation: (deg) =>
    set(produce((draft: SceneState) => {
      const selectedIds = draft.ui.selectedIds ?? (draft.ui.selectedId ? [draft.ui.selectedId] : []);
      if (selectedIds.length === 0) return;

      // Groupe (>1 pièce) → rotation rigide autour du pivot commun
      if (selectedIds.length > 1) {
        const target = normDeg(deg) as Deg;
        const candidate = buildRigidRotationCandidate(draft.scene, selectedIds, {
          targetDeg: target,
        });
        const overlap = validateNoOverlapForCandidateDraft(candidate, selectedIds);
        const inside = validateInsideScene(candidate);

        if (!overlap.ok || !inside.ok) {
          draft.ui.flashInvalidAt = Date.now();
          return; // NO-OP
        }

        const snap = takeSnapshot(draft);
        draft.scene = candidate;
        clearTransientUI(draft.ui);
        draft.scene.revision++;
        bumpHandlesEpoch(draft);
        pushHistory(draft, snap);
        autosave(takeSnapshot(draft));
        return;
      }

      // Solo → rotation simple (pré-validation déjà en place)
      const target = normDeg(deg) as Deg;
      const nextDegById: Record<ID, Deg> = {};
      for (const id of selectedIds) {
        const piece = draft.scene.pieces[id];
        if (!piece) continue;
        nextDegById[id] = target;
      }

      const ok = rotationWouldBeValid(draft.scene, selectedIds, nextDegById);
      if (!ok) {
        draft.ui.flashInvalidAt = Date.now();
        return; // NO-OP
      }

      const snap = takeSnapshot(draft);
      for (const id of selectedIds) {
        const piece = draft.scene.pieces[id];
        if (!piece) continue;
        piece.rotationDeg = target;
      }

      clearTransientUI(draft.ui);
      draft.scene.revision++;
      bumpHandlesEpoch(draft);
      pushHistory(draft, snap);
      autosave(takeSnapshot(draft));
    })),

  duplicateSelected: () =>
    set(produce((draft: SceneState) => {
      const selectedIds = draft.ui.selectedIds ?? (draft.ui.selectedId ? [draft.ui.selectedId] : []);
      if (selectedIds.length === 0) return;

      const snap = takeSnapshot(draft);

      const offsetX = 20;
      const offsetY = 20;
      const newIds: ID[] = [];

      if (selectedIds.length === 1) {
        // Duplication simple
        const originalPiece = draft.scene.pieces[selectedIds[0]];
        if (!originalPiece) return;

        const newId = genId('piece');
        const bbox = pieceBBox(originalPiece); // Use rotation-aware AABB
        const clamped = clampToScene(
          originalPiece.position.x + offsetX,
          originalPiece.position.y + offsetY,
          bbox.w,
          bbox.h,
          draft.scene.size.w,
          draft.scene.size.h,
        );

        const newPiece: Piece = {
          ...originalPiece,
          id: newId,
          position: { x: clamped.x, y: clamped.y },
        };

        draft.scene.pieces[newId] = newPiece;
        draft.scene.layers[originalPiece.layerId]?.pieces.push(newId);
        newIds.push(newId);
      } else {
        // Duplication de groupe
        const bbox = groupBBox(draft.scene, selectedIds);
        const clamped = clampToScene(bbox.x + offsetX, bbox.y + offsetY, bbox.w, bbox.h, draft.scene.size.w, draft.scene.size.h);
        const groupDx = clamped.x - bbox.x;
        const groupDy = clamped.y - bbox.y;

        for (const selectedId of selectedIds) {
          const originalPiece = draft.scene.pieces[selectedId];
          if (!originalPiece) continue;

          const newId = genId('piece');
          const newPiece: Piece = {
            ...originalPiece,
            id: newId,
            position: {
              x: originalPiece.position.x + groupDx,
              y: originalPiece.position.y + groupDy,
            },
          };

          draft.scene.pieces[newId] = newPiece;
          draft.scene.layers[originalPiece.layerId]?.pieces.push(newId);
          newIds.push(newId);
        }
      }

      // Clear transient UI before changing selection
      clearTransientUI(draft.ui);

      draft.ui.selectedIds = newIds;
      draft.ui.selectedId = newIds[0];
      draft.ui.primaryId = newIds[0];

      pushHistory(draft, snap);
      autosave(takeSnapshot(draft));
    })),

  moveLayerForward: (layerId) =>
    set(produce((draft: SceneState) => {
      const idx = draft.scene.layerOrder.indexOf(layerId);
      if (idx === -1 || idx === draft.scene.layerOrder.length - 1) return;

      const snap = takeSnapshot(draft);

      // Swap with next
      [draft.scene.layerOrder[idx], draft.scene.layerOrder[idx + 1]] = [
        draft.scene.layerOrder[idx + 1],
        draft.scene.layerOrder[idx],
      ];

      pushHistory(draft, snap);
      autosave(takeSnapshot(draft));
    })),

  moveLayerBackward: (layerId) =>
    set(produce((draft: SceneState) => {
      const idx = draft.scene.layerOrder.indexOf(layerId);
      if (idx === -1 || idx === 0) return;

      const snap = takeSnapshot(draft);

      // Swap with previous
      [draft.scene.layerOrder[idx], draft.scene.layerOrder[idx - 1]] = [
        draft.scene.layerOrder[idx - 1],
        draft.scene.layerOrder[idx],
      ];

      pushHistory(draft, snap);
      autosave(takeSnapshot(draft));
    })),

  moveLayerToFront: (layerId) =>
    set(produce((draft: SceneState) => {
      const idx = draft.scene.layerOrder.indexOf(layerId);
      if (idx === -1 || idx === draft.scene.layerOrder.length - 1) return;

      const snap = takeSnapshot(draft);

      // Remove and push to end
      draft.scene.layerOrder.splice(idx, 1);
      draft.scene.layerOrder.push(layerId);

      pushHistory(draft, snap);
      autosave(takeSnapshot(draft));
    })),

  moveLayerToBack: (layerId) =>
    set(produce((draft: SceneState) => {
      const idx = draft.scene.layerOrder.indexOf(layerId);
      if (idx === -1 || idx === 0) return;

      const snap = takeSnapshot(draft);

      // Remove and unshift to beginning
      draft.scene.layerOrder.splice(idx, 1);
      draft.scene.layerOrder.unshift(layerId);

      pushHistory(draft, snap);
      autosave(takeSnapshot(draft));
    })),

  undo: () =>
    set(produce((draft: SceneState) => {
      if (!draft.ui.history || draft.ui.history.past.length === 0) return;

      const currentSnap = takeSnapshot(draft);
      const prevSnap = draft.ui.history.past.pop();
      if (!prevSnap) return;

      draft.ui.history.future.push(currentSnap);
      applySnapshot(draft, prevSnap);
      draft.scene.revision++;
      autosave(prevSnap);
    })),

  redo: () =>
    set(produce((draft: SceneState) => {
      if (!draft.ui.history || draft.ui.history.future.length === 0) return;

      const currentSnap = takeSnapshot(draft);
      const nextSnap = draft.ui.history.future.pop();
      if (!nextSnap) return;

      draft.ui.history.past.push(currentSnap);
      applySnapshot(draft, nextSnap);
      draft.scene.revision++;
      autosave(nextSnap);
    })),

  toSceneFileV1: () => {
    const state = useSceneStore.getState();
    const snap = takeSnapshot(state);
    return {
      version: 1,
      scene: snap.scene,
      ui: snap.ui,
    };
  },

  importSceneFileV1: (file) =>
    set(produce((draft: SceneState) => {
      // Validate file format
      if (!isSceneFileV1(file)) {
        throw new Error('Invalid scene file format (version non supportée ou structure invalide)');
      }

      // Normalize the file
      const normalized = normalizeSceneFileV1(file);

      // Take snapshot before import for history
      const snap = takeSnapshot(draft);

      // Apply the imported scene
      applySnapshot(draft, {
        scene: normalized.scene,
        ui: normalized.ui ?? {},
      });

      // Clear transient UI after scene replacement
      clearTransientUI(draft.ui);

      draft.scene.revision++;
      // Push to history and autosave
      pushHistory(draft, snap);
      autosave(takeSnapshot(draft));
    })),

  createDraft: () =>
    set(produce((draft: SceneState) => {
      const id = genId('draft');
      const name = newDraftName();
      const data = useSceneStore.getState().toSceneFileV1();
      const jsonString = JSON.stringify(data);

      const meta: DraftMeta = {
        id,
        name,
        updatedAt: new Date().toISOString(),
        bytes: jsonString.length,
      };

      saveDraft(meta, data);
    })),

  saveToDraft: (id) =>
    set(produce((draft: SceneState) => {
      const data = useSceneStore.getState().toSceneFileV1();
      const jsonString = JSON.stringify(data);

      const existing = loadDraft(id);
      if (!existing) return;

      const meta: DraftMeta = {
        id,
        name: existing.meta.name,
        updatedAt: new Date().toISOString(),
        bytes: jsonString.length,
      };

      saveDraft(meta, data);
    })),

  loadDraftById: (id) =>
    set(produce((draft: SceneState) => {
      const loaded = loadDraft(id);
      if (!loaded) {
        console.warn(`[drafts] Draft ${id} not found`);
        return;
      }

      // Validate loaded data
      if (!isSceneFileV1(loaded.data)) {
        console.warn(`[drafts] Draft ${id} has invalid format`);
        return;
      }

      // Normalize the file
      const normalized = normalizeSceneFileV1(loaded.data);

      // Take snapshot before load for history
      const snap = takeSnapshot(draft);

      // Apply the loaded scene
      applySnapshot(draft, {
        scene: normalized.scene,
        ui: normalized.ui ?? {},
      });

      // Clear transient UI after scene replacement
      clearTransientUI(draft.ui);

      draft.scene.revision++;
      // Push to history and autosave
      pushHistory(draft, snap);
      autosave(takeSnapshot(draft));
    })),

  renameDraft: (id, name) =>
    set(produce((draft: SceneState) => {
      upsertDraftName(id, name);
    })),

  deleteDraftById: (id) =>
    set(produce((draft: SceneState) => {
      deleteDraftFromStorage(id);
    })),

  startResize: (pieceId, handle, startPointerMm) =>
    set(produce((draft: SceneState) => {
      const piece = draft.scene.pieces[pieceId];
      if (!piece) return;

      // Capture pre-resize state for history
      const snapshot = takeSnapshot(draft);

      // Use center of piece as default start pointer if not provided
      const defaultStart = {
        x: piece.position.x + piece.size.w / 2,
        y: piece.position.y + piece.size.h / 2,
      };

      // Calculate baseline gaps for neighboring pieces (for orthogonal filtering)
      const baseline: Record<string, { axis: 'X' | 'Y'; gap: number }> = {};
      const sceneV1 = projectDraftToV1({ scene: draft.scene });
      const pieceAABB = getRotatedAABB({
        id: pieceId,
        x: piece.position.x,
        y: piece.position.y,
        w: piece.size.w,
        h: piece.size.h,
        rot: piece.rotationDeg ?? 0,
        layerId: piece.layerId,
        materialId: piece.materialId,
        joined: piece.joined,
      });

      // Find all pieces on same layer (excluding self)
      const neighbors = sceneV1.pieces.filter(p => p.id !== pieceId && p.layerId === piece.layerId);

      for (const neighbor of neighbors) {
        const neighborAABB = getRotatedAABB(neighbor);
        const gap = aabbGapLocal(pieceAABB, neighborAABB);
        const axis = dominantSpacingAxisLocal(pieceAABB, neighborAABB);
        baseline[neighbor.id] = { axis, gap };
      }

      draft.ui.resizing = {
        pieceId,
        handle,
        origin: {
          x: piece.position.x,
          y: piece.position.y,
          w: piece.size.w,
          h: piece.size.h,
        },
        startPointerMm: startPointerMm || defaultStart,
        rotationDeg: piece.rotationDeg,
        snapshot,
        baseline,
      };
    })),

  updateResize: (pointerMm) =>
    set(produce((draft: SceneState) => {
      const resizing = draft.ui.resizing;
      if (!resizing) return;

      const piece = draft.scene.pieces[resizing.pieceId];
      if (!piece) return;

      const lockEdge = draft.ui.lockEdge ?? false;

      // Apply handle with rotation support
      const newRect = applyHandleWithRotation(
        resizing.origin,
        resizing.handle,
        resizing.startPointerMm,
        pointerMm,
        resizing.rotationDeg,
        { minW: 5, minH: 5, lockEdge }
      );

      // Clamp to scene bounds
      const sceneW = draft.scene.size.w;
      const sceneH = draft.scene.size.h;

      let { x, y, w, h } = newRect;

      // Ensure rect stays within scene
      if (x < 0) {
        w += x; // Reduce width by amount outside
        x = 0;
      }
      if (y < 0) {
        h += y; // Reduce height by amount outside
        y = 0;
      }
      if (x + w > sceneW) {
        w = sceneW - x;
      }
      if (y + h > sceneH) {
        h = sceneH - y;
      }

      // Reapply min size after clamping
      w = Math.max(5, w);
      h = Math.max(5, h);

      // Snap to pieces (edges and centers)
      const candidateRect = { x, y, w, h };
      const snapResult = snapToPieces(draft.scene, candidateRect, 5, resizing.pieceId);
      draft.ui.guides = snapResult.guides;

      x = snapResult.x;
      y = snapResult.y;

      // Snap to grid if enabled
      if (draft.ui.snap10mm) {
        x = snapTo10mm(x);
        y = snapTo10mm(y);
        w = snapTo10mm(w);
        h = snapTo10mm(h);
      }

      // Final minSize enforcement (5mm always, regardless of snap state)
      // Must respect lockEdge: the opposite edge should stay fixed
      const MIN_SIZE = 5;

      if (w < MIN_SIZE) {
        const deficit = MIN_SIZE - w;
        w = MIN_SIZE;

        // Adjust position to keep locked edge fixed
        if (lockEdge) {
          // If handle includes 'w' (moving left edge), adjust x left
          if (resizing.handle.includes('w')) {
            x -= deficit;
          }
          // If handle includes 'e' (moving right edge), x stays (right edge moved)
          // No adjustment needed - locked left edge stays at x
        }
      }

      if (h < MIN_SIZE) {
        const deficit = MIN_SIZE - h;
        h = MIN_SIZE;

        // Adjust position to keep locked edge fixed
        if (lockEdge) {
          // If handle includes 'n' (moving top edge), adjust y up
          if (resizing.handle.includes('n')) {
            y -= deficit;
          }
          // If handle includes 's' (moving bottom edge), y stays (bottom edge moved)
          // No adjustment needed - locked top edge stays at y
        }
      }

      // Update piece (without history - preview only)
      piece.position.x = x;
      piece.position.y = y;
      piece.size.w = w;
      piece.size.h = h;

      // Sync to spatial index if flag enabled
      if (window.__flags?.USE_GLOBAL_SPATIAL) {
        syncPieceToIndex(resizing.pieceId, { x, y, w, h });
      }

      // Calculer transientBBox pour tooltip temps réel pendant resize
      draft.ui.transientBBox = { x, y, w, h, rotationDeg: piece.rotationDeg };
      draft.ui.isTransientActive = true;

      // Capture resizing piece ID and candidate geometry before async operation
      // (Immer proxy becomes invalid after produce)
      const resizingPieceId = resizing.pieceId;
      const candidateGeometry = {
        x,
        y,
        w,
        h,
        rotationDeg: piece.rotationDeg ?? 0,
      };

      // EPS throttle: only validate if cursor moved ≥ EPS_UI_MM since last validation
      // First update (no last validation) always validates
      const lastValidateMm = resizing._lastResizeValidateMm;
      const shouldValidate = !lastValidateMm || distance(pointerMm, lastValidateMm) >= EPS_UI_MM;

      if (shouldValidate) {
        // Update last validation position
        draft.ui.resizing!._lastResizeValidateMm = { x: pointerMm.x, y: pointerMm.y };
      }

      // Validate resize preview asynchronously (don't block UI)
      // Skip validation if cursor movement below EPS threshold
      if (shouldValidate) {
        Promise.resolve().then(async () => {
          const currentState = useSceneStore.getState();

          // Only validate if still resizing the same piece
          if (currentState.ui.resizing?.pieceId !== resizingPieceId) return;

        // Project current scene to V1 for validation
        const sceneV1 = projectDraftToV1({ scene: currentState.scene });

        // Build ResizeContext for filtering false positives
        const resizeContext: ResizeContext = {
          moved: handleToMoved(currentState.ui.resizing!.handle),
          eps: 0.10,
          baseline: currentState.ui.resizing!.baseline,
        };

        // Validate candidate geometry (not store state) with resize context
        const collisionResult = collisionsForCandidate(resizingPieceId, candidateGeometry, sceneV1, resizeContext);
        const spacingProblems = spacingForCandidate(resizingPieceId, candidateGeometry, sceneV1, resizeContext);

        // Combine problems
        const pieceProblems: Problem[] = [];

        if (collisionResult.overlap) {
          // Add overlap problems for each colliding neighbor
          for (const neighborId of collisionResult.neighbors) {
            pieceProblems.push({
              code: 'overlap_same_layer',
              severity: 'BLOCK',
              pieceId: resizingPieceId,
              message: 'Pieces overlap on the same layer',
              meta: { otherPieceId: neighborId },
            });
          }
        }

        // Add spacing problems
        pieceProblems.push(...spacingProblems);

        const hasBlock = pieceProblems.some(p => p.severity === 'BLOCK');

        // Update ghost state
        useSceneStore.setState(
          produce((draft: SceneState) => {
            // Only update if still resizing the same piece
            if (draft.ui.resizing?.pieceId !== resizingPieceId) return;

            if (hasBlock) {
              // Activate ghost mode with problems
              draft.ui.ghost = {
                pieceId: resizingPieceId,
                problems: pieceProblems,
                startedAt: Date.now(),
              };
              incResizeBlockPreview();
            } else {
              // Clear ghost if no blocking problems
              if (draft.ui.ghost?.pieceId === resizingPieceId) {
                draft.ui.ghost = undefined;
              }
            }
          })
        );
        });
      }
    })),

  endResize: (commit) =>
    set(produce((draft: SceneState) => {
      const resizing = draft.ui.resizing;
      if (!resizing) return;

      const piece = draft.scene.pieces[resizing.pieceId];

      if (commit && piece) {
        // Check if dimensions actually changed
        const changed =
          piece.position.x !== resizing.origin.x ||
          piece.position.y !== resizing.origin.y ||
          piece.size.w !== resizing.origin.w ||
          piece.size.h !== resizing.origin.h;

        // Revalidate candidate geometry before committing
        // (in case snap or other operations changed the geometry after last async validation)
        const candidateRect = {
          x: piece.position.x,
          y: piece.position.y,
          w: piece.size.w,
          h: piece.size.h,
          rotationDeg: piece.rotationDeg ?? 0,
        };

        // Project scene to V1 for validation
        const sceneV1 = projectDraftToV1({ scene: draft.scene });

        // Build ResizeContext for validation (same as updateResize)
        const resizeContext: ResizeContext = {
          moved: handleToMoved(resizing.handle),
          eps: 0.10,
          baseline: resizing.baseline,
        };

        // Synchronous validation at commit time with resize context
        const collisionResult = collisionsForCandidate(resizing.pieceId, candidateRect, sceneV1, resizeContext);
        const spacingProblems = spacingForCandidate(resizing.pieceId, candidateRect, sceneV1, resizeContext);

        // NEW POLICY: Only block on actual overlap (gap < 0), not on spacing WARN
        // Border-to-border (gap = 0) is allowed during resize
        const hasOverlap = collisionResult.overlap;
        // spacingProblems with context should only contain WARN (not BLOCK) for gap >= 0
        // But check for other BLOCK problems (outside_scene, min_size, etc.)
        const hasBlock = hasOverlap;

        if (hasBlock) {
          // Don't commit - rollback to origin
          // User must resize again to valid position
          piece.position.x = resizing.origin.x;
          piece.position.y = resizing.origin.y;
          piece.size.w = resizing.origin.w;
          piece.size.h = resizing.origin.h;

          draft.ui.toast = {
            message: 'Resize bloqué : chevauchement détecté. Les pièces ne peuvent pas se chevaucher.',
            until: Date.now() + 3000,
          };

          // Clear ghost and resizing state
          draft.ui.ghost = undefined;
          draft.ui.resizing = undefined;
          draft.ui.guides = undefined;

          incResizeBlockCommitBlocked();
          return;
        }

        if (changed) {
          // No BLOCK problems - commit normally
          // Push pre-resize snapshot to history
          draft.scene.revision++;
          pushHistory(draft, resizing.snapshot);
          autosave(takeSnapshot(draft));

          // Clear ghost if present
          if (draft.ui.ghost?.pieceId === resizing.pieceId) {
            draft.ui.ghost = undefined;
          }

          incResizeBlockCommitSuccess();
        }
      } else if (!commit && piece) {
        // Rollback to origin (Escape pressed)
        piece.position.x = resizing.origin.x;
        piece.position.y = resizing.origin.y;
        piece.size.w = resizing.origin.w;
        piece.size.h = resizing.origin.h;

        // Clear ghost on rollback
        if (draft.ui.ghost?.pieceId === resizing.pieceId) {
          draft.ui.ghost = undefined;
        }
      }

      draft.ui.resizing = undefined;
      draft.ui.guides = undefined;
      draft.ui.isTransientActive = false;
      draft.ui.transientBBox = undefined;
      // Baseline is cleared with resizing state
    })),

  setLockEdge: (on) =>
    set(produce((draft: SceneState) => {
      draft.ui.lockEdge = on;
    })),

  focusPiece: (id) =>
    set(produce((draft: SceneState) => {
      draft.ui.effects = draft.ui.effects || {};
      draft.ui.effects.focusId = id;
    })),

  flashOutline: (id) =>
    set(produce((draft: SceneState) => {
      draft.ui.effects = draft.ui.effects || {};
      draft.ui.effects.flashId = id;
      draft.ui.effects.flashUntil = Date.now() + 500;
    })),

  startGroupResize: (handle, startPointerMm) =>
    set(produce((draft: SceneState) => {
      const selectedIds = draft.ui.selectedIds ?? (draft.ui.selectedId ? [draft.ui.selectedId] : []);
      if (selectedIds.length < 2) return;

      // Calcul du pivot (centre de la bbox union)
      const pivot = groupPivot(draft.scene, selectedIds);

      // Snapshot pour rollback possible
      const startSnapshot = takeSnapshot(draft);

      // Point de départ du curseur (ou centre du groupe par défaut)
      const defaultStart = {
        x: pivot.x,
        y: pivot.y,
      };
      const startPointer = startPointerMm || defaultStart;

      // Rayon initial (distance pivot → curseur)
      const startRadius = distance(pivot, startPointer);

      // Calculer bbox initiale et diagonale pour precision dynamique
      const { L, R, T, B } = groupExtentsAroundPivot(draft.scene, selectedIds, pivot);
      const groupW = L + R;
      const groupH = T + B;
      const groupDiagMm = Math.hypot(groupW, groupH);
      const bbox: { x: Milli; y: Milli; w: Milli; h: Milli } = {
        x: (pivot.x - L) as Milli,
        y: (pivot.y - T) as Milli,
        w: groupW as Milli,
        h: groupH as Milli,
      };

      draft.ui.groupResizing = {
        isResizing: true,
        pivot,
        startSnapshot,
        startPointer,
        startRadius,
        lastScale: 1,
        preview: {
          scale: 1,
          bbox,
          selectedIds,
          groupDiagMm,
        },
      };
      draft.ui.isTransientActive = true;
      draft.ui.transientOpsRev = (draft.ui.transientOpsRev ?? 0) + 1;
    })),

  updateGroupResize: (pointerMm, altKey = false) => {
    // Schedule update via RAF to throttle pointermove events (1 update/frame)
    scheduleGroupResize(
      (args) => useSceneStore.getState()._updateGroupResizeRafSafe(args),
      { pointer: pointerMm, altKey }
    );
  },

  // RAF-safe internal update (called once per frame, mutates only preview)
  _updateGroupResizeRafSafe: ({pointer, altKey}: {pointer: {x: Milli; y: Milli}; altKey: boolean}) =>
    set(produce((draft: SceneState) => {
      const resizing = draft.ui.groupResizing;
      if (!resizing?.isResizing || !resizing.preview) return;

      const selectedIds = resizing.preview.selectedIds;
      if (selectedIds.length < 2) return;

      const { pivot, startRadius, preview } = resizing;

      // Calcul du facteur de scale basé sur la distance radiale
      const currentRadius = distance(pivot, pointer);
      const sRaw = currentRadius / Math.max(1 as Milli, startRadius);

      // Dynamic precision based on group size
      // base = 0.25% of diagonal (min 0.5mm), Alt = 4× finer
      const groupRadiusMm = startRadius;
      const base = Math.max(0.5, 0.0025 * preview.groupDiagMm);
      const precisionMm = altKey ? base * 0.25 : base;
      const precisionScale = precisionMm / groupRadiusMm;
      const sSmooth = Math.round(sRaw / precisionScale) * precisionScale;

      // Analytical clamp: calculate max scale to keep group inside scene bounds
      const { L, R, T, B } = groupExtentsAroundPivot(draft.scene, selectedIds, pivot);
      const sceneW = draft.scene.size.w;
      const sceneH = draft.scene.size.h;

      // Calculate max scale factors for each boundary
      const sMaxLeft = L > 0 ? pivot.x / L : Infinity;
      const sMaxRight = R > 0 ? (sceneW - pivot.x) / R : Infinity;
      const sMaxTop = T > 0 ? pivot.y / T : Infinity;
      const sMaxBottom = B > 0 ? (sceneH - pivot.y) / B : Infinity;
      const sMaxScene = Math.min(sMaxLeft, sMaxRight, sMaxTop, sMaxBottom);

      // Calculate min scale from piece min sizes (5mm)
      const MIN_SIZE_MM = 5 as Milli;
      let sMinPieces = 0;
      for (const id of selectedIds) {
        const p = draft.scene.pieces[id];
        if (!p) continue;
        const minDim = Math.min(p.size.w, p.size.h);
        const sMin = MIN_SIZE_MM / minDim;
        sMinPieces = Math.max(sMinPieces, sMin);
      }

      // Apply all clamps: clamp to [sMinPieces, sMaxScene]
      const scale = Math.max(sMinPieces, Math.min(sMaxScene, sSmooth));

      // Update ONLY the preview (no scene mutation during drag)
      resizing.preview.scale = scale;
      resizing.preview.bbox = {
        x: (pivot.x - L * scale) as Milli,
        y: (pivot.y - T * scale) as Milli,
        w: ((L + R) * scale) as Milli,
        h: ((T + B) * scale) as Milli,
      };
      resizing.lastScale = scale;

      // Compute preview matrices for each piece (live visual transform)
      // Matrix represents: translate(pivot) * scale(s) * translate(-pivot)
      // This gives the visual transform without mutating scene.pieces
      const previewPieces: Array<{
        id: ID;
        matrix: { a: number; b: number; c: number; d: number; e: number; f: number };
      }> = [];

      for (const id of selectedIds) {
        const p = draft.scene.pieces[id];
        if (!p) continue;

        // Simple isotropic scale about pivot
        // matrix = T(pivot) * S(scale) * T(-pivot)
        const a = scale;
        const d = scale;
        const e = pivot.x * (1 - scale);
        const f = pivot.y * (1 - scale);

        previewPieces.push({
          id,
          matrix: { a, b: 0, c: 0, d, e, f },
        });
      }

      resizing.preview.previewPieces = previewPieces;
    })),

  // Legacy implementation disabled
  _updateGroupResize_disabled: (pointerMm) => {
    set(produce((draft: SceneState) => {
      const resizing = draft.ui.groupResizing;
      if (!resizing) return;

      const selectedIds = draft.ui.selectedIds ?? (EMPTY_ARR as ID[]);
      if (selectedIds.length < 2) return;

      const { originBBox, startPointerMm, handle, pieceOrigins } = resizing;

      // Calculate delta
      const dx = pointerMm.x - startPointerMm.x;
      const dy = pointerMm.y - startPointerMm.y;

      // Apply handle to bbox
      let newW = originBBox.w;
      let newH = originBBox.h;
      let newX = originBBox.x;
      let newY = originBBox.y;

      if (handle.includes('e')) newW = Math.max(10, originBBox.w + dx);
      if (handle.includes('w')) { newW = Math.max(10, originBBox.w - dx); newX = originBBox.x + originBBox.w - newW; }
      if (handle.includes('s')) newH = Math.max(10, originBBox.h + dy);
      if (handle.includes('n')) { newH = Math.max(10, originBBox.h - dy); newY = originBBox.y + originBBox.h - newH; }

      // Calculate scale factors
      let sx = newW / Math.max(originBBox.w, 1);
      let sy = newH / Math.max(originBBox.h, 1);

      // Clamp scale factors to respect minSize (5mm) per piece
      const MIN = 5;
      for (const id of selectedIds) {
        const orig = pieceOrigins[id];
        if (!orig) continue;
        const candW = orig.w * sx;
        const candH = orig.h * sy;
        if (candW < MIN) sx = Math.max(sx, MIN / orig.w);
        if (candH < MIN) sy = Math.max(sy, MIN / orig.h);
      }

      // Apply scale to each piece around bbox center
      const cx = originBBox.x + originBBox.w / 2;
      const cy = originBBox.y + originBBox.h / 2;

      for (const id of selectedIds) {
        const orig = pieceOrigins[id];
        if (!orig) continue;

        const piece = draft.scene.pieces[id];
        if (!piece) continue;

        // Scale position and size around center
        const nx = cx + (orig.x - cx) * sx;
        const ny = cy + (orig.y - cy) * sy;
        const nw = Math.max(MIN, orig.w * sx);
        const nh = Math.max(MIN, orig.h * sy);

        piece.position.x = nx;
        piece.position.y = ny;
        piece.size.w = nw;
        piece.size.h = nh;
      }

      // Recompute bbox
      computeGroupBBox(draft);
    }));

    // Trigger async validation after state update
    useSceneStore.getState().validateGroupResize();
  },

  // Async validation for group resize (separate function to avoid Immer proxy issues)
  validateGroupResize: () => {
    Promise.resolve().then(() => {
      const currentState = useSceneStore.getState();
      if (!currentState.ui.groupResizing) return;

      const resizing = currentState.ui.groupResizing;
      const selectedIds = currentState.ui.selectedIds ?? (EMPTY_ARR as ID[]);

      // Project current scene to V1 for validation
      const sceneV1 = projectDraftToV1({ scene: currentState.scene });

      // Build validation context
      const ctx: ResizeContext = {
        moved: handleToMoved(resizing.handle),
        kind: 'group',
        memberIds: resizing.memberIds,
        baseline: resizing.baseline,
        eps: 0.5,
      };

      // Validate all members and aggregate problems
      const allProblems: Problem[] = [];

      for (const id of selectedIds) {
        const piece = currentState.scene.pieces[id];
        if (!piece) continue;

        const candidateRect = {
          x: piece.position.x,
          y: piece.position.y,
          w: piece.size.w,
          h: piece.size.h,
          rotationDeg: piece.rotationDeg ?? 0,
        };

        const collisionResult = collisionsForCandidate(id, candidateRect, sceneV1, ctx);
        const spacingProblems = spacingForCandidate(id, candidateRect, sceneV1, ctx);

        // Add overlap problems
        if (collisionResult.overlap) {
          for (const neighborId of collisionResult.neighbors) {
            allProblems.push({
              code: 'overlap_same_layer',
              level: 'BLOCK',
              pieceId: id,
              message: 'Pieces overlap on the same layer',
              meta: { otherPieceId: neighborId },
            });
          }
        }

        // Add spacing problems
        allProblems.push(...spacingProblems);
      }

      const hasBlock = allProblems.some(p => p.level === 'BLOCK');
      const currentGroupBBox = currentState.ui.groupBBox;
      useSceneStore.getState().updateGroupResizeGhost(
        hasBlock ? allProblems : null,
        currentGroupBBox
      );
    }).catch(err => {
      console.warn('[validateGroupResize] error:', err);
    });
  },

  updateGroupResizeGhost: (problems: Problem[] | null, groupBBox: { x: Milli; y: Milli; w: Milli; h: Milli }) =>
    set(produce((draft: SceneState) => {
      if (!draft.ui.groupResizing) return;

      const selectedIds = draft.ui.selectedIds ?? (EMPTY_ARR as ID[]);
      if (selectedIds.length < 2) return;

      if (problems && problems.length > 0) {
        // Set ghost for the first piece in group (for visualization purposes)
        const firstPieceId = selectedIds[0];
        draft.ui.ghost = {
          pieceId: firstPieceId,
          problems,
          startedAt: Date.now(),
        };

        // Track metric for group resize blocking
        incResizeBlockPreview();
      } else {
        // Clear ghost if no problems
        if (draft.ui.ghost && selectedIds.includes(draft.ui.ghost.pieceId)) {
          draft.ui.ghost = undefined;
        }
      }

      // Update groupBBox to keep handles in sync
      draft.ui.groupBBox = groupBBox;
    })),

  endGroupResize: (commit) =>
    set(produce((draft: SceneState) => {
      const resizing = draft.ui.groupResizing;
      if (!resizing?.isResizing) return;

      const selectedIds = draft.ui.selectedIds ?? (EMPTY_ARR as ID[]);
      if (selectedIds.length < 2) {
        draft.ui.groupResizing = undefined;
        draft.ui.isTransientActive = false;
        return;
      }

      if (!commit) {
        // Cancel: restore from snapshot
        draft.scene = resizing.startSnapshot.scene;
        draft.ui.groupResizing = undefined;
        draft.ui.isTransientActive = false;
        draft.ui.transientOpsRev = (draft.ui.transientOpsRev ?? 0) + 1;
        computeGroupBBox(draft);
        return;
      }

      // Commit: recalculer avec le dernier scale pour refaire validation finale
      const { pivot, lastScale } = resizing;
      const scale = lastScale ?? 1;

      const candidate = buildGroupScaleCandidate(draft.scene, selectedIds, pivot, scale);

      // Validation finale (même logique que updateGroupResize)
      const MIN_SIZE_MM = 5 as Milli;
      let hasMinSizeViolation = false;
      for (const id of selectedIds) {
        const p = candidate.pieces[id];
        if (!p) continue;
        if (p.size.w < MIN_SIZE_MM || p.size.h < MIN_SIZE_MM) {
          hasMinSizeViolation = true;
          break;
        }
      }

      const insideOk = validateInsideScene(candidate, selectedIds);
      const overlapOk = validateNoOverlapForCandidateDraft(candidate, selectedIds).ok;
      const isValid = !hasMinSizeViolation && insideOk && overlapOk;

      if (!isValid) {
        // Rollback + flash
        draft.scene = resizing.startSnapshot.scene;
        draft.ui.flashInvalidAt = Date.now();
      } else {
        // Commit OK
        draft.scene = candidate;
        draft.scene.revision++;
        pushHistory(draft, resizing.startSnapshot);
        autosave(takeSnapshot(draft));
      }

      // Cancel any pending RAF callback to prevent late updates
      cancelGroupResizeRaf();

      // Clear all group resize UI state
      draft.ui.groupResizing = undefined;
      draft.ui.isTransientActive = false;
      draft.ui.transientOpsRev = (draft.ui.transientOpsRev ?? 0) + 1;

      // Clear ghost if it was for any of the selected pieces
      if (draft.ui.ghost && selectedIds.includes(draft.ui.ghost.pieceId)) {
        draft.ui.ghost = undefined;
      }

      bumpHandlesEpoch(draft);
      computeGroupBBox(draft);
    })),

  cancelGroupResize: () => {
    // Cancel any pending RAF callback immediately
    cancelGroupResizeRaf();

    set(produce((draft: SceneState) => {
      const resizing = draft.ui.groupResizing;
      if (!resizing?.isResizing) return;

      const selectedIds = draft.ui.selectedIds ?? (EMPTY_ARR as ID[]);

      // Restore from snapshot
      draft.scene = resizing.startSnapshot.scene;

      // Clear all group resize UI state
      draft.ui.groupResizing = undefined;
      draft.ui.isTransientActive = false;
      draft.ui.transientOpsRev = (draft.ui.transientOpsRev ?? 0) + 1;

      // Clear ghost if it was for any of the selected pieces
      if (draft.ui.ghost && selectedIds.includes(draft.ui.ghost.pieceId)) {
        draft.ui.ghost = undefined;
      }

      bumpHandlesEpoch(draft);
      computeGroupBBox(draft);
    }));
  },

  /**
   * Helper: find a free spot for a piece by testing positions in a spiral pattern.
   * Returns {x, y, verdict} if found, null if no valid position exists.
   * Verdict: 'OK' (no problems), 'WARN' (warnings only), 'BLOCK' (blocking problems).
   */
  findFreeSpot: async (w: number, h: number): Promise<{ x: number; y: number; verdict: 'OK' | 'WARN' | 'BLOCK' } | null> => {
    const { projectDraftToV1 } = await import('../sync/projector');
    const { validateOverlapsAsync } = await import('../core/geo/facade');

    const currentState = useSceneStore.getState();
    const sceneW = currentState.scene.size.w;
    const sceneH = currentState.scene.size.h;
    const GRID_STEP = 10; // mm
    const PAD = 10; // padding from edges

    // Helper: generate spiral positions covering the entire scene
    function* spiralPositions() {
      let x = PAD;
      let y = PAD;
      let dx = 0;
      let dy = -GRID_STEP;
      let segmentLength = 1;
      let segmentPassed = 0;
      let directionChanges = 0;

      // Generate positions until we cover the scene
      // Stop when we've gone far beyond scene bounds
      const maxDim = Math.max(sceneW, sceneH) * 2;
      let iterations = 0;
      const maxIterations = (maxDim / GRID_STEP) ** 2;

      while (iterations < maxIterations) {
        // Yield position if it's within valid bounds
        if (x >= 0 && x + w <= sceneW && y >= 0 && y + h <= sceneH) {
          yield { x, y };
        }

        // Move to next position in spiral
        x += dx;
        y += dy;
        segmentPassed++;

        if (segmentPassed === segmentLength) {
          segmentPassed = 0;
          // Turn 90° clockwise
          const temp = dx;
          dx = -dy;
          dy = temp;
          directionChanges++;

          if (directionChanges % 2 === 0) {
            segmentLength++;
          }
        }

        iterations++;
      }
    }

    // Helper: check if placement is OK/WARN/BLOCK
    async function checkPlacement(x: number, y: number): Promise<'OK' | 'WARN' | 'BLOCK'> {
      const tempId = 'temp-test-piece';
      const layerId = currentState.scene.layerOrder[0];
      if (!layerId) return 'BLOCK';

      // Create test draft (deep clone to avoid mutations)
      const testDraft: SceneDraft = JSON.parse(JSON.stringify(currentState.scene));
      testDraft.pieces[tempId] = {
        id: tempId,
        layerId,
        materialId: Object.keys(testDraft.materials)[0] || '',
        position: { x, y },
        rotationDeg: 0,
        scale: { x: 1, y: 1 },
        kind: 'rect',
        size: { w, h },
      };

      try {
        const sceneV1 = projectDraftToV1({ scene: testDraft });
        const problems = await validateOverlapsAsync(sceneV1);

        // Check problems for this piece
        const hasBlock = problems.some(p => p.severity === 'BLOCK');
        const hasWarn = problems.some(p => p.severity === 'WARN');

        if (hasBlock) return 'BLOCK';
        if (hasWarn) return 'WARN';
        return 'OK';
      } catch (err) {
        // Treat errors as BLOCK
        return 'BLOCK';
      }
    }

    // Search for best position: prefer OK, fallback to WARN
    let bestWarn: { x: number; y: number; verdict: 'WARN' } | null = null;

    for (const pos of spiralPositions()) {
      const verdict = await checkPlacement(pos.x, pos.y);

      if (verdict === 'OK') {
        // Found perfect spot
        return { x: pos.x, y: pos.y, verdict: 'OK' };
      }

      if (verdict === 'WARN' && !bestWarn) {
        // Remember first WARN position as fallback
        bestWarn = { x: pos.x, y: pos.y, verdict: 'WARN' };
      }
    }

    // Return WARN position if found, otherwise null
    return bestWarn;
  },

  insertRect: async (opts) => {
    const { projectDraftToV1 } = await import('../sync/projector');
    const { validateOverlapsAsync } = await import('../core/geo/facade');

    // Get current state
    const currentState = useSceneStore.getState();
    const snap = takeSnapshot(currentState);

    // Enforce min 5mm and round values
    const w = Math.max(5, Math.round(opts.w));
    const h = Math.max(5, Math.round(opts.h));

    // Apply snap to 10mm if enabled
    const finalW = currentState.ui.snap10mm ? snapTo10mm(w) : w;
    const finalH = currentState.ui.snap10mm ? snapTo10mm(h) : h;

    // Find a free spot or use provided position
    let targetX: number;
    let targetY: number;

    if (opts.x !== undefined && opts.y !== undefined) {
      // Use provided position
      targetX = opts.x;
      targetY = opts.y;
    } else {
      // Auto-find free spot
      const freeSpot = await useSceneStore.getState().findFreeSpot(finalW, finalH);
      if (!freeSpot) {
        // No free spot found - start ghost insert instead
        return await useSceneStore.getState().startGhostInsert({
          w: finalW,
          h: finalH,
          layerId: opts.layerId,
          materialId: opts.materialId,
        });
      }
      targetX = freeSpot.x;
      targetY = freeSpot.y;
    }

    const clamped = clampToScene(targetX, targetY, finalW, finalH, currentState.scene.size.w, currentState.scene.size.h);

    // Get active layer (first layer) or create one
    let layerId = opts.layerId ?? currentState.scene.layerOrder[0];
    let materialId = opts.materialId ?? Object.keys(currentState.scene.materials)[0];

    // Create piece ID upfront
    const pieceId = genId('piece');

    // Add piece synchronously
    set(produce((draft: SceneState) => {
      // Create layer if needed
      if (!layerId) {
        layerId = genId('layer');
        draft.scene.layers[layerId] = {
          id: layerId,
          name: 'Calque 1',
          z: 0,
          pieces: [],
        };
        draft.scene.layerOrder.push(layerId);
      }

      // Create material if needed
      if (!materialId) {
        materialId = genId('mat');
        draft.scene.materials[materialId] = {
          id: materialId,
          name: 'Matériau 1',
          oriented: false,
        };
      }

      // Create new piece
      const newPiece: Piece = {
        id: pieceId,
        layerId,
        materialId,
        position: { x: clamped.x, y: clamped.y },
        rotationDeg: 0,
        scale: { x: 1, y: 1 },
        kind: 'rect',
        size: { w: finalW, h: finalH },
      };

      draft.scene.pieces[pieceId] = newPiece;
      draft.scene.layers[layerId].pieces.push(pieceId);

      // Sync to spatial index if flag enabled
      if (window.__flags?.USE_GLOBAL_SPATIAL) {
        syncPieceToIndex(pieceId, { x: clamped.x, y: clamped.y, w: finalW, h: finalH });
      }
    }));

    // Get updated state for validation
    const updatedState = useSceneStore.getState();
    const sceneV1 = projectDraftToV1({ scene: updatedState.scene });

    // Validate
    try {
      const problems = await validateOverlapsAsync(sceneV1);
      const hasBlockProblems = problems.some(p => p.severity === 'BLOCK');

      if (hasBlockProblems) {
        // Rollback: remove the piece
        set(produce((draft: SceneState) => {
          const layer = draft.scene.layers[layerId];
          if (layer) {
            layer.pieces = layer.pieces.filter(id => id !== pieceId);
          }
          delete draft.scene.pieces[pieceId];

          // Remove from spatial index if flag enabled
          if (window.__flags?.USE_GLOBAL_SPATIAL) {
            removePieceFromIndex(pieceId);
          }

          // Show toast warning
          draft.ui.toast = {
            message: 'Impossible d\'insérer : chevauchement détecté',
            until: Date.now() + 3000,
          };
        }));
        return null;
      } else {
        // Success: select the new piece and push history
        set(produce((draft: SceneState) => {
          draft.ui.selectedId = pieceId;
          draft.ui.selectedIds = [pieceId];
          draft.ui.primaryId = pieceId;
          pushHistory(draft, snap);
          autosave(takeSnapshot(draft));
        }));
        return pieceId;
      }
    } catch (err) {
      console.error('Validation error:', err);
      // On error, rollback and show toast
      set(produce((draft: SceneState) => {
        const layer = draft.scene.layers[layerId];
        if (layer) {
          layer.pieces = layer.pieces.filter(id => id !== pieceId);
        }
        delete draft.scene.pieces[pieceId];

        // Remove from spatial index if flag enabled
        if (window.__flags?.USE_GLOBAL_SPATIAL) {
          removePieceFromIndex(pieceId);
        }

        draft.ui.toast = {
          message: 'Erreur de validation',
          until: Date.now() + 3000,
        };
      }));
      return null;
    }
  },

  /**
   * Start a ghost insert: create a piece in an illegal position that the user can adjust.
   * The piece will be marked as a ghost until validated (no BLOCK problems).
   */
  startGhostInsert: async (opts) => {
    const { projectDraftToV1 } = await import('../sync/projector');
    const { validateOverlapsAsync } = await import('../core/geo/facade');

    const currentState = useSceneStore.getState();

    // Enforce min 5mm and round values
    const w = Math.max(5, Math.round(opts.w));
    const h = Math.max(5, Math.round(opts.h));

    // Apply snap to 10mm if enabled
    const finalW = currentState.ui.snap10mm ? snapTo10mm(w) : w;
    const finalH = currentState.ui.snap10mm ? snapTo10mm(h) : h;

    // Place at a safe visible position (clamped to scene)
    const x = Math.min(10, currentState.scene.size.w - finalW);
    const y = Math.min(10, currentState.scene.size.h - finalH);

    // Get active layer (first layer) or create one
    let layerId = opts.layerId ?? currentState.scene.layerOrder[0];
    let materialId = opts.materialId ?? Object.keys(currentState.scene.materials)[0];

    // Create piece ID
    const pieceId = genId('piece');

    // Add piece to scene
    set(produce((draft: SceneState) => {
      // Create layer if needed
      if (!layerId) {
        layerId = genId('layer');
        draft.scene.layers[layerId] = {
          id: layerId,
          name: 'Calque 1',
          pieces: [],
          zIndex: 0,
        };
        draft.scene.layerOrder.push(layerId);
      }

      // Create material if needed
      if (!materialId) {
        materialId = genId('material');
        draft.scene.materials[materialId] = {
          id: materialId,
          name: 'Matière 1',
          oriented: false,
          orientationDeg: 0,
        };
      }

      // Add piece
      draft.scene.pieces[pieceId] = {
        id: pieceId,
        kind: 'rect',
        layerId,
        materialId,
        position: { x, y },
        size: { w: finalW, h: finalH },
        rotationDeg: 0,
        scale: { x: 1, y: 1 },
        joined: false, // Ghost pieces are not joined by default
      };

      // Add to layer
      draft.scene.layers[layerId].pieces.push(pieceId);

      // Select the ghost piece
      draft.ui.selectedId = pieceId;
      draft.ui.selectedIds = [pieceId];
      draft.ui.primaryId = pieceId;

      // Mark as ghost
      draft.ui.ghost = {
        pieceId,
        problems: [],
        startedAt: Date.now(),
      };
    }));

    // Validate ghost immediately
    await useSceneStore.getState().validateGhost();

    return pieceId;
  },

  /**
   * Validate the current ghost piece and update problems.
   */
  validateGhost: async () => {
    const { projectDraftToV1 } = await import('../sync/projector');
    const { validateOverlapsAsync } = await import('../core/geo/facade');

    const currentState = useSceneStore.getState();
    if (!currentState.ui.ghost) return;

    try {
      const sceneV1 = projectDraftToV1({ scene: currentState.scene });
      const problems = await validateOverlapsAsync(sceneV1);

      // Filter problems for the ghost piece
      const ghostProblems = problems.filter(p => p.pieceId === currentState.ui.ghost?.pieceId);

      // Update ghost problems
      set(produce((draft: SceneState) => {
        if (draft.ui.ghost) {
          draft.ui.ghost.problems = ghostProblems;
        }
      }));
    } catch (err) {
      console.error('Ghost validation error:', err);
    }
  },

  /**
   * Commit the ghost piece if it has no BLOCK problems.
   * Clears ghost state and pushes to history.
   */
  commitGhost: () => {
    set(produce((draft: SceneState) => {
      if (!draft.ui.ghost) return;

      const hasBlock = draft.ui.ghost.problems.some(p => p.severity === 'BLOCK');

      if (hasBlock) {
        // Cannot commit with BLOCK problems
        draft.ui.toast = {
          message: 'Impossible de valider : des problèmes bloquants subsistent',
          until: Date.now() + 3000,
        };
        return;
      }

      // Clear ghost state (piece stays in scene)
      draft.ui.ghost = undefined;

      // Push to history
      pushHistory(draft);
    }));
  },

  /**
   * Cancel the ghost insert and remove the piece from the scene.
   */
  cancelGhost: () => {
    set(produce((draft: SceneState) => {
      if (!draft.ui.ghost) return;

      const pieceId = draft.ui.ghost.pieceId;

      // Remove piece from scene
      const piece = draft.scene.pieces[pieceId];
      if (piece) {
        const layerId = piece.layerId;
        const layer = draft.scene.layers[layerId];
        if (layer) {
          layer.pieces = layer.pieces.filter(id => id !== pieceId);
        }
        delete draft.scene.pieces[pieceId];

        // Remove from spatial index if flag enabled
        if (window.__flags?.USE_GLOBAL_SPATIAL) {
          removePieceFromIndex(pieceId);
        }
      }

      // Clear selection if ghost was selected
      if (draft.ui.selectedId === pieceId) {
        draft.ui.selectedId = undefined;
        draft.ui.selectedIds = [];
        draft.ui.primaryId = undefined;
      }

      // Clear ghost state
      draft.ui.ghost = undefined;
    }));
  },
}));
