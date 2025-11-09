import React from 'react';
import { useSceneStore, type SceneStoreState } from '@/state/useSceneStore';
import { EMPTY_ARR } from '@/state/constants';
import type { ID, Milli } from '@/types/scene';
import { useShallow } from 'zustand/react/shallow';

/**
 * Live preview overlay for group resize operations
 * Renders transformed pieces using SVG transform matrices
 * No scene mutations - pure visual preview
 *
 * CRITICAL: Uses precise selectors to avoid re-renders during non-group operations
 */
export default function GroupResizePreview() {
  // Precise selectors - no subscription to full scene/ui objects
  const preview = useSceneStore(useShallow((s: SceneStoreState) => s.ui.groupResizing?.preview));

  if (!preview?.previewPieces || preview.previewPieces.length === 0) {
    return null;
  }

  const { previewPieces, scale, bbox } = preview;

  // Get pieces directly from store only when rendering (not via hook subscription)
  const pieces = useSceneStore.getState().scene.pieces;

  return (
    <g data-testid="group-resize-preview-overlay" data-layer="preview" pointerEvents="none">
      {/* Render each piece with its transform matrix */}
      {previewPieces.map(({ id, matrix }) => {
        const piece = pieces[id];
        if (!piece) return null;

        const { a, b, c, d, e, f } = matrix;
        const transformStr = `matrix(${a},${b},${c},${d},${e},${f})`;

        // Get original piece geometry
        const { x, y } = piece.position;
        const { w, h } = piece.size;
        const rotationDeg = piece.rotationDeg ?? 0;

        // Piece color (from material or default)
        const fillColor = '#93c5fd'; // light blue
        const strokeColor = '#3b82f6'; // blue-500

        return (
          <g key={id} transform={transformStr}>
            {/* Render the piece with its original geometry */}
            {/* The transform matrix will scale it visually */}
            <g transform={`translate(${x},${y}) rotate(${rotationDeg} ${w / 2} ${h / 2})`}>
              <rect
                x={0}
                y={0}
                width={w}
                height={h}
                rx={2}
                ry={2}
                fill={fillColor}
                fillOpacity={0.4}
                stroke={strokeColor}
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </g>
        );
      })}

      {/* Dashed bbox with scale indicator */}
      <rect
        x={bbox.x}
        y={bbox.y}
        width={bbox.w}
        height={bbox.h}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={1}
        strokeDasharray="4 2"
        opacity={0.6}
      />
      <text
        x={bbox.x + bbox.w / 2}
        y={bbox.y + bbox.h / 2}
        fill="#3b82f6"
        fontSize={14}
        fontWeight="600"
        textAnchor="middle"
        dominantBaseline="middle"
        opacity={0.9}
      >
        ×{scale.toFixed(2)}
      </text>
    </g>
  );
}
