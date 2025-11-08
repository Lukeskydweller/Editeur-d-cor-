import { useEffect, useMemo, useRef, useState } from 'react';
import { useSceneStore, type SceneStoreState } from '@/state/useSceneStore';
import {
  MIN_GAP_MM,
  TOOLTIP_GAP_MAX_MM,
  EPS_NORM_MM,
  EPS_UI_MM,
  uiLE,
  uiNEAR,
} from '@/constants/validation';
import { selectNearestGap } from '@/store/selectors/gapSelector';
import { pieceBBox } from '@/lib/geom';
import type { BBox } from '@/types/scene';

// Utilitaire: conversion coordonnées scène (mm) -> pixels écran (pour positionner le tooltip)
function scenePointToClient(p: { x: number; y: number }) {
  const svg = document.querySelector('svg');
  // Fallback sûr: on laisse le tooltip hors écran si pas de SVG dispo
  if (!svg || !(svg as any).getScreenCTM) return { left: -9999, top: -9999 };
  const ctm = (svg as any).getScreenCTM();
  // DOMPoint dispo sur la plateforme moderne; sinon SVGPoint (legacy)
  const domPt = (window as any).DOMPoint
    ? new DOMPoint(p.x, p.y)
    : ((svg as any).createSVGPoint?.call(svg, p.x, p.y) ?? {
        x: p.x,
        y: p.y,
        matrixTransform: () => ({ x: p.x, y: p.y }),
      });
  const t = domPt.matrixTransform(ctm);
  return { left: t.x, top: t.y };
}

export default function MicroGapTooltip() {
  const ui = useSceneStore((s: SceneStoreState) => s.ui);
  const scene = useSceneStore((s: SceneStoreState) => s.scene);
  const dragging = ui.dragging;
  const isTransientActive = ui.isTransientActive;

  // On ne lit la bbox transitoire que si le drag concerne la sélection
  const canUseOverride = !!(dragging && dragging.affectsSelection === true);

  // Calculer la bbox du sujet (sélection solo ou groupe)
  const computedBBox = useMemo(() => {
    const selectedIds = ui.selectedIds ?? (ui.selectedId ? [ui.selectedId] : []);
    if (selectedIds.length === 0) return null;

    const selectedPieces = selectedIds.map((id) => scene.pieces[id]).filter(Boolean);

    if (selectedPieces.length === 0) return null;

    // Calculer union des AABBs
    const bboxes = selectedPieces.map((p) => pieceBBox(p));
    const minX = Math.min(...bboxes.map((b) => b.x));
    const minY = Math.min(...bboxes.map((b) => b.y));
    const maxX = Math.max(...bboxes.map((b) => b.x + b.w));
    const maxY = Math.max(...bboxes.map((b) => b.y + b.h));

    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, [scene.pieces, ui.selectedId, ui.selectedIds]);

  const subjectBBox = canUseOverride && ui.transientBBox ? ui.transientBBox : computedBBox;

  // Mémorise l'étiquette précédente pour le correctif « 1,00 mm après bord à bord »
  const prevLabelRef = useRef<string | null>(null);
  const [anchorPx, setAnchorPx] = useState<{ left: number; top: number }>({
    left: -9999,
    top: -9999,
  });

  const nearest = useMemo(() => {
    if (!subjectBBox) return null;

    // Gap le plus proche autour de la sélection courante (ou transitoire si drag de la sélection)
    return selectNearestGap(
      {
        scene,
        ui: { selectedId: ui.selectedId, selectedIds: ui.selectedIds },
      },
      {
        ...(canUseOverride ? { subjectOverride: subjectBBox } : {}),
        // Exclure la bbox transitoire (ghost) pour éviter de mesurer contre soi-même
        excludeTransientBBox: ui.transientBBox,
      },
    );
  }, [
    scene.revision,
    subjectBBox?.x,
    subjectBBox?.y,
    subjectBBox?.w,
    subjectBBox?.h,
    ui.selectedId,
    ui.selectedIds,
    canUseOverride,
    ui.transientBBox,
  ]);

  // Calcul du label et de l'ancre (toujours faire le calcul, même si on ne rend rien)
  const { gapMm, side, nearestId } = nearest ?? { gapMm: null, side: null, nearestId: null };

  // Libellé — force « 1,00 mm » au premier nudge après bord à bord
  let label: string = '';
  const prev = prevLabelRef.current;
  const near1 = gapMm != null && uiNEAR(gapMm, MIN_GAP_MM);

  if (gapMm != null && gapMm < MIN_GAP_MM) {
    // Cas 1: < 1mm → « Bord à bord »
    label = 'Bord à bord';
  } else if (gapMm != null && uiLE(MIN_GAP_MM, gapMm) && uiLE(gapMm, MIN_GAP_MM + EPS_NORM_MM)) {
    // Cas 2: normalisation 1.00–1.12 → "1.00 mm"
    label = '1.00 mm';
  } else if (
    prev === 'Bord à bord' &&
    gapMm != null &&
    uiLE(MIN_GAP_MM, gapMm) &&
    uiLE(gapMm, MIN_GAP_MM + EPS_NORM_MM)
  ) {
    // Cas 3: juste après « Bord à bord », un nudge qui place dans [1.00;1.12] → "1.00 mm"
    label = '1.00 mm';
  } else if (near1) {
    // Cas 4: très proche de 1.00 (±0.02mm) → "1.00 mm"
    label = '1.00 mm';
  } else if (gapMm != null) {
    // Autres gaps → "X.XX mm"
    label = `${gapMm.toFixed(2)} mm`;
  }
  prevLabelRef.current = label;

  // Position: ancre = milieu du côté concerné de la bbox « sujet »
  const anchorScene = useMemo(() => {
    if (!subjectBBox || !side) return { x: 0, y: 0 };
    const sb = subjectBBox;
    return side === 'left'
      ? { x: sb.x, y: sb.y + sb.h / 2 }
      : side === 'right'
        ? { x: sb.x + sb.w, y: sb.y + sb.h / 2 }
        : side === 'top'
          ? { x: sb.x + sb.w / 2, y: sb.y }
          : { x: sb.x + sb.w / 2, y: sb.y + sb.h };
  }, [subjectBBox?.x, subjectBBox?.y, subjectBBox?.w, subjectBBox?.h, side]);

  useEffect(() => {
    if (!subjectBBox || !side) {
      setAnchorPx({ left: -9999, top: -9999 });
      return;
    }
    // Mise à jour immédiate (utile pour tests)…
    setAnchorPx(scenePointToClient(anchorScene));
    // …puis reflush dans le frame suivant si le CTM évolue (cas réel avec transforms)
    const raf =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(() => setAnchorPx(scenePointToClient(anchorScene)))
        : 0;
    return () => {
      if (typeof cancelAnimationFrame === 'function' && typeof raf === 'number') {
        cancelAnimationFrame(raf);
      }
    };
    // recalcul si scène révisée ou si la bbox (transitoire/commit) change
  }, [
    scene.revision,
    subjectBBox?.x,
    subjectBBox?.y,
    subjectBBox?.w,
    subjectBBox?.h,
    side,
    anchorScene,
  ]);

  // Cache si pas de voisin pertinent
  if (!nearest) return null;
  // Inclusif à 10.00 mm (avec epsilon, via helper)
  if (gapMm == null || !uiLE(gapMm, TOOLTIP_GAP_MAX_MM)) return null;
  if (!subjectBBox) return null;

  // Style du tooltip (position: fixed en px écran)
  const style: React.CSSProperties = {
    position: 'fixed',
    left: `${anchorPx.left}px`,
    top: `${anchorPx.top}px`,
    transform: 'translate(-50%, -8px)',
    pointerEvents: 'none',
    padding: '2px 6px',
    borderRadius: 6,
    fontSize: 11,
    lineHeight: 1.2,
    background: 'rgba(24, 24, 27, 0.92)',
    color: 'white',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
    userSelect: 'none',
    zIndex: 1000,
  };

  return (
    <div
      className="micro-gap-tooltip"
      style={style}
      data-testid="micro-gap-tooltip"
      aria-hidden="true"
    >
      {label}
    </div>
  );
}
