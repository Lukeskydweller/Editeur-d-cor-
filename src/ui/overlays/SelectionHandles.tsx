import React from 'react';
import { useSceneStore } from '@/state/useSceneStore';
import type { Milli } from '@/types/scene';

interface BBox {
  x: Milli;
  y: Milli;
  w: Milli;
  h: Milli;
}

function HandlesRect({ bbox }: { bbox: BBox }) {
  const r = 4; // taille visuelle poignée
  const { x, y, w, h } = bbox;
  const points = [
    [x, y],
    [x + w / 2, y],
    [x + w, y],
    [x, y + h / 2],
    [x + w, y + h / 2],
    [x, y + h],
    [x + w / 2, y + h],
    [x + w, y + h],
  ];
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="transparent" />
      {points.map(([px, py], i) => (
        <rect
          key={i}
          x={px - r}
          y={py - r}
          width={2 * r}
          height={2 * r}
          rx={2}
          ry={2}
          fill="white"
          stroke="#3b82f6"
          strokeWidth={1}
        />
      ))}
    </>
  );
}

export default function SelectionHandles() {
  const { ui } = useSceneStore();

  const selectedIds = ui.selectedIds;
  const isMulti = selectedIds && selectedIds.length > 1;

  // Désactiver le resize sur multi-sélection: ne pas rendre les poignées
  if (isMulti) {
    return (
      <g
        data-testid="selection-handles"
        style={{ pointerEvents: 'none' }}
      />
    );
  }

  // Priorité à la bbox transitoire pendant drag/resize (déjà maintenue pour le tooltip)
  const bbox =
    ui.isTransientActive && ui.transientBBox ? ui.transientBBox : ui.selectionBBox;

  if (!bbox) return null;

  // IMPORTANT : aucun transform ici — on hérite du <g transform> parent (repère caméra)
  return (
    <g data-testid="selection-handles">
      <HandlesRect bbox={bbox} />
    </g>
  );
}
