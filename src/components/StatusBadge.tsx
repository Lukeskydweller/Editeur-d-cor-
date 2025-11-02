import { useEffect, useState } from "react";
import { selectProblems, subscribe } from "../store/editorStore";

// NOTE: composant source unique d'état "OK/BLOCK" (plus de bannière sync dans App)
export default function StatusBadge() {
  const [problems, setProblems] = useState(() => selectProblems());

  useEffect(() => {
    // Subscribe to validation updates
    const unsubscribe = subscribe(() => {
      setProblems(selectProblems());
    });
    return unsubscribe;
  }, []);

  const { hasBlock } = problems;
  const label = hasBlock ? "BLOCK" : "OK";
  const colorClass = hasBlock ? "bg-red-600" : "bg-emerald-600";

  return (
    <div
      role="status"
      aria-label={`validation ${label}`}
      className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg text-white ${colorClass}`}
    >
      <span className="text-xs font-medium">Validation</span>
      <span className="text-xs font-bold">{label}</span>
    </div>
  );
}
