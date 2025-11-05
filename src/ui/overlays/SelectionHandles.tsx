import React from 'react';
import { useSceneStore } from '@/state/useSceneStore';
import type { ID, Milli, SceneDraft } from '@/types/scene';
import { pieceBBox } from '@/lib/geom';

interface BBox {
  x: Milli;
  y: Milli;
  w: Milli;
  h: Milli;
}

function HandlesRect({ bbox, isIsotropic = false, onHandleStart }: { bbox: BBox; isIsotropic?: boolean; onHandleStart?: (handle: string, clientX: number, clientY: number) => void }) {
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
          data-handle={isIsotropic ? "group-corner" : undefined}
          x={px - r}
          y={py - r}
          width={2 * r}
          height={2 * r}
          rx={2}
          ry={2}
          fill="white"
          stroke="#3b82f6"
          strokeWidth={1}
          style={{ cursor: isIsotropic ? 'nwse-resize' : 'pointer', pointerEvents: isIsotropic ? 'all' : 'none' }}
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
function computeGroupBBoxRotationAware(scene: SceneDraft, ids: ID[]): BBox {
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

  return { x: minX as Milli, y: minY as Milli, w: (maxX - minX) as Milli, h: (maxY - minY) as Milli };
}

interface SelectionHandlesProps {
  onGroupResizeStart?: (handle: string, clientX: number, clientY: number) => void;
}

export default function SelectionHandles({ onGroupResizeStart }: SelectionHandlesProps = {}) {
  const ui = useSceneStore((s) => s.ui);
  const scene = useSceneStore((s) => s.scene);

  // 1) clé de remount : si l'une des composantes change → remount propre
  const selIds = ui.selectedIds ?? (ui.selectedId ? [ui.selectedId] : []);
  const selKey = selIds.join(',');
  const key = `${ui.handlesEpoch}:${scene.revision}:${selKey}`;

  // 2) masquer pendant drag, mais afficher preview pendant group resize
  if (ui.dragging) return null;

  // 3) bbox courante rotation-aware : priorité preview > groupe > pièce
  let bbox: BBox | null = null;
  if (ui.groupResizing?.preview?.bbox) {
    bbox = ui.groupResizing.preview.bbox;
  } else if (selIds.length >= 2) {
    bbox = computeGroupBBoxRotationAware(scene, selIds);
  } else if (selIds.length === 1) {
    const p = scene.pieces[selIds[0]];
    if (p) {
      const b = pieceBBox(p);
      bbox = { x: b.x, y: b.y, w: b.w, h: b.h };
    }
  }

  if (!bbox) return null;

  // During group resize: hide handles (preview is shown by GroupResizePreview component)
  if (ui.groupResizing?.isResizing) {
    return null;
  }

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
