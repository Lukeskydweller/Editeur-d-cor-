import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSceneStore } from '@/state/useSceneStore';

/**
 * Debug Panel for drag/resize validation diagnostics.
 *
 * Activated by: window.__DBG_PANEL__ = true
 *
 * Shows for selected piece:
 * - pieceId, layerId
 * - ghost, hasBlock status
 * - validation reasons breakdown
 * - shortlist.sameLayer count
 */
export function DebugPanel() {
  const [, setTick] = useState(0);

  // Refresh every 100ms for live updates during drag/resize
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(timer);
  }, []);

  const state = useSceneStore.getState();
  const selectedId = state.ui.selectedId;

  // Only show if __DBG_PANEL__ flag is set
  if (import.meta.env.PROD || !(window as any).__DBG_PANEL__) {
    return null;
  }

  // No selection → show placeholder
  if (!selectedId) {
    return (
      <Card data-testid="debug-panel" className="bg-yellow-50 border-yellow-400">
        <CardHeader>
          <CardTitle className="text-sm">Debug Panel</CardTitle>
        </CardHeader>
        <CardContent className="text-xs">
          <div className="text-gray-500 italic">No piece selected</div>
        </CardContent>
      </Card>
    );
  }

  const piece = state.scene.pieces[selectedId];
  if (!piece) {
    return (
      <Card data-testid="debug-panel" className="bg-yellow-50 border-yellow-400">
        <CardHeader>
          <CardTitle className="text-sm">Debug Panel</CardTitle>
        </CardHeader>
        <CardContent className="text-xs">
          <div className="text-red-500">Selected piece not found: {selectedId}</div>
        </CardContent>
      </Card>
    );
  }

  // Get ghost state
  const ghost = state.ui.ghost;
  const ghostActive = ghost ? '1' : '0';

  // Calculate hasBlock from ghost problems
  const hasBlock = ghost?.problems?.some((p) => p.severity === 'BLOCK') ?? false;

  // Group problems by severity for display
  const blockProblems = ghost?.problems?.filter((p) => p.severity === 'BLOCK') || [];
  const warnProblems = ghost?.problems?.filter((p) => p.severity === 'WARN') || [];

  // Extract validation reasons from problems
  const reasons = {
    collision: blockProblems.some((p) => p.code === 'overlap_same_layer'),
    spacing: blockProblems.some((p) => p.code === 'spacing_too_small'),
    bounds: blockProblems.some(
      (p) => p.code === 'outside_scene' || p.code === 'out_of_panel_bounds',
    ),
    supportFast: warnProblems.some((p) => p.code === 'unsupported_above') ? 'missing' : 'ok',
    supportExact: warnProblems.some((p) => p.code === 'unsupported_above') ? 'missing' : 'ok',
  };

  // Determine setHasBlockFrom
  let setHasBlockFrom = 'none';
  if (reasons.collision) setHasBlockFrom = 'collision';
  else if (reasons.spacing) setHasBlockFrom = 'spacing';
  else if (reasons.bounds) setHasBlockFrom = 'bounds';

  // Get dragging/resizing state
  const dragging = state.ui.dragging;
  const resizing = state.ui.resizing;
  const operation = dragging ? 'drag' : resizing ? 'resize' : 'idle';

  // Shortlist info (would need instrumentation to capture)
  const shortlistSameLayer = '(instrumented at runtime)';

  return (
    <Card data-testid="debug-panel" className="bg-yellow-50 border-yellow-400">
      <CardHeader>
        <CardTitle className="text-sm">Debug Panel</CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        {/* Piece identification */}
        <div>
          <span className="font-semibold">Piece ID:</span>{' '}
          <span className="font-mono text-blue-700">{selectedId.slice(0, 8)}</span>
        </div>
        <div>
          <span className="font-semibold">Layer ID:</span>{' '}
          <span className="font-mono text-purple-700">{piece.layerId.slice(0, 8)}</span>
        </div>

        {/* Operation status */}
        <div className="pt-2 border-t">
          <span className="font-semibold">Operation:</span>{' '}
          <span className={operation === 'idle' ? 'text-gray-500' : 'text-green-600 font-bold'}>
            {operation.toUpperCase()}
          </span>
        </div>

        {/* Ghost and hasBlock status */}
        <div className="pt-2 border-t">
          <div>
            <span className="font-semibold">ghost:</span>{' '}
            <span className={ghostActive === '1' ? 'text-orange-600 font-bold' : 'text-gray-500'}>
              {ghostActive}
            </span>
          </div>
          <div>
            <span className="font-semibold">hasBlock:</span>{' '}
            <span className={hasBlock ? 'text-red-600 font-bold' : 'text-green-600'}>
              {hasBlock ? 'true' : 'false'}
            </span>
          </div>
          <div>
            <span className="font-semibold">setHasBlockFrom:</span>{' '}
            <span
              className={setHasBlockFrom === 'none' ? 'text-green-600' : 'text-red-600 font-bold'}
            >
              {setHasBlockFrom}
            </span>
          </div>
        </div>

        {/* Validation reasons */}
        <div className="pt-2 border-t">
          <div className="font-semibold mb-1">Reasons:</div>
          <div className="pl-2 space-y-1">
            <div>
              <span>collision:</span>{' '}
              <span className={reasons.collision ? 'text-red-600 font-bold' : 'text-gray-500'}>
                {reasons.collision ? 'true' : 'false'}
              </span>
            </div>
            <div>
              <span>spacing:</span>{' '}
              <span className={reasons.spacing ? 'text-red-600 font-bold' : 'text-gray-500'}>
                {reasons.spacing ? 'true' : 'false'}
              </span>
            </div>
            <div>
              <span>bounds:</span>{' '}
              <span className={reasons.bounds ? 'text-red-600 font-bold' : 'text-gray-500'}>
                {reasons.bounds ? 'true' : 'false'}
              </span>
            </div>
            <div>
              <span>supportFast:</span>{' '}
              <span
                className={
                  reasons.supportFast === 'missing' ? 'text-orange-600 font-bold' : 'text-gray-500'
                }
              >
                {reasons.supportFast}
              </span>
            </div>
            <div>
              <span>supportExact:</span>{' '}
              <span
                className={
                  reasons.supportExact === 'missing' ? 'text-orange-600 font-bold' : 'text-gray-500'
                }
              >
                {reasons.supportExact}
              </span>
            </div>
          </div>
        </div>

        {/* Problem details */}
        {(blockProblems.length > 0 || warnProblems.length > 0) && (
          <div className="pt-2 border-t">
            <div className="font-semibold mb-1">Problems:</div>
            {blockProblems.length > 0 && (
              <div className="pl-2 mb-1">
                <div className="text-red-600 font-bold">BLOCK ({blockProblems.length}):</div>
                {blockProblems.map((p, i) => (
                  <div key={i} className="text-xs pl-2">
                    • {p.code}
                  </div>
                ))}
              </div>
            )}
            {warnProblems.length > 0 && (
              <div className="pl-2">
                <div className="text-orange-600 font-bold">WARN ({warnProblems.length}):</div>
                {warnProblems.map((p, i) => (
                  <div key={i} className="text-xs pl-2">
                    • {p.code}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Shortlist info */}
        <div className="pt-2 border-t">
          <div>
            <span className="font-semibold">shortlist.sameLayer:</span>{' '}
            <span className="text-gray-500 italic">{shortlistSameLayer}</span>
          </div>
        </div>

        {/* Help text */}
        <div className="pt-2 border-t text-xs text-gray-600 italic">
          Drag or resize to see live validation updates.
        </div>
      </CardContent>
    </Card>
  );
}
