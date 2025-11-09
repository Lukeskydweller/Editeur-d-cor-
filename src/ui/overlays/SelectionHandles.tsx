import React from 'react';
import { useSceneStore, type SceneStoreState } from '@/state/useSceneStore';
import type { ID, Milli, SceneDraft } from '@/types/scene';
import { pieceBBox } from '@/lib/geom';
import { useShallow } from 'zustand/react/shallow';
import { EMPTY_ARR } from '@/state/constants';

interface BBox {
  x: Milli;
  y: Milli;
  w: Milli;
  h: Milli;
}

function HandlesRect({
  bbox,
  isIsotropic = false,
  onHandleStart,
}: {
  bbox: BBox;
  isIsotropic?: boolean;
  onHandleStart?: (handle: string, clientX: number, clientY: number) => void;
}) {
  const r = 4; // taille visuelle poignée
  const { x, y, w, h } = bbox;

  // Mode isotrope : uniquement les coins (nw, ne, sw, se) pour multi-sélection
  const points = isIsotropic
    ? [
        { pos: [x, y], handle: 'nw' as const },
        { pos: [x + w, y], handle: 'ne' as const },
        { pos: [x, y + h], handle: 'sw' as const },
        { pos: [x + w, y + h], handle: 'se' as const },
      ]
    : [
        { pos: [x, y], handle: 'nw' as const },
        { pos: [x + w / 2, y], handle: 'n' as const },
        { pos: [x + w, y], handle: 'ne' as const },
        { pos: [x, y + h / 2], handle: 'w' as const },
        { pos: [x + w, y + h / 2], handle: 'e' as const },
        { pos: [x, y + h], handle: 'sw' as const },
        { pos: [x + w / 2, y + h], handle: 's' as const },
        { pos: [x + w, y + h], handle: 'se' as const },
      ];

  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="transparent" />
      {points.map(({ pos: [px, py], handle }, i) => (
        <rect
          key={i}
          data-handle={isIsotropic ? 'group-corner' : undefined}
          data-testid={`handle-${handle}`}
          x={px - r}
          y={py - r}
          width={2 * r}
          height={2 * r}
          rx={2}
          ry={2}
          fill="white"
          stroke="#3b82f6"
          strokeWidth={1}
          style={{
            cursor: isIsotropic ? 'nwse-resize' : 'pointer',
            pointerEvents: isIsotropic ? 'all' : 'none',
          }}
          onPointerDown={(e) => {
            if (isIsotropic && onHandleStart) {
              e.stopPropagation();
              onHandleStart(handle, e.clientX, e.clientY);
            }
          }}
        />
      ))}
    </>
  );
}

/**
 * Helper: compute group bbox rotation-aware (no cache, always fresh from pieceBBox)
 */
function computeGroupBBoxRotationAware(scene: SceneDraft, ids: readonly ID[]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

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
    x: minX as Milli,
    y: minY as Milli,
    w: (maxX - minX) as Milli,
    h: (maxY - minY) as Milli,
  };
}

interface SelectionHandlesProps {
  onGroupResizeStart?: (
    handle: import('@/lib/ui/resize').ResizeHandle | (string & {}),
    clientX: number,
    clientY: number,
  ) => void;
}

export default function SelectionHandles({ onGroupResizeStart }: SelectionHandlesProps = {}) {
  // Precise selectors - avoid subscribing to full ui/scene objects
  const selectedId = useSceneStore((s: SceneStoreState) => s.ui.selectedId);
  const selectedIds = useSceneStore(useShallow((s: SceneStoreState) => s.ui.selectedIds));
  const handlesEpoch = useSceneStore((s: SceneStoreState) => s.ui.handlesEpoch);
  const sceneRevision = useSceneStore((s: SceneStoreState) => s.scene.revision);
  const isDragging = useSceneStore((s: SceneStoreState) => !!s.ui.dragging);
  const groupIsResizing = useSceneStore((s: SceneStoreState) => !!s.ui.groupResizing?.isResizing);
  const groupPreviewBbox = useSceneStore(
    useShallow((s: SceneStoreState) => s.ui.groupResizing?.preview?.bbox),
  );

  // 1) clé de remount : si l'une des composantes change → remount propre
  const selIds = selectedIds ?? (selectedId ? [selectedId] : EMPTY_ARR);
  const selKey = selIds.join(',');
  const key = `${handlesEpoch}:${sceneRevision}:${selKey}`;

  // 2) masquer pendant drag
  if (isDragging) return null;

  // During group resize: hide handles (preview is shown by GroupResizePreview component)
  if (groupIsResizing) {
    return null;
  }

  // 3) bbox courante rotation-aware : priorité preview > groupe > pièce
  // Get scene pieces only when needed (not via subscription)
  const pieces = useSceneStore.getState().scene.pieces;

  let bbox: BBox | null = null;
  if (groupPreviewBbox) {
    bbox = groupPreviewBbox;
  } else if (selIds.length >= 2) {
    bbox = computeGroupBBoxRotationAware({ pieces } as SceneDraft, selIds);
  } else if (selIds.length === 1) {
    const p = pieces[selIds[0]];
    if (p) {
      const b = pieceBBox(p);
      bbox = { x: b.x, y: b.y, w: b.w, h: b.h };
    }
  }

  if (!bbox) return null;

  // Multi-selection: render group bbox with handles
  if (selIds.length >= 2) {
    return (
      <g data-testid="selection-handles-group" data-layer="handles" key={key}>
        <HandlesRect bbox={bbox} isIsotropic={true} onHandleStart={onGroupResizeStart} />
      </g>
    );
  }

  // Single selection: render selection bbox handles
  return (
    <g data-testid="selection-handles-single" data-layer="handles" key={key}>
      <HandlesRect bbox={bbox} isIsotropic={false} onHandleStart={undefined} />
    </g>
  );
}
