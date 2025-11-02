# Contrats stables — Scene v1 & Bus de commandes

## 1) Schéma Scene v1 (unités : mm)
SceneV1 {
  v: 1,
  units: "mm",
  width: number, height: number,
  layers: Layer[],
  materials: MaterialRef[],
  pieces: Piece[],
  problems?: Problem[]
}

Layer { id: string, name: string, index: number }
MaterialRef { id: string, name: string, directional: boolean }

Piece {
  id: string,
  kind: "rect",      // extensible (ex: "poly" v2)
  x: number, y: number, w: number, h: number, rot: 0|90|180|270,
  layerId: string, materialId: string,
  constraints?: { lockEdge?: boolean },
  meta?: Record<string, unknown>
}

Problem {
  code: ProblemCode, severity: "BLOCK"|"WARN",
  pieceId?: string, message?: string, meta?: Record<string, unknown>
}

enum ProblemCode {
  overlap_same_layer,
  out_of_panel_bounds,
  no_support_below,
  max_layers_exceeded,
  project_limits_exceeded,
  material_orientation_mismatch,
  material_inconsistent_orientations,
  piece_will_be_split
}

## 2) Bus de commandes (intents figés)
- movePiece({ id, dx, dy })
- rotatePiece({ id, deg })             // 0/90/180/270
- scalePiece({ id, dw, dh, anchor })   // respect minSize ; lockEdge si actif
- duplicatePiece({ id })
- deletePiece({ id })
- setLayer({ id, layerId })
- setMaterial({ id, materialId })
- attachPieces({ aId, bId }) / detachAttachment({ aId, bId })
- commitGhost({}) / rollbackGhost({})

## 3) Façade store (stable)
editorStore.getState(): SceneV1
editorStore.dispatch(cmd: Command): void
editorStore.select<T>(selector: (s: SceneV1)=>T): T

## 4) Versionning
Tout changement de structure = Scene.v++ + migrateur. Problèmes : codes extensibles, non-breaking.
