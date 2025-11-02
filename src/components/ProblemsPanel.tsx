import { useEffect, useState } from "react";
import { selectProblems, subscribe } from "../store/editorStore";
import { useSceneStore } from "../state/useSceneStore";
import type { Problem, ProblemCode } from "../core/contracts/scene";

const LABELS: Partial<Record<ProblemCode, string>> = {
  overlap_same_layer: "Chevauchement même couche",
  outside_scene: "Hors cadre scène",
  min_size_violation: "Taille minimale non respectée",
  spacing_too_small: "Écart inter-pièces insuffisant",
  unsupported_above: "Pièce non supportée par couche inférieure",
  out_of_panel_bounds: "Hors limites panneau",
  no_support_below: "Aucun support en dessous",
  max_layers_exceeded: "Nombre max de couches dépassé",
  project_limits_exceeded: "Limites projet dépassées",
  material_orientation_mismatch: "Orientation matériau incorrecte",
  material_inconsistent_orientations: "Orientations matériau incohérentes",
  piece_will_be_split: "Pièce sera divisée",
};

type Filter = 'ALL' | 'BLOCK' | 'WARN';

function groupByCode(arr: Problem[]): Record<string, Problem[]> {
  return arr.reduce((acc, p) => {
    (acc[p.code] = acc[p.code] || []).push(p);
    return acc;
  }, {} as Record<string, Problem[]>);
}

function formatMessage(p: Problem): string {
  if (p.message) return p.message;
  switch (p.code) {
    case "overlap_same_layer":
      return "Deux pièces se chevauchent sur la même couche";
    case "outside_scene":
      return "La pièce dépasse le cadre de la scène";
    case "min_size_violation":
      return "La pièce est plus petite que 5 mm en largeur ou hauteur";
    default:
      return LABELS[p.code] ?? String(p.code);
  }
}

function zoomTo(pieceId: string | undefined) {
  if (!pieceId) return;
  const store = useSceneStore.getState();
  store.focusPiece(pieceId);
  store.flashOutline(pieceId);
}

export default function ProblemsPanel() {
  const [state, setState] = useState(() => selectProblems());
  const [filter, setFilter] = useState<Filter>('ALL');

  useEffect(() => {
    // Subscribe to validation updates
    const unsubscribe = subscribe(() => {
      setState(selectProblems());
    });
    return unsubscribe;
  }, []);

  const { hasBlock, problems } = state;

  if (!hasBlock && problems.length === 0) return null;

  // Apply filter
  const filtered = problems.filter(p =>
    filter === 'ALL' ? true : p.severity === filter
  );

  // Group by code
  const groups = groupByCode(filtered);

  return (
    <div className="p-3 rounded-xl bg-zinc-800/60 text-zinc-100" data-testid="problems-panel">
      <header className="flex gap-2 items-center mb-3">
        <h3 className="text-sm font-semibold">Problèmes</h3>
        <div role="tablist" aria-label="Filtre sévérité" className="flex gap-1">
          {(['ALL', 'BLOCK', 'WARN'] as Filter[]).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              data-testid={`filter-${f.toLowerCase()}`}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 text-xs rounded ${
                filter === f
                  ? 'bg-zinc-600 text-white font-medium'
                  : 'bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>
      <section>
        {Object.entries(groups).map(([code, items]) => (
          <div key={code} data-testid={`group-${code}`} className="mb-3">
            <h4 className="text-xs font-semibold text-zinc-300 mb-1">
              {LABELS[code as ProblemCode] ?? code} ({items.length})
            </h4>
            <ul className="space-y-1">
              {items.map((p, idx) => {
                const key = p.pieceId ? `${p.code}-${p.pieceId}` : `${p.code}-${idx}`;
                const otherPieceId =
                  p.meta && typeof p.meta === 'object' && 'otherPieceId' in p.meta
                    ? String(p.meta.otherPieceId)
                    : null;

                return (
                  <li key={key} className="flex items-start gap-2 text-xs">
                    <div className="flex-1">
                      <span data-testid="problem-msg" className="text-zinc-300">
                        {formatMessage(p)}
                      </span>
                      {p.pieceId && (
                        <span className="text-zinc-500"> • {p.pieceId}</span>
                      )}
                      {otherPieceId && (
                        <span className="text-zinc-500"> ↔ {otherPieceId}</span>
                      )}
                    </div>
                    {p.pieceId && (
                      <button
                        onClick={() => zoomTo(p.pieceId)}
                        data-testid={`zoom-${p.pieceId}`}
                        className="px-1.5 py-0.5 text-xs bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300"
                        aria-label={`Zoom sur ${p.pieceId}`}
                      >
                        Zoom
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
