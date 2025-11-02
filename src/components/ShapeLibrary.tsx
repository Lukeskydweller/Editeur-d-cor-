import { useState } from 'react';
import { useSceneStore } from '../state/useSceneStore';

const PRESETS = [
  { label: '60×60', w: 60, h: 60 },
  { label: '100×60', w: 100, h: 60 },
  { label: '200×100', w: 200, h: 100 },
];

export default function ShapeLibrary() {
  const [customW, setCustomW] = useState('60');
  const [customH, setCustomH] = useState('60');
  const insertRect = useSceneStore((s) => s.insertRect);

  const handlePreset = async (w: number, h: number) => {
    await insertRect({ w, h });
  };

  const handleCustomInsert = async () => {
    const w = parseFloat(customW);
    const h = parseFloat(customH);

    if (isNaN(w) || isNaN(h) || w < 5 || h < 5) {
      return; // Invalid input, do nothing
    }

    await insertRect({ w, h });
  };

  return (
    <div className="p-3 bg-zinc-800/60 rounded-xl" data-testid="shape-library">
      <h3 className="text-sm font-semibold text-zinc-100 mb-2">Bibliothèque de formes</h3>

      {/* Presets */}
      <div className="space-y-2 mb-3">
        <h4 className="text-xs text-zinc-400">Préréglages</h4>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset.w, preset.h)}
              data-testid={`preset-${preset.w}x${preset.h}`}
              className="px-2 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-100 font-medium"
              aria-label={`Insérer rectangle ${preset.label} mm`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Rectangle */}
      <div className="space-y-2">
        <h4 className="text-xs text-zinc-400">Rectangle personnalisé</h4>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label htmlFor="custom-width" className="block text-xs text-zinc-400 mb-1">
              Largeur (mm)
            </label>
            <input
              id="custom-width"
              type="number"
              min="5"
              step="1"
              value={customW}
              onChange={(e) => setCustomW(e.target.value)}
              data-testid="custom-width"
              className="w-full px-2 py-1 text-sm bg-zinc-700 text-zinc-100 rounded border border-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="custom-height" className="block text-xs text-zinc-400 mb-1">
              Hauteur (mm)
            </label>
            <input
              id="custom-height"
              type="number"
              min="5"
              step="1"
              value={customH}
              onChange={(e) => setCustomH(e.target.value)}
              data-testid="custom-height"
              className="w-full px-2 py-1 text-sm bg-zinc-700 text-zinc-100 rounded border border-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          </div>
          <button
            onClick={handleCustomInsert}
            data-testid="custom-insert"
            className="px-3 py-1 text-sm bg-cyan-600 hover:bg-cyan-500 rounded text-white font-medium"
            aria-label="Insérer rectangle personnalisé"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
