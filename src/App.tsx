import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useSceneStore } from '@/state/useSceneStore';
import { validateNoOverlap, validateInsideScene } from '@/lib/sceneRules';

export default function App() {
  const scene = useSceneStore((s) => s.scene);
  const initSceneWithDefaults = useSceneStore((s) => s.initSceneWithDefaults);

  // Smoke: init 600×600 + 1 layer + 1 material + 1 piece
  useEffect(() => {
    if (scene.layerOrder.length === 0) {
      initSceneWithDefaults(600, 600);
    }
  }, [scene.layerOrder.length, initSceneWithDefaults]);

  // Validation des règles
  const noOverlap = validateNoOverlap(scene);
  const insideScene = validateInsideScene(scene);
  const hasProblems = !noOverlap.ok || !insideScene.ok;
  const problemCount =
    (noOverlap.ok ? 0 : noOverlap.conflicts.length) +
    (insideScene.ok ? 0 : insideScene.outside.length);

  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <Card className="w-full max-w-5xl">
        <CardContent className="p-6 space-y-4">
          <header className="flex items-baseline justify-between">
            <h1 className="text-2xl font-bold">Éditeur — Mini smoke</h1>
            <div className="text-sm text-muted-foreground">
              {Object.keys(scene.pieces).length} pièce(s) • {scene.size.w}×{scene.size.h} mm
            </div>
          </header>

          {/* Barre de statut des règles */}
          <div
            className={`rounded-lg px-4 py-3 text-sm font-medium ${
              hasProblems
                ? 'bg-red-500/20 text-red-200 border border-red-500/40'
                : 'bg-green-500/20 text-green-200 border border-green-500/40'
            }`}
            role="status"
            aria-live="polite"
          >
            {hasProblems ? (
              <>
                <div className="font-bold">
                  BLOCK — {problemCount} problème{problemCount > 1 ? 's' : ''} détecté{problemCount > 1 ? 's' : ''}
                </div>
                {!noOverlap.ok && (
                  <div className="mt-1">
                    Chevauchements : {noOverlap.conflicts.map(([a, b]) => `(${a}, ${b})`).join(', ')}
                  </div>
                )}
                {!insideScene.ok && (
                  <div className="mt-1">
                    Hors-scène : {insideScene.outside.join(', ')}
                  </div>
                )}
              </>
            ) : (
              <div>OK — aucune anomalie détectée</div>
            )}
          </div>

          {/* Canvas SVG */}
          <div className="w-full overflow-auto rounded-xl border border-white/10 bg-black/20">
            <svg
              width="100%"
              viewBox={`0 0 ${scene.size.w} ${scene.size.h}`}
              className="block"
              role="img"
              aria-label="editor-canvas"
            >
              {/* fond */}
              <rect x="0" y="0" width={scene.size.w} height={scene.size.h} fill="#0f172a" />
              {/* pièces rect */}
              {Object.values(scene.pieces).map((p) => {
                if (p.kind !== 'rect') return null;
                const { x, y } = p.position;
                const { w, h } = p.size;
                return (
                  <g key={p.id} transform={`translate(${x} ${y}) rotate(${p.rotationDeg})`}>
                    <rect
                      x="0"
                      y="0"
                      width={w}
                      height={h}
                      rx="6"
                      ry="6"
                      fill="#60a5fa" /* bleu */
                      stroke="#1e3a8a"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}
              {/* bordure scène */}
              <rect
                x="0.5"
                y="0.5"
                width={scene.size.w - 1}
                height={scene.size.h - 1}
                fill="none"
                stroke="#94a3b8"
                strokeDasharray="8 8"
                strokeWidth="1"
              />
            </svg>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
