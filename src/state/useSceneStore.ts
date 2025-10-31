import { create } from 'zustand';
import { produce } from 'immer';
import type { SceneDraft, ID, Layer, Piece, Milli, Deg, MaterialRef } from '@/types/scene';
import { validateNoOverlap } from '@/lib/sceneRules';

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

type SceneState = {
  scene: SceneDraft;
  ui: {
    selectedId?: ID;
    flashInvalidAt?: number;
    dragging?: {
      id: ID;
      start: { x: number; y: number };
      candidate?: { x: number; y: number; valid: boolean };
    };
    snap10mm?: boolean;
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
  beginDrag: (id: ID) => void;
  updateDrag: (dx: number, dy: number) => void;
  endDrag: () => void;
  cancelDrag: () => void;
  addRectAtCenter: (w: Milli, h: Milli) => void;
  deleteSelected: () => void;
  setPieceMaterial: (pieceId: ID, materialId: ID) => void;
  setSnap10mm: (on: boolean) => void;
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
    flashInvalidAt: undefined,
    dragging: undefined,
    snap10mm: true,
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
    })),

  nudgeSelected: (dx, dy) =>
    set(produce((draft: SceneState) => {
      const selectedId = draft.ui.selectedId;
      if (!selectedId) return;

      const piece = draft.scene.pieces[selectedId];
      if (!piece) return;

      // Calculer position candidate
      let candidateX = piece.position.x + dx;
      let candidateY = piece.position.y + dy;

      // Clamper dans la scène
      const clamped = clampToScene(
        candidateX,
        candidateY,
        piece.size.w,
        piece.size.h,
        draft.scene.size.w,
        draft.scene.size.h,
      );

      // Appliquer snap si activé
      let finalX = clamped.x;
      let finalY = clamped.y;
      if (draft.ui.snap10mm) {
        finalX = snapTo10mm(clamped.x);
        finalY = snapTo10mm(clamped.y);
      }

      // Simuler le déplacement et vérifier overlap
      const testScene = { ...draft.scene, pieces: { ...draft.scene.pieces } };
      testScene.pieces[selectedId] = { ...piece, position: { x: finalX, y: finalY } };

      const validation = validateNoOverlap(testScene);

      if (!validation.ok) {
        // Conflit détecté → flasher l'invalide
        draft.ui.flashInvalidAt = Date.now();
      } else {
        // OK → appliquer le déplacement
        piece.position.x = finalX;
        piece.position.y = finalY;
      }
    })),

  beginDrag: (id) =>
    set(produce((draft: SceneState) => {
      const piece = draft.scene.pieces[id];
      if (!piece) return;

      draft.ui.selectedId = id;
      draft.ui.dragging = {
        id,
        start: { x: piece.position.x, y: piece.position.y },
        candidate: undefined,
      };
    })),

  updateDrag: (dx, dy) =>
    set(produce((draft: SceneState) => {
      const dragging = draft.ui.dragging;
      if (!dragging) return;

      const piece = draft.scene.pieces[dragging.id];
      if (!piece) return;

      // Calculer position candidate
      const candidateX = dragging.start.x + dx;
      const candidateY = dragging.start.y + dy;

      // Clamper dans la scène
      const clamped = clampToScene(
        candidateX,
        candidateY,
        piece.size.w,
        piece.size.h,
        draft.scene.size.w,
        draft.scene.size.h,
      );

      // Simuler le déplacement et vérifier overlap
      const testScene = { ...draft.scene, pieces: { ...draft.scene.pieces } };
      testScene.pieces[dragging.id] = { ...piece, position: { x: clamped.x, y: clamped.y } };

      const validation = validateNoOverlap(testScene);

      dragging.candidate = {
        x: clamped.x,
        y: clamped.y,
        valid: validation.ok,
      };
    })),

  endDrag: () =>
    set(produce((draft: SceneState) => {
      const dragging = draft.ui.dragging;
      if (!dragging || !dragging.candidate) {
        draft.ui.dragging = undefined;
        return;
      }

      // Commit si valide
      if (dragging.candidate.valid) {
        const piece = draft.scene.pieces[dragging.id];
        if (piece) {
          let finalX = dragging.candidate.x;
          let finalY = dragging.candidate.y;

          // Appliquer snap si activé
          if (draft.ui.snap10mm) {
            finalX = snapTo10mm(dragging.candidate.x);
            finalY = snapTo10mm(dragging.candidate.y);
          }

          piece.position.x = finalX;
          piece.position.y = finalY;
        }
      }
      // Sinon revert implicite (ne pas modifier la position)

      draft.ui.dragging = undefined;
    })),

  cancelDrag: () =>
    set(produce((draft: SceneState) => {
      draft.ui.dragging = undefined;
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
      const selectedId = draft.ui.selectedId;
      if (!selectedId) return;

      const piece = draft.scene.pieces[selectedId];
      if (!piece) return;

      // Retirer la pièce du layer
      const layer = draft.scene.layers[piece.layerId];
      if (layer) {
        layer.pieces = layer.pieces.filter((id) => id !== selectedId);
      }

      // Supprimer la pièce
      delete draft.scene.pieces[selectedId];

      // Désélectionner
      draft.ui.selectedId = undefined;
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
}));
