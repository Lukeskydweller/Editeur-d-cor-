import { useEffect, useState, useMemo } from 'react';
import { useSceneStore } from '../state/useSceneStore';
import { selectProblems, subscribe } from '../store/editorStore';
import { computeMaterialUsage, type MaterialUsage } from '../lib/materialUsage';

export default function SidebarMaterials() {
  const scene = useSceneStore((s) => s.scene);
  const [problems, setProblems] = useState(() => selectProblems().problems);

  useEffect(() => {
    return subscribe(() => {
      setProblems(selectProblems().problems);
    });
  }, []);

  const usage = useMemo(() => computeMaterialUsage(scene, problems), [scene, problems]);

  return (
    <section aria-label="Matières" data-testid="materials-panel" className="px-3 py-2 space-y-2">
      <h3 className="text-sm font-medium">Matières</h3>
      {usage.length === 0 ? (
        <div className="text-xs text-muted-foreground">Aucune matière utilisée</div>
      ) : (
        <ul className="space-y-1" role="list">
          {usage.map((u) => (
            <li
              key={u.materialId}
              data-testid={`mat-${u.materialId}`}
              className="text-xs flex items-start justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{u.materialName}</div>
                <div className="text-muted-foreground">
                  {u.sheets} plaque{u.sheets > 1 ? 's' : ''} · remplissage {u.fillLastPct}%
                  {u.warnOrientationCount > 0 && (
                    <span className="ml-2 text-amber-600" data-testid={`mat-warn-${u.materialId}`}>
                      WARN orientation ×{u.warnOrientationCount}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 tabular-nums text-muted-foreground">
                {(u.totalAreaMm2 / 100).toFixed(0)} cm²
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
