import { useRef, useEffect } from 'react';
import type { ResizeHandle } from '@/lib/ui/resize';

type Rect = { x: number; y: number; w: number; h: number };

export type CursorType = 'ns-resize' | 'ew-resize' | 'nesw-resize' | 'nwse-resize';

export function baseCursorFor(handle: ResizeHandle): CursorType {
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'ne':
    case 'sw':
      // diagonale "\" (du haut-gauche au bas-droit) ≈ nesw
      return 'nesw-resize';
    case 'nw':
    case 'se':
      // diagonale "/" (du bas-gauche au haut-droit) ≈ nwse
      return 'nwse-resize';
  }
}

export function rotateCursor(cursor: CursorType, rotDeg: number): CursorType {
  // Normaliser en [0,90,180,270]
  const k = ((Math.round(rotDeg / 90) % 4) + 4) % 4;
  if (k === 0) return cursor;
  if (k === 2) return cursor; // 180° n'inverse pas ns/ew ni la diagonale
  // 90° ou 270°: ns<->ew et nesw<->nwse
  if (cursor === 'ns-resize') return 'ew-resize';
  if (cursor === 'ew-resize') return 'ns-resize';
  if (cursor === 'nesw-resize') return 'nwse-resize';
  return 'nesw-resize'; // 'nwse-resize'
}

export function cursorFor(handle: ResizeHandle, rotDeg: number): CursorType {
  return rotateCursor(baseCursorFor(handle), rotDeg);
}

type ResizeHandlesOverlayProps = {
  rect: Rect; // In mm
  rotationDeg?: number; // Rotation angle in degrees
  svgElement: SVGSVGElement | null;
  onStart: (handle: ResizeHandle, clientX: number, clientY: number) => void;
  onMove: (clientX: number, clientY: number) => void;
  onEnd: () => void;
  isResizing: boolean;
  hasGhostProblems?: boolean; // True if piece has ghost validation problems
};

const HANDLE_SIZE = 8; // Visual size in pixels
const TOUCH_TARGET = 16; // Touch target size in pixels

export function ResizeHandlesOverlay({
  rect,
  rotationDeg = 0,
  svgElement,
  onStart,
  onMove,
  onEnd,
  isResizing,
  hasGhostProblems = false,
}: ResizeHandlesOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const activeHandleRef = useRef<ResizeHandle | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  // Convert mm coordinates to screen pixels
  const getScreenPosition = (xMm: number, yMm: number): { x: number; y: number } => {
    if (!svgElement) return { x: 0, y: 0 };

    const svgRect = svgElement.getBoundingClientRect();
    const viewBox = svgElement.viewBox.baseVal;

    const scaleX = svgRect.width / viewBox.width;
    const scaleY = svgRect.height / viewBox.height;

    return {
      x: xMm * scaleX,
      y: yMm * scaleY,
    };
  };

  const { x, y, w, h } = rect;
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  const right = x + w;
  const bottom = y + h;

  // Center in mm (rotation pivot point)
  const centerXMm = centerX;
  const centerYMm = centerY;

  // Get center position in screen pixels for rotation transform
  const centerScreen = getScreenPosition(centerXMm, centerYMm);

  const handles: Array<{ handle: ResizeHandle; xMm: number; yMm: number }> = [
    { handle: 'nw', xMm: x, yMm: y },
    { handle: 'n', xMm: centerX, yMm: y },
    { handle: 'ne', xMm: right, yMm: y },
    { handle: 'e', xMm: right, yMm: centerY },
    { handle: 'se', xMm: right, yMm: bottom },
    { handle: 's', xMm: centerX, yMm: bottom },
    { handle: 'sw', xMm: x, yMm: bottom },
    { handle: 'w', xMm: x, yMm: centerY },
  ];

  // Global pointer move/up handlers
  useEffect(() => {
    if (!isResizing) return;

    const handleGlobalMove = (e: PointerEvent) => {
      if (activeHandleRef.current && pointerIdRef.current === e.pointerId) {
        onMove(e.clientX, e.clientY);
      }
    };

    const handleGlobalUp = (e: PointerEvent) => {
      if (pointerIdRef.current === e.pointerId) {
        onEnd();
        activeHandleRef.current = null;
        pointerIdRef.current = null;
      }
    };

    const handleGlobalCancel = (e: PointerEvent) => {
      if (pointerIdRef.current === e.pointerId) {
        onEnd();
        activeHandleRef.current = null;
        pointerIdRef.current = null;
      }
    };

    window.addEventListener('pointermove', handleGlobalMove);
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalCancel);

    return () => {
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalCancel);
    };
  }, [isResizing, onMove, onEnd]);

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 30 }}
      data-e2e-overlay="true"
    >
      {handles.map(({ handle, xMm, yMm }) => {
        const screenPos = getScreenPosition(xMm, yMm);

        // Apply rotation transform around center
        // We translate handle position relative to center, then rotate
        const dx = screenPos.x - centerScreen.x;
        const dy = screenPos.y - centerScreen.y;
        const angleRad = (rotationDeg * Math.PI) / 180;
        const rotatedDx = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
        const rotatedDy = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
        const finalX = centerScreen.x + rotatedDx;
        const finalY = centerScreen.y + rotatedDy;

        // Compute rotated cursor
        const cursor = cursorFor(handle, rotationDeg);

        return (
          <div
            key={handle}
            className="absolute pointer-events-auto"
            style={{
              left: finalX - TOUCH_TARGET / 2,
              top: finalY - TOUCH_TARGET / 2,
              width: TOUCH_TARGET,
              height: TOUCH_TARGET,
              cursor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();

              // Capture pointer
              const target = e.currentTarget as HTMLElement;
              target.setPointerCapture(e.pointerId);

              activeHandleRef.current = handle;
              pointerIdRef.current = e.pointerId;

              onStart(handle, e.clientX, e.clientY);
            }}
            role="button"
            aria-label={`resize-handle-${handle}`}
            aria-invalid={hasGhostProblems}
            tabIndex={0}
          >
            {/* Visual handle */}
            <div
              style={{
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                backgroundColor: 'white',
                border: '2px solid hsl(var(--primary))',
                borderRadius: 2,
                pointerEvents: 'none',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
