import { useEffect, useState } from "react";
import { selectProblems, subscribe } from "../store/editorStore";

export default function ProblemsPanel() {
  const [problems, setProblems] = useState(() => selectProblems());

  useEffect(() => {
    // Subscribe to validation updates
    const unsubscribe = subscribe(() => {
      setProblems(selectProblems());
    });
    return unsubscribe;
  }, []);

  const { hasBlock, conflicts } = problems;

  if (!hasBlock && conflicts.size === 0) return null;

  return (
    <div className="p-3 rounded-xl bg-zinc-800/60 text-zinc-100">
      <div className="mb-2 text-sm font-semibold">Problèmes</div>
      {[...conflicts].map(([a, b]) => (
        <div key={`${a}-${b}`} className="text-sm">
          • overlap_same_layer : {a} ↔ {b}
        </div>
      ))}
    </div>
  );
}
