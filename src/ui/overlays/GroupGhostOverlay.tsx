import React from 'react';
import { useSceneStore, type SceneStoreState } from '@/state/useSceneStore';

/**
 * Renders ghost overlays for all selected pieces during drag.
 * Each ghost is rendered at piece.position + transientDelta.
 * Rendered in the same SVG coordinate space as pieces (no viewport transform).
 */
const GroupGhostOverlay = React.memo(() => {
  const scene = useSceneStore((s: SceneStoreState) => s.scene);
  const selectedId = useSceneStore((s: SceneStoreState) => s.ui.selectedId);
  const selectedIds = useSceneStore((s: SceneStoreState) => s.ui.selectedIds);
  const isTransientActive = useSceneStore((s: SceneStoreState) => s.ui.isTransientActive);
  const transientDelta = useSceneStore((s: SceneStoreState) => s.ui.transientDelta);
  const dragging = useSceneStore((s: SceneStoreState) => s.ui.dragging);

  // Only render during drag (not resize) with transientDelta
  if (!isTransientActive || !transientDelta || !dragging) {
    return null;
  }

  const { dx, dy } = transientDelta;
  const selectedIdsList = selectedIds ?? (selectedId ? [selectedId] : []);
  const isValid = dragging?.candidate?.valid ?? true;

  if (selectedIdsList.length === 0) {
    return null;
  }

  return (
    <g data-overlay="group-ghost">
      {selectedIdsList.map((id) => {
        const piece = scene.pieces[id];
        if (!piece || piece.kind !== 'rect') return null;

        const { x, y } = piece.position;
        const { w, h } = piece.size;
        const rotationDeg = piece.rotationDeg ?? 0;

        // Ghost position = piece position + transient delta
        const ghostX = x + dx;
        const ghostY = y + dy;

        return (
          <g
            key={`ghost-${id}`}
            transform={`translate(${ghostX} ${ghostY}) rotate(${rotationDeg} ${w / 2} ${h / 2})`}
            data-testid="ghost-piece"
            data-valid={isValid ? 'true' : 'false'}
          >
            <rect
              x="0"
              y="0"
              width={w}
              height={h}
              rx="6"
              ry="6"
              fill="#60a5fa"
              fillOpacity="0.3"
              stroke="#22d3ee"
              strokeWidth="2"
              strokeDasharray="4 4"
              pointerEvents="none"
            />
          </g>
        );
      })}
    </g>
  );
});

GroupGhostOverlay.displayName = 'GroupGhostOverlay';

export default GroupGhostOverlay;
