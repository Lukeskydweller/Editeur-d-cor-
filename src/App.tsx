import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSceneStore } from '@/state/useSceneStore';
import { validateNoOverlap, validateInsideScene, validateMaterialOrientation } from '@/lib/sceneRules';
import { pxToMmFactor } from '@/lib/ui/coords';
import { Sidebar } from '@/components/Sidebar';
import { ResizeHandlesOverlay } from '@/components/ResizeHandlesOverlay';
import type { ResizeHandle } from '@/lib/ui/resize';
import { pieceBBox, aabbToPiecePosition } from '@/lib/geom';

export default function App() {
  const scene = useSceneStore((s) => s.scene);
  const initSceneWithDefaults = useSceneStore((s) => s.initSceneWithDefaults);
  const selectedId = useSceneStore((s) => s.ui.selectedId);
  const selectedIds = useSceneStore((s) => s.ui.selectedIds);
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
  const snap10mm = useSceneStore((s) => s.ui.snap10mm ?? true);
  const setSnap10mm = useSceneStore((s) => s.setSnap10mm);
  const rotateSelected = useSceneStore((s) => s.rotateSelected);
  const setSelectedRotation = useSceneStore((s) => s.setSelectedRotation);
  const duplicateSelected = useSceneStore((s) => s.duplicateSelected);
  const guides = useSceneStore((s) => s.ui.guides);
  const toggleSelect = useSceneStore((s) => s.toggleSelect);
  const clearSelection = useSceneStore((s) => s.clearSelection);
  const selectAll = useSceneStore((s) => s.selectAll);
  const startMarquee = useSceneStore((s) => s.startMarquee);
  const updateMarquee = useSceneStore((s) => s.updateMarquee);
  const endMarquee = useSceneStore((s) => s.endMarquee);
  const marquee = useSceneStore((s) => s.ui.marquee);
  const undo = useSceneStore((s) => s.undo);
  const redo = useSceneStore((s) => s.redo);
  const toSceneFileV1 = useSceneStore((s) => s.toSceneFileV1);
  const importSceneFileV1 = useSceneStore((s) => s.importSceneFileV1);
  const resizing = useSceneStore((s) => s.ui.resizing);
  const startResize = useSceneStore((s) => s.startResize);
  const updateResize = useSceneStore((s) => s.updateResize);
  const endResize = useSceneStore((s) => s.endResize);
  const lockEdge = useSceneStore((s) => s.ui.lockEdge ?? false);
  const setLockEdge = useSceneStore((s) => s.setLockEdge);

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragFactorRef = useRef<number>(1);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeFactorRef = useRef<number>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resizeStartRef = useRef<{ x: number; y: number } | null>(null);
  const resizeFactorRef = useRef<number>(1);

  const [importError, setImportError] = useState<string | null>(null);

  // Smoke: init 600×600 + 1 layer + 1 material + 1 piece
  useEffect(() => {
    if (scene.layerOrder.length === 0) {
      initSceneWithDefaults(600, 600);
    }
  }, [scene.layerOrder.length, initSceneWithDefaults]);

  // Gestion du nudge clavier + Delete + Rotation + Duplication + Escape + Ctrl+A + Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space → Prevent page scroll (used for drag mode)
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        return;
      }

      // Ctrl+Z → Undo
      if (e.key === 'z' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z → Redo (support metaKey for Mac)
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        redo();
        return;
      }

      // Escape → Cancel resize or clear selection
      if (e.key === 'Escape') {
        e.preventDefault();
        if (resizing) {
          endResize(false);
          resizeStartRef.current = null;
          resizeFactorRef.current = 1;
        } else {
          clearSelection();
        }
        return;
      }

      // Ctrl+A → Select all
      if (e.key === 'a' && e.ctrlKey) {
        e.preventDefault();
        selectAll();
        return;
      }

      // Ctrl+D → Duplicate
      if (e.key === 'd' && e.ctrlKey) {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      // Delete key
      if (e.key === 'Delete') {
        e.preventDefault();
        deleteSelected();
        return;
      }

      // Rotation keys
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (e.shiftKey) {
          rotateSelected(-90);
        } else {
          rotateSelected(90);
        }
        return;
      }

      if (e.key === '0') {
        e.preventDefault();
        setSelectedRotation(0);
        return;
      }

      if (e.key === '9') {
        e.preventDefault();
        setSelectedRotation(90);
        return;
      }

      // Arrow keys
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();

      // Step depends on snap10mm: ON = 10mm, OFF = 1mm
      const step = snap10mm ? 10 : 1;
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
  }, [nudgeSelected, deleteSelected, rotateSelected, setSelectedRotation, duplicateSelected, clearSelection, selectAll, undo, redo, resizing, endResize, snap10mm]);

  // Export JSON
  const handleExport = () => {
    const data = toSceneFileV1();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Generate filename with timestamp
    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/T/, '-')
      .replace(/:/g, '')
      .slice(0, 17); // YYYYMMDD-HHMMSS
    const filename = `scene-v1-${timestamp}.json`;

    // Create temp anchor and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    // Cleanup
    URL.revokeObjectURL(url);
  };

  // Import JSON
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      importSceneFileV1(data);
      setImportError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Format invalide ou erreur de parsing JSON';
      setImportError(message);
    }

    // Reset input so the same file can be imported again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Gestion du drag souris
  const handlePointerDown = (e: React.PointerEvent, pieceId: string) => {
    e.stopPropagation();

    // Don't start drag if resizing
    if (resizing) return;

    // Shift-click → toggle selection
    if (e.shiftKey) {
      toggleSelect(pieceId);
      return;
    }

    // Calculer le facteur px→mm à partir du SVG
    const rect = svgRef.current?.getBoundingClientRect();
    const factor = pxToMmFactor(rect?.width ?? 0, scene.size.w);
    dragFactorRef.current = factor;

    dragStartRef.current = { x: e.clientX, y: e.clientY };
    beginDrag(pieceId);
  };

  // Gestion marquee (fond SVG)
  const handleBackgroundPointerDown = (e: React.PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const factor = pxToMmFactor(rect.width, scene.size.w);
    marqueeFactorRef.current = factor;

    const svgX = (e.clientX - rect.left) * factor;
    const svgY = (e.clientY - rect.top) * factor;

    marqueeStartRef.current = { x: e.clientX, y: e.clientY };
    startMarquee(svgX, svgY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragging && dragStartRef.current) {
      const dxPx = e.clientX - dragStartRef.current.x;
      const dyPx = e.clientY - dragStartRef.current.y;

      const dxMm = dxPx * dragFactorRef.current;
      const dyMm = dyPx * dragFactorRef.current;

      updateDrag(dxMm, dyMm);
    } else if (resizing && resizeStartRef.current) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      const svgX = (e.clientX - rect.left) * resizeFactorRef.current;
      const svgY = (e.clientY - rect.top) * resizeFactorRef.current;

      updateResize({ x: svgX, y: svgY });
    } else if (marquee && marqueeStartRef.current) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      const svgX = (e.clientX - rect.left) * marqueeFactorRef.current;
      const svgY = (e.clientY - rect.top) * marqueeFactorRef.current;
      updateMarquee(svgX, svgY);
    }
  };

  const handlePointerUp = () => {
    if (dragging) {
      endDrag();
      dragStartRef.current = null;
      dragFactorRef.current = 1;
    } else if (resizing) {
      endResize(true);
      resizeStartRef.current = null;
      resizeFactorRef.current = 1;
    } else if (marquee) {
      endMarquee();
      marqueeStartRef.current = null;
      marqueeFactorRef.current = 1;
    }
  };

  const handlePointerLeave = () => {
    if (dragging) {
      cancelDrag();
      dragStartRef.current = null;
      dragFactorRef.current = 1;
    } else if (resizing) {
      endResize(false);
      resizeStartRef.current = null;
      resizeFactorRef.current = 1;
    } else if (marquee) {
      endMarquee();
      marqueeStartRef.current = null;
      marqueeFactorRef.current = 1;
    }
  };

  // Resize handle start
  const handleResizeStart = (pieceId: string, handle: ResizeHandle, clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const factor = pxToMmFactor(rect.width, scene.size.w);
    resizeFactorRef.current = factor;

    // Convert client coordinates to SVG mm coordinates
    const svgX = (clientX - rect.left) * factor;
    const svgY = (clientY - rect.top) * factor;

    resizeStartRef.current = { x: clientX, y: clientY };

    startResize(pieceId, handle);
    updateResize({ x: svgX, y: svgY });
  };

  const handleResizeMove = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !resizeStartRef.current) return;

    const factor = resizeFactorRef.current;
    const svgX = (clientX - rect.left) * factor;
    const svgY = (clientY - rect.top) * factor;

    updateResize({ x: svgX, y: svgY });
  };

  const handleResizeEnd = () => {
    endResize(true);
    resizeStartRef.current = null;
  };

  // Validation des règles
  const noOverlap = validateNoOverlap(scene);
  const insideScene = validateInsideScene(scene);
  const orientation = validateMaterialOrientation(scene);
  const hasProblems = !noOverlap.ok || !insideScene.ok;
  const problemCount =
    (noOverlap.ok ? 0 : noOverlap.conflicts.length) +
    (insideScene.ok ? 0 : insideScene.outside.length);
  const hasWarnings = !orientation.ok;

  return (
    <main className="min-h-dvh p-6" tabIndex={0}>
      <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-[18rem_1fr] gap-6 items-start">
        <div className="relative z-20">
          <Sidebar />
        </div>

        <section className="relative z-10">
          <Card className="w-full">
            <CardContent className="p-6 space-y-4">
              <header className="flex items-baseline justify-between">
                <h1 className="text-2xl font-bold">Éditeur — Mini smoke</h1>
                <div className="text-sm text-muted-foreground">
                  {Object.keys(scene.pieces).length} pièce(s) • {scene.size.w}×{scene.size.h} mm
                </div>
              </header>

              {/* Toolbar */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex gap-2">
                  <Button onClick={() => addRectAtCenter(100, 60)}>Ajouter rectangle</Button>
                  <Button onClick={duplicateSelected} disabled={!selectedId}>
                    Dupliquer
                  </Button>
                  <Button onClick={deleteSelected} disabled={!selectedId} variant="destructive">
                    Supprimer
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => rotateSelected(-90)} disabled={!selectedId} size="sm">
                    Rotate −90°
                  </Button>
                  <Button onClick={() => rotateSelected(90)} disabled={!selectedId} size="sm">
                    Rotate +90°
                  </Button>
                  <Button onClick={() => setSelectedRotation(0)} disabled={!selectedId} size="sm" variant="outline">
                    Rotation 0°
                  </Button>
                  <Button onClick={() => setSelectedRotation(90)} disabled={!selectedId} size="sm" variant="outline">
                    Rotation 90°
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleExport} size="sm" variant="outline" aria-label="export-json">
                    Exporter JSON
                  </Button>
                  <Button onClick={handleImportClick} size="sm" variant="outline" aria-label="import-json">
                    Importer JSON
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json"
                    onChange={handleImportChange}
                    className="hidden"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!snap10mm}
                    onChange={(e) => setSnap10mm(e.target.checked)}
                    aria-label="toggle-snap-10mm"
                    className="cursor-pointer"
                  />
                  <span>Snap 10 mm</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lockEdge}
                    onChange={(e) => setLockEdge(e.target.checked)}
                    aria-label="toggle-lock-edge"
                    className="cursor-pointer"
                  />
                  <span>Lock edge</span>
                </label>
              </div>

          {/* Barre de statut des règles */}
          <div className="space-y-2">
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

            {hasWarnings && (
              <div
                className="rounded-lg px-4 py-3 text-sm font-medium bg-yellow-500/20 text-yellow-200 border border-yellow-500/40"
                role="status"
                aria-live="polite"
                data-testid="warn-banner"
              >
                <div className="font-bold">
                  WARN — {orientation.warnings.length} matériau{orientation.warnings.length > 1 ? 'x' : ''} non aligné
                  {orientation.warnings.length > 1 ? 's' : ''}
                </div>
                <div className="mt-1 text-xs space-y-1">
                  {orientation.warnings.slice(0, 3).map((w) => (
                    <div key={w.pieceId}>
                      {w.pieceId} → {w.materialId} (attendu {w.expectedDeg}°, réel {w.actualDeg}°)
                    </div>
                  ))}
                  {orientation.warnings.length > 3 && (
                    <div className="text-yellow-300">... et {orientation.warnings.length - 3} de plus</div>
                  )}
                </div>
              </div>
            )}

            {importError && (
              <div
                className="rounded-lg px-4 py-3 text-sm font-medium bg-yellow-500/20 text-yellow-200 border border-yellow-500/40"
                role="status"
                aria-live="polite"
                data-testid="warn-banner"
              >
                <div className="font-bold">WARN — Import invalide</div>
                <div className="mt-1 text-xs">{importError}</div>
              </div>
            )}
          </div>

          {/* Canvas SVG */}
          <div
            className="relative w-full overflow-auto rounded-xl border border-white/10 bg-black/20"
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
              onPointerDown={handleBackgroundPointerDown}
            >
              {/* Grille 10mm */}
              <defs>
                <pattern id="grid10mm" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                </pattern>
              </defs>

              {/* fond */}
              <rect x="0" y="0" width={scene.size.w} height={scene.size.h} fill="#0f172a" />
              {/* grille sous les pièces */}
              <rect x="0" y="0" width={scene.size.w} height={scene.size.h} fill="url(#grid10mm)" />
              {/* pièces rect */}
              {Object.values(scene.pieces).map((p) => {
                if (p.kind !== 'rect') return null;
                const { x, y } = p.position;
                const { w, h } = p.size;
                const actualSelectedIds = selectedIds ?? (selectedId ? [selectedId] : []);
                const isSelected = actualSelectedIds.includes(p.id);
                const isFlashingInvalid = isSelected && flashInvalidAt && Date.now() - flashInvalidAt < 200;

                return (
                  <g
                    key={p.id}
                    transform={`translate(${x} ${y}) rotate(${p.rotationDeg ?? 0} ${w / 2} ${h / 2})`}
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

                // Ghost must show the piece AS IT WILL APPEAR after drop
                // This means: using piece.position (converted from AABB candidate)
                // with the piece's actual rotation and original size
                const { x, y, valid } = dragging.candidate;
                const { w, h } = piece.size; // Original size, not AABB

                // Convert AABB position back to piece.position for rendering
                const ghostPiecePos = aabbToPiecePosition(x, y, piece);

                return (
                  <g
                    key="ghost"
                    transform={`translate(${ghostPiecePos.x} ${ghostPiecePos.y}) rotate(${piece.rotationDeg ?? 0} ${w / 2} ${h / 2})`}
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
              {/* Snap guides */}
              {guides && guides.length > 0 && (
                <g data-testid="snap-guides">
                  {guides.map((guide, i) => {
                    if (guide.kind === 'v') {
                      return (
                        <line
                          key={`v-${i}`}
                          x1={guide.x}
                          y1={0}
                          x2={guide.x}
                          y2={scene.size.h}
                          stroke="#22d3ee"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                          pointerEvents="none"
                        />
                      );
                    } else {
                      return (
                        <line
                          key={`h-${i}`}
                          x1={0}
                          y1={guide.y}
                          x2={scene.size.w}
                          y2={guide.y}
                          stroke="#22d3ee"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                          pointerEvents="none"
                        />
                      );
                    }
                  })}
                </g>
              )}
              {/* Marquee */}
              {marquee && (() => {
                const { x0, y0, x1, y1 } = marquee;
                const minX = Math.min(x0, x1);
                const minY = Math.min(y0, y1);
                const width = Math.abs(x1 - x0);
                const height = Math.abs(y1 - y0);
                return (
                  <rect
                    key="marquee"
                    x={minX}
                    y={minY}
                    width={width}
                    height={height}
                    fill="rgba(34,211,238,0.1)"
                    stroke="#22d3ee"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    pointerEvents="none"
                    data-testid="marquee"
                  />
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
            {/* Resize handles overlay - only for single selection and rotation 0° */}
            {selectedId && (!selectedIds || selectedIds.length === 1) && (() => {
              const piece = scene.pieces[selectedId];
              if (!piece || piece.kind !== 'rect') return null;

              // V1: Only show handles for non-rotated pieces (axis-aligned)
              if (piece.rotationDeg !== 0) return null;

              const rect = {
                x: piece.position.x,
                y: piece.position.y,
                w: piece.size.w,
                h: piece.size.h,
              };

              return (
                <ResizeHandlesOverlay
                  rect={rect}
                  svgElement={svgRef.current}
                  onStart={(handle, clientX, clientY) => handleResizeStart(selectedId, handle, clientX, clientY)}
                  onMove={handleResizeMove}
                  onEnd={handleResizeEnd}
                  isResizing={!!resizing}
                />
              );
            })()}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
