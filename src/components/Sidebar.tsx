import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSceneStore } from '@/state/useSceneStore';
import { SidebarDrafts } from '@/components/SidebarDrafts';
import ProblemsPanel from '@/components/ProblemsPanel';
import SidebarMaterials from '@/components/SidebarMaterials';
import ShapeLibrary from '@/components/ShapeLibrary';
import { DevMetrics } from '@/components/DevMetrics';
import { useShallow } from 'zustand/react/shallow';
import { FIXED_LAYER_NAMES } from '@/constants/layers';
import type { LayerName } from '@/constants/layers';
import { isLayerUnlocked } from '@/state/layers.gating';

// Type-safe helper using useShallow for multi-picks
type Store = ReturnType<typeof useSceneStore.getState>;
const useSidebar = <T,>(sel: (s: Store) => T) => useSceneStore(useShallow(sel));

export function Sidebar() {
  // OPTIMIZED: Precise selectors to avoid re-renders
  const layerOrder = useSidebar((s) => s.scene.layerOrder);
  const fixedLayerIds = useSidebar((s) => s.scene.fixedLayerIds);
  const layers = useSidebar((s) => s.scene.layers);
  const pieces = useSidebar((s) => s.scene.pieces);
  const materials = useSidebar((s) => s.scene.materials);
  const selectedId = useSidebar((s) => s.ui.selectedId);
  const activeLayer = useSidebar((s) => s.ui.activeLayer);
  const layerVisibility = useSidebar((s) => s.ui.layerVisibility);
  const layerLocked = useSidebar((s) => s.ui.layerLocked);

  // Get the full state for unlock checking
  const sceneState = useSceneStore.getState();

  const setPieceMaterial = useSidebar((s) => s.setPieceMaterial);
  const toggleJoined = useSidebar((s) => s.toggleJoined);
  const setMaterialOriented = useSidebar((s) => s.setMaterialOriented);
  const setMaterialOrientation = useSidebar((s) => s.setMaterialOrientation);
  const setActiveLayer = useSidebar((s) => s.setActiveLayer);
  const toggleLayerVisibility = useSidebar((s) => s.toggleLayerVisibility);
  const toggleLayerLock = useSidebar((s) => s.toggleLayerLock);

  // Fixed 3-layer panel: only display C1, C2, C3
  const fixedLayerCounts = FIXED_LAYER_NAMES.map((name: LayerName) => {
    const id = fixedLayerIds?.[name];
    const count = id ? (layers[id]?.pieces?.length ?? 0) : 0;
    return { id, name, count };
  }).filter((l): l is { id: string; name: LayerName; count: number } => l.id !== undefined);

  // Check for legacy layers (> 3 layers)
  const hasLegacyLayers = layerOrder.length > 3;

  const materialCounts = Object.values(materials).map((m) => {
    const count = Object.values(pieces).filter((p) => p.materialId === m.id).length;
    return { id: m.id, name: m.name, count, material: m };
  });

  const selectedPiece = selectedId ? pieces[selectedId] : undefined;

  return (
    <aside role="complementary" className="w-full md:w-72 flex flex-col gap-4">
      <SidebarDrafts />
      <ShapeLibrary />
      <SidebarMaterials />
      {/* ProblemsPanel reste la source officielle pour la liste des conflits */}
      <ProblemsPanel />
      {/* Dev metrics for performance monitoring */}
      <DevMetrics />

      <Card>
        <CardHeader>
          <CardTitle>Layers</CardTitle>
        </CardHeader>
        <CardContent data-testid="layers-panel">
          {/* Legacy banner: shown when scene has > 3 layers */}
          {hasLegacyLayers && (
            <div
              className="mb-3 p-2 text-sm bg-amber-900/30 border border-amber-700/50 rounded text-amber-200"
              role="status"
              data-testid="legacy-layers-banner"
            >
              Scène héritée : couches &gt; C3 masquées (migration v1 à venir)
            </div>
          )}

          <ul className="space-y-2" aria-label="layers-list">
            {fixedLayerCounts.map((l) => {
              const isActive = l.id === activeLayer;
              const isVisible = layerVisibility?.[l.id] ?? true;
              const isLocked = layerLocked?.[l.id] ?? false;
              const isUnlocked = isLayerUnlocked(sceneState, l.name);

              return (
                <li
                  key={l.id}
                  data-testid={`layer-row-${l.name}`}
                  className={`flex items-center justify-between gap-2 p-2 rounded transition-colors ${
                    isActive
                      ? 'bg-cyan-600 ring-2 ring-cyan-400'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  {/* Left side: radio button + name + count + locked badge */}
                  <div
                    className="flex items-center gap-2 flex-1 cursor-pointer"
                    onClick={() => setActiveLayer(l.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveLayer(l.id);
                      }
                    }}
                  >
                    {/* Radio button (●/○) */}
                    <span
                      data-testid={`active-layer-badge-${l.name}`}
                      className={`text-lg ${isActive ? 'text-cyan-200' : 'text-gray-500'}`}
                      aria-label={isActive ? 'active layer' : 'inactive layer'}
                    >
                      {isActive ? '●' : '○'}
                    </span>
                    <span className={isActive ? 'font-semibold' : ''}>{l.name}</span>
                    <span
                      className={`text-sm ${isActive ? 'text-cyan-100' : 'text-muted-foreground'}`}
                    >
                      {l.count}
                    </span>
                    {/* Progressive unlock badge: show 🔐 for locked C2/C3 */}
                    {!isUnlocked && (
                      <span
                        data-testid={`layer-locked-badge-${l.name}`}
                        className="text-sm"
                        title={`Verrouillée — ajoutez au moins une pièce à ${l.name === 'C2' ? 'C1' : 'C2'}`}
                        aria-label={`Layer ${l.name} locked`}
                      >
                        🔐
                      </span>
                    )}
                  </div>

                  {/* Right side: eye + lock */}
                  <div className="flex items-center gap-1">
                    {/* Eye icon (visibility toggle) */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLayerVisibility(l.id);
                      }}
                      aria-label={isVisible ? 'Masquer cette couche' : 'Afficher cette couche'}
                      aria-pressed={isVisible}
                      title={isVisible ? 'Masquer cette couche' : 'Afficher cette couche'}
                      data-testid={`layer-eye-${l.name}`}
                      tabIndex={0}
                    >
                      {isVisible ? '👁' : '🚫'}
                    </Button>

                    {/* Lock icon (lock toggle) */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLayerLock(l.id);
                      }}
                      aria-label={
                        isLocked ? 'Déverrouiller cette couche' : 'Verrouiller cette couche'
                      }
                      aria-pressed={isLocked}
                      title={isLocked ? 'Déverrouiller cette couche' : 'Verrouiller cette couche'}
                      data-testid={`layer-lock-${l.name}`}
                      tabIndex={0}
                    >
                      {isLocked ? '🔒' : '🔓'}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Materials</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3" aria-label="materials-list">
            {materialCounts.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-2 pb-2 border-b border-border last:border-0"
              >
                <div className="flex items-center justify-between">
                  <span>{m.name}</span>
                  <span className="text-muted-foreground">{m.count}</span>
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!m.material.oriented}
                      onChange={(e) => setMaterialOriented(m.id, e.target.checked)}
                      aria-label={`material-${m.id}-oriented`}
                      className="cursor-pointer"
                    />
                    <span>Oriented</span>
                  </label>
                  {m.material.oriented && (
                    <label className="flex items-center gap-2">
                      <span>Angle:</span>
                      <select
                        value={m.material.orientationDeg ?? 0}
                        onChange={(e) =>
                          setMaterialOrientation(m.id, Number(e.target.value) as 0 | 90)
                        }
                        aria-label={`material-${m.id}-orientation`}
                        className="rounded border border-input bg-background px-2 py-1 text-xs"
                      >
                        <option value="0">0°</option>
                        <option value="90">90°</option>
                      </select>
                    </label>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {selectedPiece ? (
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-sm block mb-1">Matériau de la pièce sélectionnée</label>
                <select
                  aria-label="material-select"
                  className="w-full rounded-md bg-background border border-input p-2 text-sm"
                  value={selectedPiece.materialId}
                  onChange={(e) => setPieceMaterial(selectedPiece.id, e.target.value)}
                >
                  {Object.values(materials).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="toggle-joined"
                  data-testid="toggle-joined"
                  className="rounded border-input"
                  checked={selectedPiece.joined ?? false}
                  onChange={() => toggleJoined(selectedPiece.id)}
                />
                <label htmlFor="toggle-joined" className="text-sm cursor-pointer">
                  Autoriser bord-à-bord
                </label>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </aside>
  );
}
