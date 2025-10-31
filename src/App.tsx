import { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSceneStore } from '@/state/useSceneStore';
import { validateNoOverlap, validateInsideScene } from '@/lib/sceneRules';
import { pxToMmFactor } from '@/lib/ui/coords';

export default function App() {
  const scene = useSceneStore((s) => s.scene);
  const initSceneWithDefaults = useSceneStore((s) => s.initSceneWithDefaults);
  const selectedId = useSceneStore((s) => s.ui.selectedId);
  const selectPiece = useSceneStore((s) => s.selectPiece);
  const nudgeSelected = useSceneStore((s) => s.nudgeSelected);
  const flashInvalidAt = useSceneStore((s) => s.ui.flashInvalidAt);

  const dragging = useSceneStore((s) => s.ui.dragging);
  const beginDrag = useSceneStore((s) => s.beginDrag);
  const updateDrag = useSceneStore((s) => s.updateDrag);
  const endDrag = useSceneStore((s) => s.endDrag);
  const cancelDrag = useSceneStore((s) => s.cancelDrag);
  const addRectAtCenter = useSceneStore((s) => s.addRectAtCenter);
  const deleteSelected = useSceneStore((s) => s.deleteSelected);

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragFactorRef = useRef<number>(1);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Smoke: init 600×600 + 1 layer + 1 material + 1 piece
  useEffect(() => {
    if (scene.layerOrder.length === 0) {
      initSceneWithDefaults(600, 600);
    }
  }, [scene.layerOrder.length, initSceneWithDefaults]);

  // Gestion du nudge clavier + Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete key
      if (e.key === 'Delete') {
        e.preventDefault();
        deleteSelected();
        return;
      }

      // Arrow keys
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
  }, [nudgeSelected, deleteSelected]);

  // Gestion du drag souris
  const handlePointerDown = (e: React.PointerEvent, pieceId: string) => {
    e.stopPropagation();

    // Calculer le facteur px→mm à partir du SVG
    const rect = svgRef.current?.getBoundingClientRect();
    const factor = pxToMmFactor(rect?.width ?? 0, scene.size.w);
    dragFactorRef.current = factor;

    dragStartRef.current = { x: e.clientX, y: e.clientY };
    beginDrag(pieceId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragStartRef.current) return;

    const dxPx = e.clientX - dragStartRef.current.x;
    const dyPx = e.clientY - dragStartRef.current.y;

    // Convertir pixels → mm
    const dxMm = dxPx * dragFactorRef.current;
    const dyMm = dyPx * dragFactorRef.current;

    updateDrag(dxMm, dyMm);
  };

  const handlePointerUp = () => {
    if (!dragging) return;

    endDrag();
    dragStartRef.current = null;
    dragFactorRef.current = 1;
  };

  const handlePointerLeave = () => {
    if (!dragging) return;

    cancelDrag();
    dragStartRef.current = null;
    dragFactorRef.current = 1;
  };

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

          {/* Toolbar */}
          <div className="flex gap-2">
            <Button onClick={() => addRectAtCenter(100, 60)}>Ajouter rectangle</Button>
            <Button onClick={deleteSelected} disabled={!selectedId} variant="destructive">
              Supprimer
            </Button>
          </div>

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
          <div
            className="w-full overflow-auto rounded-xl border border-white/10 bg-black/20"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
          >
            <svg
              width="100%"
              ref={svgRef}
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
                      onPointerDown={(e) => handlePointerDown(e, p.id)}
                      style={{ cursor: 'pointer' }}
                      className={isFlashingInvalid ? 'drop-shadow-[0_0_10px_rgba(239,68,68,0.9)]' : ''}
                    />
                  </g>
                );
              })}
              {/* Ghost piece pendant drag */}
              {dragging && dragging.candidate && (() => {
                const piece = scene.pieces[dragging.id];
                if (!piece || piece.kind !== 'rect') return null;

                const { w, h } = piece.size;
                const { x, y, valid } = dragging.candidate;

                return (
                  <g
                    key="ghost"
                    transform={`translate(${x} ${y}) rotate(0)`}
                    data-testid="ghost-piece"
                    data-valid={valid ? 'true' : 'false'}
                  >
                    <rect
                      x="0"
                      y="0"
                      width={w}
                      height={h}
                      rx="6"
                      ry="6"
                      fill={valid ? '#60a5fa' : '#ef4444'}
                      fillOpacity="0.5"
                      stroke={valid ? '#22d3ee' : '#ef4444'}
                      strokeWidth="3"
                      strokeDasharray="4 4"
                      pointerEvents="none"
                    />
                  </g>
                );
              })()}
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
