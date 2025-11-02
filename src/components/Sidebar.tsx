import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSceneStore } from '@/state/useSceneStore';
import { SidebarDrafts } from '@/components/SidebarDrafts';
import ProblemsPanel from '@/components/ProblemsPanel';
import SidebarMaterials from '@/components/SidebarMaterials';
import ShapeLibrary from '@/components/ShapeLibrary';
import { DevMetrics } from '@/components/DevMetrics';

export function Sidebar() {
  const scene = useSceneStore((s) => s.scene);
  const selectedId = useSceneStore((s) => s.ui.selectedId);
  const setPieceMaterial = useSceneStore((s) => s.setPieceMaterial);
  const toggleJoined = useSceneStore((s) => s.toggleJoined);
  const setMaterialOriented = useSceneStore((s) => s.setMaterialOriented);
  const setMaterialOrientation = useSceneStore((s) => s.setMaterialOrientation);
  const addLayer = useSceneStore((s) => s.addLayer);
  const moveLayerForward = useSceneStore((s) => s.moveLayerForward);
  const moveLayerBackward = useSceneStore((s) => s.moveLayerBackward);
  const moveLayerToFront = useSceneStore((s) => s.moveLayerToFront);
  const moveLayerToBack = useSceneStore((s) => s.moveLayerToBack);

  // Comptages
  const layerCounts = scene.layerOrder.map((lid) => ({
    id: lid,
    name: scene.layers[lid]?.name ?? lid,
    count: (scene.layers[lid]?.pieces ?? []).length,
  }));

  const materialCounts = Object.values(scene.materials).map((m) => {
    const count = Object.values(scene.pieces).filter((p) => p.materialId === m.id).length;
    return { id: m.id, name: m.name, count, material: m };
  });

  const selectedPiece = selectedId ? scene.pieces[selectedId] : undefined;

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
            onClick={() => addLayer(`C${scene.layerOrder.length + 1}`)}
            aria-label="add-layer"
          >
            + Layer
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2" aria-label="layers-list">
            {layerCounts.map((l, idx) => {
              const isAtBack = idx === 0;
              const isAtFront = idx === layerCounts.length - 1;

              return (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span>{l.name}</span>
                    <span className="text-muted-foreground text-sm">{l.count}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      disabled={isAtBack}
                      onClick={() => moveLayerToBack(l.id)}
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
                      onClick={() => moveLayerBackward(l.id)}
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
                      onClick={() => moveLayerForward(l.id)}
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
                      onClick={() => moveLayerToFront(l.id)}
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
                  {Object.values(scene.materials).map((m) => (
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
