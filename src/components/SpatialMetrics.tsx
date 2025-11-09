import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSceneStore } from '@/state/useSceneStore';

export function SpatialMetrics() {
  const [, setTick] = useState(0);

  // Refresh every 500ms for live stats
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(timer);
  }, []);

  const store = useSceneStore.getState();
  const { ui, scene } = store;

  // Get current spatial engine mode
  const override = (window as any).__SPATIAL__ as 'global' | 'rbush' | 'auto' | undefined;
  const configuredMode = ui.spatialEngine ?? 'auto';
  const effectiveMode = override ?? configuredMode;
  const pieceCount = Object.keys(scene.pieces).length;
  const threshold = ui.spatialThreshold ?? 120;

  // Determine actual mode (resolve auto)
  const actualMode =
    effectiveMode === 'auto' ? (pieceCount >= threshold ? 'rbush' : 'global') : effectiveMode;

  const stats = ui.spatialStats ?? {
    itemsByLayer: {},
    rebuilds: 0,
    queries: { GLOBAL: 0, RBUSH: 0, FALLBACK: 0 },
  };

  const perfGlobal = stats.perf?.global;
  const perfRBush = stats.perf?.rbush;

  // Mode change handlers
  const setSpatialMode = (mode: 'global' | 'rbush' | 'auto') => {
    useSceneStore.setState((state) => ({
      ...state,
      ui: {
        ...state.ui,
        spatialEngine: mode,
      },
    }));
    if ((window as any).__DBG_DRAG__) {
      console.log(`[SPATIAL] Mode set to: ${mode}`);
    }
  };

  // Format duration
  const fmt = (ms: number | undefined) => (ms !== undefined ? `${ms.toFixed(3)}ms` : 'N/A');

  const totalItems = Object.values(stats.itemsByLayer).reduce((sum, count) => sum + count, 0);

  return (
    <Card data-testid="spatial-metrics" aria-label="Spatial metrics" className="text-xs">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Spatial Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Mode Status */}
        <div className="border-b pb-2">
          <div className="font-semibold mb-1">
            Mode: <span className="text-blue-600">{effectiveMode.toUpperCase()}</span>
            {override && <span className="text-orange-600"> (override)</span>}
          </div>
          <div className="text-[10px] text-gray-600">
            Actual: <span className="font-mono">{actualMode}</span> | Threshold: {threshold} |
            Pieces: {pieceCount}
          </div>
        </div>

        {/* Mode Controls */}
        <div>
          <div className="font-semibold mb-1">Force Mode:</div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={effectiveMode === 'global' ? 'default' : 'outline'}
              onClick={() => setSpatialMode('global')}
              className="text-[10px] h-6 px-2"
            >
              Global
            </Button>
            <Button
              size="sm"
              variant={effectiveMode === 'rbush' ? 'default' : 'outline'}
              onClick={() => setSpatialMode('rbush')}
              className="text-[10px] h-6 px-2"
            >
              RBush
            </Button>
            <Button
              size="sm"
              variant={effectiveMode === 'auto' ? 'default' : 'outline'}
              onClick={() => setSpatialMode('auto')}
              className="text-[10px] h-6 px-2"
            >
              Auto
            </Button>
          </div>
        </div>

        {/* Index Stats */}
        <div className="border-t pt-2">
          <div className="font-semibold">Index Stats:</div>
          <div className="grid grid-cols-2 gap-x-2 text-[10px] mt-1">
            <div>Total items:</div>
            <div className="font-mono">{totalItems}</div>
            <div>Rebuilds:</div>
            <div className="font-mono">{stats.rebuilds}</div>
          </div>
        </div>

        {/* Query Counts */}
        <div className="border-t pt-2">
          <div className="font-semibold mb-1">Query Counts:</div>
          <div className="grid grid-cols-2 gap-x-2 text-[10px]">
            <div>GLOBAL:</div>
            <div className="font-mono">{stats.queries.GLOBAL}</div>
            <div>RBUSH:</div>
            <div className="font-mono">{stats.queries.RBUSH}</div>
            <div>FALLBACK:</div>
            <div className="font-mono">{stats.queries.FALLBACK}</div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="border-t pt-2">
          <div className="font-semibold mb-1">Performance:</div>
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1">Mode</th>
                <th className="text-right py-1">Samples</th>
                <th className="text-right py-1">Avg</th>
                <th className="text-right py-1">P95</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-1">Global</td>
                <td className="text-right font-mono">{perfGlobal?.samples.length ?? 0}</td>
                <td className="text-right font-mono">{fmt(perfGlobal?.avg)}</td>
                <td className="text-right font-mono">{fmt(perfGlobal?.p95)}</td>
              </tr>
              <tr>
                <td className="py-1">RBush</td>
                <td className="text-right font-mono">{perfRBush?.samples.length ?? 0}</td>
                <td className="text-right font-mono">{fmt(perfRBush?.avg)}</td>
                <td className="text-right font-mono">{fmt(perfRBush?.p95)}</td>
              </tr>
            </tbody>
          </table>

          {/* Speedup calculation */}
          {perfGlobal && perfRBush && perfGlobal.avg > 0 && perfRBush.avg > 0 && (
            <div className="mt-2 text-[10px] text-green-700 font-semibold">
              Speedup: {(perfGlobal.avg / perfRBush.avg).toFixed(2)}x faster
            </div>
          )}
        </div>

        {/* Items by Layer */}
        <div className="border-t pt-2">
          <div className="font-semibold mb-1">Items by Layer:</div>
          <div className="grid grid-cols-2 gap-x-2 text-[10px]">
            {Object.entries(stats.itemsByLayer).map(([layerId, count]) => (
              <>
                <div key={`${layerId}-label`}>{layerId}:</div>
                <div key={`${layerId}-value`} className="font-mono">
                  {count}
                </div>
              </>
            ))}
            {Object.keys(stats.itemsByLayer).length === 0 && (
              <div className="col-span-2 text-gray-400">No layers indexed</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
