import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useSceneStore } from '@/state/useSceneStore';

export default function App() {
  const scene = useSceneStore((s) => s.scene);
  const initSceneWithDefaults = useSceneStore((s) => s.initSceneWithDefaults);

  // Smoke: init 600×600 + 1 layer + 1 material + 1 piece
  useEffect(() => {
    if (scene.layerOrder.length === 0) {
      initSceneWithDefaults(600, 600);
    }
  }, [scene.layerOrder.length, initSceneWithDefaults]);

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
