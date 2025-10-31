import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useSceneStore } from '@/state/useSceneStore';
import { validateNoOverlap, validateInsideScene } from '@/lib/sceneRules';

export default function App() {
  const scene = useSceneStore((s) => s.scene);
  const initSceneWithDefaults = useSceneStore((s) => s.initSceneWithDefaults);
  const selectedId = useSceneStore((s) => s.ui.selectedId);
  const selectPiece = useSceneStore((s) => s.selectPiece);
  const nudgeSelected = useSceneStore((s) => s.nudgeSelected);
  const flashInvalidAt = useSceneStore((s) => s.ui.flashInvalidAt);

  // Smoke: init 600×600 + 1 layer + 1 material + 1 piece
  useEffect(() => {
    if (scene.layerOrder.length === 0) {
      initSceneWithDefaults(600, 600);
    }
  }, [scene.layerOrder.length, initSceneWithDefaults]);

  // Gestion du nudge clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();

      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowLeft') dx = -step;
      if (e.key === 'ArrowRight') dx = step;
      if (e.key === 'ArrowUp') dy = -step;
      if (e.key === 'ArrowDown') dy = step;

      nudgeSelected(dx, dy);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nudgeSelected]);

  // Validation des règles
  const noOverlap = validateNoOverlap(scene);
  const insideScene = validateInsideScene(scene);
  const hasProblems = !noOverlap.ok || !insideScene.ok;
  const problemCount =
    (noOverlap.ok ? 0 : noOverlap.conflicts.length) +
    (insideScene.ok ? 0 : insideScene.outside.length);

  return (
    <main className="min-h-dvh flex items-center justify-center p-6" tabIndex={0}>
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
                const isSelected = p.id === selectedId;
                const isFlashingInvalid = isSelected && flashInvalidAt && Date.now() - flashInvalidAt < 200;

                return (
                  <g
                    key={p.id}
                    transform={`translate(${x} ${y}) rotate(${p.rotationDeg})`}
                    data-testid={isSelected ? 'piece-selected' : undefined}
                    data-invalid={isFlashingInvalid ? 'true' : undefined}
                  >
                    <rect
                      x="0"
                      y="0"
                      width={w}
                      height={h}
                      rx="6"
                      ry="6"
                      fill="#60a5fa" /* bleu */
                      stroke={isFlashingInvalid ? '#ef4444' : isSelected ? '#22d3ee' : '#1e3a8a'}
                      strokeWidth={isFlashingInvalid ? '4' : isSelected ? '3' : '2'}
                      onClick={() => selectPiece(p.id)}
                      style={{ cursor: 'pointer' }}
                      className={isFlashingInvalid ? 'drop-shadow-[0_0_10px_rgba(239,68,68,0.9)]' : ''}
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
