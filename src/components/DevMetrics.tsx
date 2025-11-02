import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSpatialStats } from '@/lib/spatial/globalIndex';
import { metrics } from '@/lib/metrics';

export function DevMetrics() {
  const [, setTick] = useState(0);

  // Refresh every second for live stats
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const stats = getSpatialStats();
  const flagEnabled = window.__flags?.USE_GLOBAL_SPATIAL ?? false;

  return (
    <Card data-testid="dev-metrics" aria-label="Dev metrics">
      <CardHeader>
        <CardTitle className="text-sm">Dev Metrics</CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-1">
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
      </CardContent>
    </Card>
  );
}
