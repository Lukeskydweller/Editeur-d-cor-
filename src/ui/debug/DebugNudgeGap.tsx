/**
 * Panneau de debug pour visualiser le pipeline nudge/gap en temps réel
 * Activé uniquement en dev avec VITE_DEBUG_NUDGE_GAP=true
 */

import { useSceneStore, type SceneStoreState } from '@/state/useSceneStore';
import { selectNearestGap, explainGap } from '@/store/selectors/gapSelector';
import { getEffectiveStep } from '@/lib/ui/keyboardStep';
import { getRecentTraces, DEBUG_ENABLED } from '@/lib/debug/pipelineTrace';
import { pieceBBox } from '@/lib/geom';
import { PX_TO_MM } from '@/constants/validation';
import { useMemo } from 'react';
import type { BBox } from '@/types/scene';

export default function DebugNudgeGap() {
  // N'afficher que si flag actif
  if (!DEBUG_ENABLED) return null;

  const scene = useSceneStore((s: SceneStoreState) => s.scene);
  const selectedId = useSceneStore((s: SceneStoreState) => s.ui.selectedId);
  const selectedIds = useSceneStore((s: SceneStoreState) => s.ui.selectedIds);
  const isTransientActive = useSceneStore((s: SceneStoreState) => s.ui.isTransientActive);
  const transientBBox = useSceneStore((s: SceneStoreState) => s.ui.transientBBox);
  const dragging = useSceneStore((s: SceneStoreState) => s.ui.dragging);
  const resizing = useSceneStore((s: SceneStoreState) => s.ui.resizing);
  const snap10mm = useSceneStore((s: SceneStoreState) => s.ui.snap10mm);

  // Calculer la bbox du sujet (commit & transitoire)
  const selIds = selectedIds ?? (selectedId ? [selectedId] : []);
  const selectedPieces = selIds.map((id: string) => scene.pieces[id]).filter(Boolean);

  let commitBBox: BBox | null = null;
  if (selectedPieces.length > 0) {
    const bboxes = selectedPieces.map((p: any) => pieceBBox(p!));
    const minX = Math.min(...bboxes.map((b: BBox) => b.x));
    const minY = Math.min(...bboxes.map((b: BBox) => b.y));
    const maxX = Math.max(...bboxes.map((b: BBox) => b.x + b.w));
    const maxY = Math.max(...bboxes.map((b: BBox) => b.y + b.h));
    commitBBox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  // Gap calculation
  const gapResult = useMemo(
    () =>
      selectNearestGap(
        { scene, ui: { selectedId, selectedIds } },
        isTransientActive && transientBBox ? { subjectOverride: transientBBox } : undefined,
      ),
    [scene, selectedId, selectedIds, isTransientActive, transientBBox],
  );

  // Explain gap details
  let gapDetails = null;
  if (commitBBox && gapResult.nearestId) {
    const neighborPiece = scene.pieces[gapResult.nearestId];
    if (neighborPiece) {
      const neighborBBox = pieceBBox(neighborPiece);
      const bboxToUse = isTransientActive && transientBBox ? transientBBox : commitBBox;
      gapDetails = explainGap(bboxToUse, neighborBBox);
    }
  }

  // Keyboard step
  const keyboardStep = getEffectiveStep({ shift: false, snap10mm: snap10mm ?? false });
  const keyboardStepShift = getEffectiveStep({ shift: true, snap10mm: snap10mm ?? false });

  // Mode actuel
  let mode = 'idle';
  if (dragging) mode = 'mouseDrag';
  else if (resizing) mode = 'resize';
  else if (selIds.length > 0) mode = 'keyboardNudge';

  // Recent traces
  const traces = getRecentTraces(3);

  return (
    <div
      style={{
        position: 'fixed',
        top: 10,
        left: 10,
        width: 420,
        maxHeight: '80vh',
        overflow: 'auto',
        background: 'rgba(0, 0, 0, 0.9)',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: 11,
        padding: 12,
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0, 255, 0, 0.3)',
        zIndex: 99999,
        userSelect: 'text',
        lineHeight: 1.4,
      }}
    >
      <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 'bold', color: '#0ff' }}>
        🔬 Debug Nudge & Gap
      </div>

      {/* Sélection */}
      <Section title="Sélection">
        {selIds.length === 0 && <Line label="État" value="Aucune" />}
        {selIds.length === 1 && (
          <>
            <Line label="Mode" value="Solo" />
            <Line label="ID" value={selIds[0]} />
          </>
        )}
        {selIds.length > 1 && (
          <>
            <Line label="Mode" value={`Groupe (${selIds.length})`} />
            <Line label="IDs" value={selIds.join(', ')} />
          </>
        )}
      </Section>

      {/* Mode */}
      <Section title="Mode">
        <Line label="Actuel" value={mode} />
        <Line label="Transient" value={isTransientActive ? 'OUI' : 'non'} />
      </Section>

      {/* BBox */}
      {commitBBox && (
        <Section title="BBox Sujet (px)">
          <Line label="Commit" value={formatBBox(commitBBox)} />
          {isTransientActive && transientBBox && (
            <Line label="Transient" value={formatBBox(transientBBox)} style={{ color: '#ff0' }} />
          )}
        </Section>
      )}

      {/* Gap */}
      <Section title="Gap">
        {gapResult.nearestId ? (
          <>
            <Line label="Nearest" value={gapResult.nearestId} />
            <Line label="Gap (mm)" value={gapResult.gapMm?.toFixed(2) ?? 'null'} />
            <Line label="Side" value={gapResult.side ?? 'null'} />
            {gapDetails && (
              <>
                <Line label="Mode" value={gapDetails.mode} />
                <Line label="Gap (px)" value={gapDetails.gapPx.toFixed(2)} />
                <Line
                  label="Directional"
                  value={`R:${gapDetails.gapRight.toFixed(1)} L:${gapDetails.gapLeft.toFixed(1)} B:${gapDetails.gapBottom.toFixed(1)} T:${gapDetails.gapTop.toFixed(1)}`}
                />
              </>
            )}
          </>
        ) : (
          <Line label="Nearest" value="Aucun voisin" />
        )}
      </Section>

      {/* Step clavier */}
      <Section title="Step Clavier">
        <Line label="Snap 10mm" value={snap10mm ? 'ON' : 'OFF'} />
        <Line
          label="Arrow"
          value={`${keyboardStep.stepMm.toFixed(2)}mm (${keyboardStep.stepPx.toFixed(2)}px)`}
        />
        <Line
          label="Shift+Arrow"
          value={`${keyboardStepShift.stepMm.toFixed(2)}mm (${keyboardStepShift.stepPx.toFixed(2)}px)`}
        />
      </Section>

      {/* Traces récentes */}
      {traces.length > 0 && (
        <Section title={`Traces (${traces.length} dernières)`}>
          {traces.map((t) => (
            <div
              key={t.tickId}
              style={{ marginBottom: 6, paddingLeft: 8, borderLeft: '2px solid #0f0' }}
            >
              <Line
                label={`#${t.tickId}`}
                value={`${t.source} [${t.committed ? 'OK' : t.rolledBack ? 'ROLLBACK' : 'PENDING'}]`}
              />
              <Line
                label="Gap final"
                value={t.finalGapMm !== null ? `${t.finalGapMm.toFixed(2)}mm` : 'null'}
                style={{ fontSize: 10 }}
              />
            </div>
          ))}
        </Section>
      )}

      <div style={{ marginTop: 10, fontSize: 9, color: '#888', textAlign: 'center' }}>
        window.__debugGap disponible dans console
      </div>
    </div>
  );
}

// Helper components
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: '#0ff', fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ paddingLeft: 8 }}>{children}</div>
    </div>
  );
}

function Line({
  label,
  value,
  style,
}: {
  label: string;
  value: string | number;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, ...style }}>
      <span style={{ color: '#888', minWidth: 90 }}>{label}:</span>
      <span style={{ color: '#0f0', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

function formatBBox(bbox: BBox): string {
  // Type intersection for optional rotationDeg (debug visualization only)
  type RotatedBBox = BBox & { rotationDeg?: number };
  const rot = (bbox as RotatedBBox).rotationDeg;
  return `x:${bbox.x.toFixed(1)} y:${bbox.y.toFixed(1)} w:${bbox.w.toFixed(1)} h:${bbox.h.toFixed(1)}${rot ? ` rot:${rot}°` : ''}`;
}
