import type { ResizeHandle } from '@/lib/ui/resize';

type Rect = { x: number; y: number; w: number; h: number };

type ResizeHandlesProps = {
  rect: Rect;
  onStart: (handle: ResizeHandle) => void;
  disabled?: boolean;
};

const HANDLE_SIZE = 8; // Visual size in pixels
const TOUCH_TARGET = 16; // Touch target size in pixels

export function ResizeHandles({ rect, onStart, disabled = false }: ResizeHandlesProps) {
  const { x, y, w, h } = rect;
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  const right = x + w;
  const bottom = y + h;

  const handles: Array<{ handle: ResizeHandle; x: number; y: number; cursor: string }> = [
    { handle: 'nw', x, y, cursor: 'nwse-resize' },
    { handle: 'n', x: centerX, y, cursor: 'ns-resize' },
    { handle: 'ne', x: right, y, cursor: 'nesw-resize' },
    { handle: 'e', x: right, y: centerY, cursor: 'ew-resize' },
    { handle: 'se', x: right, y: bottom, cursor: 'nwse-resize' },
    { handle: 's', x: centerX, y: bottom, cursor: 'ns-resize' },
    { handle: 'sw', x, y: bottom, cursor: 'nesw-resize' },
    { handle: 'w', x, y: centerY, cursor: 'ew-resize' },
  ];

  return (
    <g className="resize-handles">
      {handles.map(({ handle, x: hx, y: hy, cursor }) => (
        <g key={handle}>
          {/* Touch target (invisible, larger) */}
          <rect
            x={hx - TOUCH_TARGET / 2}
            y={hy - TOUCH_TARGET / 2}
            width={TOUCH_TARGET}
            height={TOUCH_TARGET}
            fill="transparent"
            role="button"
            aria-label={`resize-handle-${handle}`}
            tabIndex={disabled ? -1 : 0}
            style={{ cursor: disabled ? 'not-allowed' : cursor }}
            onPointerDown={(e) => {
              if (disabled) return;
              e.stopPropagation();
              onStart(handle);
            }}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onStart(handle);
              }
            }}
          />
          {/* Visual handle (visible, smaller) */}
          <rect
            x={hx - HANDLE_SIZE / 2}
            y={hy - HANDLE_SIZE / 2}
            width={HANDLE_SIZE}
            height={HANDLE_SIZE}
            fill="white"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            pointerEvents="none"
            opacity={disabled ? 0.3 : 1}
          />
        </g>
      ))}
    </g>
  );
}
