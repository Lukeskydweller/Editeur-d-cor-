import { useRef, useEffect } from 'react';
import type { ResizeHandle } from '@/lib/ui/resize';

type Rect = { x: number; y: number; w: number; h: number };

type ResizeHandlesOverlayProps = {
  rect: Rect; // In mm
  svgElement: SVGSVGElement | null;
  onStart: (handle: ResizeHandle, clientX: number, clientY: number) => void;
  onMove: (clientX: number, clientY: number) => void;
  onEnd: () => void;
  isResizing: boolean;
};

const HANDLE_SIZE = 8; // Visual size in pixels
const TOUCH_TARGET = 16; // Touch target size in pixels

export function ResizeHandlesOverlay({
  rect,
  svgElement,
  onStart,
  onMove,
  onEnd,
  isResizing,
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

  const handles: Array<{ handle: ResizeHandle; xMm: number; yMm: number; cursor: string }> = [
    { handle: 'nw', xMm: x, yMm: y, cursor: 'nwse-resize' },
    { handle: 'n', xMm: centerX, yMm: y, cursor: 'ns-resize' },
    { handle: 'ne', xMm: right, yMm: y, cursor: 'nesw-resize' },
    { handle: 'e', xMm: right, yMm: centerY, cursor: 'ew-resize' },
    { handle: 'se', xMm: right, yMm: bottom, cursor: 'nwse-resize' },
    { handle: 's', xMm: centerX, yMm: bottom, cursor: 'ns-resize' },
    { handle: 'sw', xMm: x, yMm: bottom, cursor: 'nesw-resize' },
    { handle: 'w', xMm: x, yMm: centerY, cursor: 'ew-resize' },
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
    >
      {handles.map(({ handle, xMm, yMm, cursor }) => {
        const screenPos = getScreenPosition(xMm, yMm);

        return (
          <div
            key={handle}
            className="absolute pointer-events-auto"
            style={{
              left: screenPos.x - TOUCH_TARGET / 2,
              top: screenPos.y - TOUCH_TARGET / 2,
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
