import { create } from 'zustand';
import { produce } from 'immer';
import type { SceneDraft, ID, Layer, Piece, Milli, Deg, MaterialRef } from '@/types/scene';
import { validateNoOverlap } from '@/lib/sceneRules';
import { snapToPieces, snapGroupToPieces, type SnapGuide } from '@/lib/ui/snap';
import { isSceneFileV1, normalizeSceneFileV1, type SceneFileV1 } from '@/lib/io/schema';
import {
  listDrafts,
  saveDraft,
  loadDraft,
  deleteDraft as deleteDraftFromStorage,
  upsertDraftName,
  newDraftName,
  type DraftMeta,
} from '@/lib/drafts';
import { applyHandle, type ResizeHandle } from '@/lib/ui/resize';

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

// helpers sélection multiple
function uniqueIds(ids: ID[]): ID[] {
  return Array.from(new Set(ids));
}

function groupBBox(scene: SceneDraft, ids: ID[]) {
  const rects = ids
    .map((id) => scene.pieces[id])
    .filter(Boolean)
    .map((p) => ({ x: p.position.x, y: p.position.y, w: p.size.w, h: p.size.h }));
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Clears transient UI state (drag/resize previews, guides, marquee)
 * while preserving selection state (selectedId/selectedIds/primaryId)
 */
function clearTransientUI(ui: SceneState['ui']) {
  ui.dragging = undefined;
  ui.resizing = undefined;
  ui.guides = undefined;
  ui.marquee = undefined;
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
    };
    marquee?: { x0: number; y0: number; x1: number; y1: number };
    snap10mm?: boolean;
    guides?: SnapGuide[];
    resizing?: {
      pieceId: ID;
      handle: ResizeHandle;
      origin: { x: Milli; y: Milli; w: Milli; h: Milli };
      snapshot: SceneStateSnapshot;
    };
    lockEdge?: boolean;
    history?: {
      past: SceneStateSnapshot[];
      future: SceneStateSnapshot[];
      limit: number;
    };
  };
};

type SceneActions = {
  initScene: (w: Milli, h: Milli) => void;
  addMaterial: (m: Omit<MaterialRef, 'id'> & { id?: ID }) => ID;
  setMaterialOrientation: (materialId: ID, orientationDeg: Deg) => void;

  addLayer: (name: string) => ID;
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
  startResize: (pieceId: ID, handle: ResizeHandle) => void;
  updateResize: (pointerMm: { x: Milli; y: Milli }) => void;
  endResize: (commit: boolean) => void;
  setLockEdge: (on: boolean) => void;
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

  addRectPiece: (layerId, materialId, w, h, x, y, rotationDeg = 0) =>
    set(produce((draft: SceneState) => {
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
    })) as unknown as ID,

  movePiece: (pieceId, x, y) =>
    set(produce((draft: SceneState) => {
      const p = draft.scene.pieces[pieceId];
      if (p) p.position = { x, y };
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
      };

      // Créer layer, material, piece atomiquement
      const layerId = genId('layer');
      const materialId = genId('mat');
      const pieceId = genId('piece');

      draft.scene.layers[layerId] = { id: layerId, name: 'C1', z: 0, pieces: [pieceId] };
      draft.scene.layerOrder.push(layerId);
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
    })),

  selectOnly: (id) =>
    set(produce((draft: SceneState) => {
      draft.ui.selectedId = id;
      draft.ui.selectedIds = [id];
      draft.ui.primaryId = id;
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
    })),

  clearSelection: () =>
    set(produce((draft: SceneState) => {
      draft.ui.selectedId = undefined;
      draft.ui.selectedIds = undefined;
      draft.ui.primaryId = undefined;
    })),

  selectAll: () =>
    set(produce((draft: SceneState) => {
      const allIds = Object.keys(draft.scene.pieces);
      draft.ui.selectedIds = allIds;
      draft.ui.selectedId = allIds[0];
      draft.ui.primaryId = allIds[0];
    })),

  setSelection: (ids) =>
    set(produce((draft: SceneState) => {
      const validIds = uniqueIds(ids.filter((id) => draft.scene.pieces[id]));
      draft.ui.selectedIds = validIds.length > 0 ? validIds : undefined;
      draft.ui.selectedId = validIds[0];
      draft.ui.primaryId = validIds[0];
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
          const pRight = p.position.x + p.size.w;
          const pBottom = p.position.y + p.size.h;
          return !(pRight < minX || p.position.x > maxX || pBottom < minY || p.position.y > minY);
        })
        .map((p) => p.id);

      draft.ui.selectedIds = intersected.length > 0 ? intersected : undefined;
      draft.ui.selectedId = intersected[0];
      draft.ui.primaryId = intersected[0];
      draft.ui.marquee = undefined;
    })),

  nudgeSelected: (dx, dy) =>
    set(produce((draft: SceneState) => {
      const selectedIds = draft.ui.selectedIds ?? (draft.ui.selectedId ? [draft.ui.selectedId] : []);
      if (selectedIds.length === 0) return;

      const snap = takeSnapshot(draft);

      // Nudge de groupe : calculer bbox du groupe
      const bbox = groupBBox(draft.scene, selectedIds);

      // Clamper dans la scène
      const clamped = clampToScene(
        bbox.x + dx,
        bbox.y + dy,
        bbox.w,
        bbox.h,
        draft.scene.size.w,
        draft.scene.size.h,
      );

      const actualDx = clamped.x - bbox.x;
      const actualDy = clamped.y - bbox.y;

      // Appliquer snap grille si activé
      let finalDx = actualDx;
      let finalDy = actualDy;
      if (draft.ui.snap10mm) {
        const snappedX = snapTo10mm(bbox.x + actualDx);
        const snappedY = snapTo10mm(bbox.y + actualDy);
        finalDx = snappedX - bbox.x;
        finalDy = snappedY - bbox.y;
      }

      // Simuler le déplacement du groupe
      const testScene = { ...draft.scene, pieces: { ...draft.scene.pieces } };
      for (const id of selectedIds) {
        const p = draft.scene.pieces[id];
        if (!p) continue;
        testScene.pieces[id] = { ...p, position: { x: p.position.x + finalDx, y: p.position.y + finalDy } };
      }

      const validation = validateNoOverlap(testScene);

      if (!validation.ok) {
        draft.ui.flashInvalidAt = Date.now();
      } else {
        if (finalDx !== 0 || finalDy !== 0) {
          for (const id of selectedIds) {
            const p = draft.scene.pieces[id];
            if (!p) continue;
            p.position.x += finalDx;
            p.position.y += finalDy;
          }
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

      // Si la pièce n'est pas dans la sélection, selectOnly
      if (!selectedIds.includes(id)) {
        draft.ui.selectedId = id;
        draft.ui.selectedIds = [id];
        draft.ui.primaryId = id;
      }

      const finalSelectedIds = draft.ui.selectedIds ?? [id];

      // Stocker les offsets pour le groupe
      const groupOffsets: Record<ID, { dx: number; dy: number }> = {};
      for (const sid of finalSelectedIds) {
        const sp = draft.scene.pieces[sid];
        if (!sp) continue;
        groupOffsets[sid] = {
          dx: sp.position.x - piece.position.x,
          dy: sp.position.y - piece.position.y,
        };
      }

      draft.ui.dragging = {
        id,
        start: { x: piece.position.x, y: piece.position.y },
        candidate: undefined,
        groupOffsets,
      };
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
            return {
              x: candidateX + off.dx,
              y: candidateY + off.dy,
              w: sp.size.w,
              h: sp.size.h,
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

          const clamped = clampToScene(gMinX, gMinY, gW, gH, draft.scene.size.w, draft.scene.size.h);
          const clampDx = clamped.x - gMinX;
          const clampDy = clamped.y - gMinY;
          const clampedX = candidateX + clampDx;
          const clampedY = candidateY + clampDy;

          // Snap groupe à pièces
          const candidateGroupRect = { x: clamped.x, y: clamped.y, w: gW, h: gH };
          const snapResult = snapGroupToPieces(draft.scene, candidateGroupRect, 5, selectedIds);
          draft.ui.guides = snapResult.guides;

          // Appliquer le delta de snap uniformément
          const snapDx = snapResult.x - candidateGroupRect.x;
          const snapDy = snapResult.y - candidateGroupRect.y;
          finalX = clampedX + snapDx;
          finalY = clampedY + snapDy;
        } else {
          draft.ui.guides = undefined;
        }
      } else {
        // Drag simple : clamp + snap entre pièces
        const clamped = clampToScene(candidateX, candidateY, piece.size.w, piece.size.h, draft.scene.size.w, draft.scene.size.h);
        const candidateRect = { x: clamped.x, y: clamped.y, w: piece.size.w, h: piece.size.h };
        const snapResult = snapToPieces(draft.scene, candidateRect, 5, dragging.id);
        draft.ui.guides = snapResult.guides;
        finalX = snapResult.x;
        finalY = snapResult.y;
      }

      // Snap grille optionnel
      if (draft.ui.snap10mm) {
        finalX = snapTo10mm(finalX);
        finalY = snapTo10mm(finalY);
      }

      // Simuler et valider
      const testScene = { ...draft.scene, pieces: { ...draft.scene.pieces } };

      if (isGroupDrag) {
        const offsets = dragging.groupOffsets ?? {};
        for (const sid of selectedIds) {
          const off = offsets[sid] ?? { dx: 0, dy: 0 };
          const sp = draft.scene.pieces[sid];
          if (!sp) continue;
          testScene.pieces[sid] = { ...sp, position: { x: finalX + off.dx, y: finalY + off.dy } };
        }
      } else {
        testScene.pieces[dragging.id] = { ...piece, position: { x: finalX, y: finalY } };
      }

      const validation = validateNoOverlap(testScene);

      dragging.candidate = {
        x: finalX,
        y: finalY,
        valid: validation.ok,
      };
    })),

  endDrag: () =>
    set(produce((draft: SceneState) => {
      const dragging = draft.ui.dragging;
      if (!dragging || !dragging.candidate) {
        draft.ui.dragging = undefined;
        draft.ui.guides = undefined;
        return;
      }

      const snap = takeSnapshot(draft);
      const selectedIds = draft.ui.selectedIds ?? [dragging.id];
      const isGroupDrag = selectedIds.length > 1;

      if (dragging.candidate.valid) {
        if (isGroupDrag) {
          const offsets = dragging.groupOffsets ?? {};
          for (const sid of selectedIds) {
            const off = offsets[sid] ?? { dx: 0, dy: 0 };
            const sp = draft.scene.pieces[sid];
            if (!sp) continue;
            sp.position.x = dragging.candidate.x + off.dx;
            sp.position.y = dragging.candidate.y + off.dy;
          }
        } else {
          const piece = draft.scene.pieces[dragging.id];
          if (piece) {
            piece.position.x = dragging.candidate.x;
            piece.position.y = dragging.candidate.y;
          }
        }
        pushHistory(draft, snap);
        autosave(takeSnapshot(draft));
      } else {
        // Invalid drop: flash invalid feedback
        draft.ui.flashInvalidAt = Date.now();
      }

      draft.ui.dragging = undefined;
      draft.ui.guides = undefined;
    })),

  cancelDrag: () =>
    set(produce((draft: SceneState) => {
      draft.ui.dragging = undefined;
      draft.ui.guides = undefined;
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
      }

      // Clear transient UI before clearing selection
      clearTransientUI(draft.ui);

      draft.ui.selectedId = undefined;
      draft.ui.selectedIds = undefined;
      draft.ui.primaryId = undefined;

      pushHistory(draft, snap);
      autosave(takeSnapshot(draft));
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

      const snap = takeSnapshot(draft);

      for (const selectedId of selectedIds) {
        const piece = draft.scene.pieces[selectedId];
        if (!piece) continue;
        const currentDeg = (piece.rotationDeg ?? 0) as Deg;
        piece.rotationDeg = deltaDeg === 90 ? add90(currentDeg) : sub90(currentDeg);
      }

      // Clear transient UI state after rotation
      clearTransientUI(draft.ui);

      pushHistory(draft, snap);
      autosave(takeSnapshot(draft));
    })),

  setSelectedRotation: (deg) =>
    set(produce((draft: SceneState) => {
      const selectedIds = draft.ui.selectedIds ?? (draft.ui.selectedId ? [draft.ui.selectedId] : []);
      if (selectedIds.length === 0) return;

      const snap = takeSnapshot(draft);

      for (const selectedId of selectedIds) {
        const piece = draft.scene.pieces[selectedId];
        if (!piece) continue;
        piece.rotationDeg = normDeg(deg);
      }

      // Clear transient UI state after rotation
      clearTransientUI(draft.ui);

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
        const clamped = clampToScene(
          originalPiece.position.x + offsetX,
          originalPiece.position.y + offsetY,
          originalPiece.size.w,
          originalPiece.size.h,
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

  startResize: (pieceId, handle) =>
    set(produce((draft: SceneState) => {
      const piece = draft.scene.pieces[pieceId];
      if (!piece) return;

      // Capture pre-resize state for history
      const snapshot = takeSnapshot(draft);

      draft.ui.resizing = {
        pieceId,
        handle,
        origin: {
          x: piece.position.x,
          y: piece.position.y,
          w: piece.size.w,
          h: piece.size.h,
        },
        snapshot,
      };
    })),

  updateResize: (pointerMm) =>
    set(produce((draft: SceneState) => {
      const resizing = draft.ui.resizing;
      if (!resizing) return;

      const piece = draft.scene.pieces[resizing.pieceId];
      if (!piece) return;

      const lockEdge = draft.ui.lockEdge ?? false;

      // Apply handle to get new rect
      const newRect = applyHandle(
        resizing.origin,
        resizing.handle,
        pointerMm,
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

        if (changed) {
          // Push pre-resize snapshot to history
          pushHistory(draft, resizing.snapshot);
          autosave(takeSnapshot(draft));
        }
      } else if (!commit && piece) {
        // Rollback to origin
        piece.position.x = resizing.origin.x;
        piece.position.y = resizing.origin.y;
        piece.size.w = resizing.origin.w;
        piece.size.h = resizing.origin.h;
      }

      draft.ui.resizing = undefined;
      draft.ui.guides = undefined;
    })),

  setLockEdge: (on) =>
    set(produce((draft: SceneState) => {
      draft.ui.lockEdge = on;
    })),
}));
