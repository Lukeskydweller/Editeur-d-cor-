import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSceneStore } from '@/state/useSceneStore';
import { SidebarDrafts } from '@/components/SidebarDrafts';
import ProblemsPanel from '@/components/ProblemsPanel';
import SidebarMaterials from '@/components/SidebarMaterials';
import ShapeLibrary from '@/components/ShapeLibrary';
import { DevMetrics } from '@/components/DevMetrics';
import { shallow } from 'zustand/shallow';
import { MAX_LAYERS } from '@/constants/validation';

export function Sidebar() {
  // OPTIMIZED: Precise selectors to avoid re-renders
  const layerOrder = useSceneStore((s) => s.scene.layerOrder, shallow);
  const layers = useSceneStore((s) => s.scene.layers, shallow);
  const pieces = useSceneStore((s) => s.scene.pieces, shallow);
  const materials = useSceneStore((s) => s.scene.materials, shallow);
  const selectedId = useSceneStore((s) => s.ui.selectedId);
  const activeLayer = useSceneStore((s) => s.ui.activeLayer);
  const layerVisibility = useSceneStore((s) => s.ui.layerVisibility, shallow);
  const layerLocked = useSceneStore((s) => s.ui.layerLocked, shallow);

  const setPieceMaterial = useSceneStore((s) => s.setPieceMaterial);
  const toggleJoined = useSceneStore((s) => s.toggleJoined);
  const setMaterialOriented = useSceneStore((s) => s.setMaterialOriented);
  const setMaterialOrientation = useSceneStore((s) => s.setMaterialOrientation);
  const addLayer = useSceneStore((s) => s.addLayer);
  const setActiveLayer = useSceneStore((s) => s.setActiveLayer);
  const toggleLayerVisibility = useSceneStore((s) => s.toggleLayerVisibility);
  const toggleLayerLock = useSceneStore((s) => s.toggleLayerLock);
  const moveLayerForward = useSceneStore((s) => s.moveLayerForward);
  const moveLayerBackward = useSceneStore((s) => s.moveLayerBackward);
  const moveLayerToFront = useSceneStore((s) => s.moveLayerToFront);
  const moveLayerToBack = useSceneStore((s) => s.moveLayerToBack);

  // Comptages
  const layerCounts = layerOrder.map((lid) => ({
    id: lid,
    name: layers[lid]?.name ?? lid,
    count: (layers[lid]?.pieces ?? []).length,
  }));

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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Layers</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => addLayer(`C${layerOrder.length + 1}`)}
            disabled={layerOrder.length >= MAX_LAYERS}
            aria-label="add-layer"
            data-testid="layer-add-button"
            title={layerOrder.length >= MAX_LAYERS ? `Maximum de ${MAX_LAYERS} couches atteint` : undefined}
          >
            + Layer
          </Button>
        </CardHeader>
        <CardContent data-testid="layers-panel">
          <ul className="space-y-2" aria-label="layers-list">
            {layerCounts.map((l, idx) => {
              const isAtBack = idx === 0;
              const isAtFront = idx === layerCounts.length - 1;
              const isActive = l.id === activeLayer;
              const isVisible = layerVisibility?.[l.id] ?? true;
              const isLocked = layerLocked?.[l.id] ?? false;

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
                  {/* Left side: radio button + name + count */}
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
                    <span className={`text-sm ${isActive ? 'text-cyan-100' : 'text-muted-foreground'}`}>
                      {l.count}
                    </span>
                  </div>

                  {/* Right side: eye + lock + layer order buttons */}
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
                      aria-label={isVisible ? "Masquer cette couche" : "Afficher cette couche"}
                      aria-pressed={isVisible}
                      title={isVisible ? "Masquer cette couche" : "Afficher cette couche"}
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
                      aria-label={isLocked ? "Déverrouiller cette couche" : "Verrouiller cette couche"}
                      aria-pressed={isLocked}
                      title={isLocked ? "Déverrouiller cette couche" : "Verrouiller cette couche"}
                      data-testid={`layer-lock-${l.name}`}
                      tabIndex={0}
                    >
                      {isLocked ? '🔒' : '🔓'}
                    </Button>

                    {/* Layer order buttons */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      disabled={isAtBack}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayerToBack(l.id);
                      }}
                      aria-label="send-layer-to-back"
                      title="Send to back"
                      tabIndex={0}
                    >
                      ⤒
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      disabled={isAtBack}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayerBackward(l.id);
                      }}
                      aria-label="send-layer-backward"
                      title="Send backward"
                      tabIndex={0}
                    >
                      ‹
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      disabled={isAtFront}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayerForward(l.id);
                      }}
                      aria-label="send-layer-forward"
                      title="Send forward"
                      tabIndex={0}
                    >
                      ›
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      disabled={isAtFront}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveLayerToFront(l.id);
                      }}
                      aria-label="send-layer-to-front"
                      title="Send to front"
                      tabIndex={0}
                    >
                      ⤓
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
              <li key={m.id} className="flex flex-col gap-2 pb-2 border-b border-border last:border-0">
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
                        onChange={(e) => setMaterialOrientation(m.id, Number(e.target.value) as 0 | 90)}
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
