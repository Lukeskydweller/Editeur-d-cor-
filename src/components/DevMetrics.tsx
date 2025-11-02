import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSpatialStats, isAutoEnabled, getAutoThreshold } from '@/lib/spatial/globalIndex';
import { metrics, getAll } from '@/lib/metrics';
import { useSceneStore } from '@/state/useSceneStore';

export function DevMetrics() {
  const [, setTick] = useState(0);

  // Refresh every second for live stats
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const stats = getSpatialStats();
  const flagEnabled = window.__flags?.USE_GLOBAL_SPATIAL ?? false;
  const autoEnabled = isAutoEnabled();
  const { minOn, maxOff } = getAutoThreshold();
  const pieceCount = Object.keys(useSceneStore.getState().scene.pieces).length;
  const allMetrics = getAll();

  // Parse shortlist source metrics
  const shortlistMetrics: Record<string, Record<string, number>> = {};
  const fnNames = ['snapToPieces', 'snapGroupToPieces', 'collisionsForPiece', 'collisionsSameLayer'];
  const sources = ['GLOBAL_IDX', 'RBUSH', 'FALLBACK', 'ALL'];

  for (const fn of fnNames) {
    shortlistMetrics[fn] = {};
    for (const source of sources) {
      const key = `shortlist_source_total{fn=${fn},source=${source}}`;
      shortlistMetrics[fn][source] = allMetrics[key] ?? 0;
    }
  }

  return (
    <Card data-testid="dev-metrics" aria-label="Dev metrics">
      <CardHeader>
        <CardTitle className="text-sm">Dev Metrics</CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div>
          <span className="font-semibold">
            Spatial: AUTO[{autoEnabled ? 'ON' : 'OFF'}] threshold on≥{minOn}/off≤{maxOff}
          </span>
        </div>
        <div>
          <span className="font-semibold">Piece count:</span> {pieceCount}
        </div>
        <div>
          <span className="font-semibold">RBush[{flagEnabled ? 'ON' : 'OFF'}] items:</span> {stats.items}
        </div>
        <div>
          <span className="font-semibold">Rebuilds:</span> {stats.rebuilds}
        </div>
        <div>
          <span className="font-semibold">Last rebuild:</span> {Number(stats.lastRebuildMs).toFixed(1)}ms
        </div>
        <div>
          <span className="font-semibold">Snap candidates:</span> {metrics.rbush_candidates_snap_total}
        </div>
        <div>
          <span className="font-semibold">Collision candidates:</span> {metrics.rbush_candidates_collision_total}
        </div>

        <div className="pt-2">
          <div className="font-semibold mb-1">Shortlist Sources:</div>
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="border px-1 text-left">Function</th>
                <th className="border px-1">GLOBAL</th>
                <th className="border px-1">RBUSH</th>
                <th className="border px-1">FALLBACK</th>
                <th className="border px-1">ALL</th>
              </tr>
            </thead>
            <tbody>
              {fnNames.map(fn => (
                <tr key={fn}>
                  <td className="border px-1 text-left">{fn}</td>
                  <td className="border px-1 text-center">{shortlistMetrics[fn]?.GLOBAL_IDX ?? 0}</td>
                  <td className="border px-1 text-center">{shortlistMetrics[fn]?.RBUSH ?? 0}</td>
                  <td className="border px-1 text-center">{shortlistMetrics[fn]?.FALLBACK ?? 0}</td>
                  <td className="border px-1 text-center">{shortlistMetrics[fn]?.ALL ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
