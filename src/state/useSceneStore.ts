import { create } from 'zustand';
import { produce } from 'immer';
import type { SceneDraft, ID, Layer, Piece, Milli, Deg, MaterialRef } from '@/types/scene';
import { validateNoOverlap } from '@/lib/sceneRules';
import { snapToPieces, type SnapGuide } from '@/lib/ui/snap';

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
};

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
      if (mat && mat.oriented) mat.orientationDeg = orientationDeg;
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
        for (const id of selectedIds) {
          const p = draft.scene.pieces[id];
          if (!p) continue;
          p.position.x += finalDx;
          p.position.y += finalDy;
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
          finalX = candidateX + clampDx;
          finalY = candidateY + clampDy;
        }

        draft.ui.guides = undefined;
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
    })),

  deleteSelected: () =>
    set(produce((draft: SceneState) => {
      const selectedIds = draft.ui.selectedIds ?? (draft.ui.selectedId ? [draft.ui.selectedId] : []);
      if (selectedIds.length === 0) return;

      for (const selectedId of selectedIds) {
        const piece = draft.scene.pieces[selectedId];
        if (!piece) continue;

        const layer = draft.scene.layers[piece.layerId];
        if (layer) {
          layer.pieces = layer.pieces.filter((id) => id !== selectedId);
        }

        delete draft.scene.pieces[selectedId];
      }

      draft.ui.selectedId = undefined;
      draft.ui.selectedIds = undefined;
      draft.ui.primaryId = undefined;
    })),

  setPieceMaterial: (pieceId, materialId) =>
    set(produce((draft: SceneState) => {
      const p = draft.scene.pieces[pieceId];
      if (p && draft.scene.materials[materialId]) {
        p.materialId = materialId;
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
        m.oriented = oriented;
        if (!oriented) {
          // Retirer orientationDeg si on désactive oriented
          delete m.orientationDeg;
        } else if (m.orientationDeg === undefined) {
          // Initialiser à 0 par défaut
          m.orientationDeg = 0;
        }
      }
    })),

  rotateSelected: (deltaDeg) =>
    set(produce((draft: SceneState) => {
      const selectedIds = draft.ui.selectedIds ?? (draft.ui.selectedId ? [draft.ui.selectedId] : []);
      if (selectedIds.length === 0) return;

      for (const selectedId of selectedIds) {
        const piece = draft.scene.pieces[selectedId];
        if (!piece) continue;
        const currentDeg = (piece.rotationDeg ?? 0) as Deg;
        piece.rotationDeg = deltaDeg === 90 ? add90(currentDeg) : sub90(currentDeg);
      }
    })),

  setSelectedRotation: (deg) =>
    set(produce((draft: SceneState) => {
      const selectedIds = draft.ui.selectedIds ?? (draft.ui.selectedId ? [draft.ui.selectedId] : []);
      if (selectedIds.length === 0) return;

      for (const selectedId of selectedIds) {
        const piece = draft.scene.pieces[selectedId];
        if (!piece) continue;
        piece.rotationDeg = normDeg(deg);
      }
    })),

  duplicateSelected: () =>
    set(produce((draft: SceneState) => {
      const selectedIds = draft.ui.selectedIds ?? (draft.ui.selectedId ? [draft.ui.selectedId] : []);
      if (selectedIds.length === 0) return;

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

      draft.ui.selectedIds = newIds;
      draft.ui.selectedId = newIds[0];
      draft.ui.primaryId = newIds[0];
    })),
}));
