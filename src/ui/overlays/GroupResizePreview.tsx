import React from 'react';
import { useSceneStore } from '@/state/useSceneStore';
import type { ID } from '@/types/scene';

/**
 * Live preview overlay for group resize operations
 * Renders transformed pieces using SVG transform matrices
 * No scene mutations - pure visual preview
 */
export default function GroupResizePreview() {
  // Use precise selectors to avoid unnecessary re-renders
  const preview = useSceneStore((s) => s.ui.groupResizing?.preview);
  const isResizing = useSceneStore((s) => s.ui.groupResizing?.isResizing ?? false);
  const pieces = useSceneStore((s) => s.scene.pieces);

  // Only render during active group resize with preview pieces
  if (!isResizing || !preview?.previewPieces) {
    return null;
  }

  const { previewPieces, scale, bbox } = preview;

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
            <g transform={`translate(${x},${y}) rotate(${rotationDeg} ${w/2} ${h/2})`}>
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
