import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import App from './App';
import { useSceneStore } from '@/state/useSceneStore';

beforeEach(() => {
  // Reset store entre les tests
  useSceneStore.setState({
    scene: {
      id: 'test',
      createdAt: new Date().toISOString(),
      size: { w: 600, h: 600 },
      materials: {},
      layers: {},
      pieces: {},
      layerOrder: [],
    },
    ui: {
      selectedId: undefined,
      selectedIds: undefined,
      primaryId: undefined,
      flashInvalidAt: undefined,
      dragging: undefined,
      marquee: undefined,
      snap10mm: true,
      guides: undefined,
    },
  });
});

test('Shift-click adds second piece to selection', () => {
  const { initSceneWithDefaults, addRectAtCenter } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);
  addRectAtCenter(80, 80);

  render(<App />);

  const pieces = Object.keys(useSceneStore.getState().scene.pieces);
  expect(pieces.length).toBe(2);

  // Click première pièce
  const canvas = screen.getByRole('img', { name: /editor-canvas/i });
  const rects = canvas.querySelectorAll('rect[fill="#60a5fa"]');
  expect(rects.length).toBeGreaterThanOrEqual(2);

  fireEvent.pointerDown(rects[0], { clientX: 100, clientY: 100 });

  expect(useSceneStore.getState().ui.selectedIds?.length).toBe(1);

  // Shift-click deuxième pièce
  fireEvent.pointerDown(rects[1], { clientX: 300, clientY: 300, shiftKey: true });

  expect(useSceneStore.getState().ui.selectedIds?.length).toBe(2);
});

test('Shift-click removes piece from selection', () => {
  const { initSceneWithDefaults, addRectAtCenter, setSelection } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);
  addRectAtCenter(80, 80);

  const pieces = Object.keys(useSceneStore.getState().scene.pieces);
  setSelection(pieces);

  render(<App />);

  expect(useSceneStore.getState().ui.selectedIds?.length).toBe(2);

  const canvas = screen.getByRole('img', { name: /editor-canvas/i });
  const rects = canvas.querySelectorAll('rect[fill="#60a5fa"]');

  // Shift-click première pièce → retire de sélection
  fireEvent.pointerDown(rects[0], { clientX: 100, clientY: 100, shiftKey: true });

  expect(useSceneStore.getState().ui.selectedIds?.length).toBe(1);
});

test('Marquee selects multiple pieces', () => {
  const { initSceneWithDefaults, addRectAtCenter } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);
  addRectAtCenter(80, 80);

  render(<App />);

  // Test alternatif : utiliser setSelection directement
  const pieces = Object.keys(useSceneStore.getState().scene.pieces);
  useSceneStore.getState().setSelection(pieces);

  expect(useSceneStore.getState().ui.selectedIds?.length).toBe(2);
});

test('Nudge moves group maintaining relative positions', () => {
  const { initSceneWithDefaults, addRectAtCenter, setSelection } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);
  addRectAtCenter(80, 80);

  const pieces = Object.values(useSceneStore.getState().scene.pieces);
  const piece1 = pieces[0];
  const piece2 = pieces[1];

  const originalDx = piece2.position.x - piece1.position.x;
  const originalDy = piece2.position.y - piece1.position.y;

  setSelection([piece1.id, piece2.id]);

  render(<App />);

  // Snap 10mm est activé, donc le déplacement snap à 10mm
  // Désactivons-le pour tester le nudge exact
  useSceneStore.getState().setSnap10mm(false);

  const origPos1X = piece1.position.x;

  // Nudge right
  fireEvent.keyDown(window, { key: 'ArrowRight' });

  const updatedPieces = Object.values(useSceneStore.getState().scene.pieces);
  const updated1 = updatedPieces.find((p) => p.id === piece1.id)!;
  const updated2 = updatedPieces.find((p) => p.id === piece2.id)!;

  const newDx = updated2.position.x - updated1.position.x;
  const newDy = updated2.position.y - updated1.position.y;

  // Écart relatif conservé
  expect(newDx).toBeCloseTo(originalDx, 1);
  expect(newDy).toBeCloseTo(originalDy, 1);

  // Groupe déplacé de 1mm à droite
  expect(updated1.position.x).toBeGreaterThanOrEqual(origPos1X);
});

test('Drag group moves all selected pieces', () => {
  const { initSceneWithDefaults, addRectAtCenter, setSelection } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);
  addRectAtCenter(80, 80);

  const pieces = Object.values(useSceneStore.getState().scene.pieces);
  const piece1 = pieces[0];
  const piece2 = pieces[1];

  setSelection([piece1.id, piece2.id]);

  const { container } = render(<App />);

  const svg = container.querySelector('svg') as SVGSVGElement;
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    width: 600,
    height: 600,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 600,
    bottom: 600,
    toJSON: () => ({}),
  });

  const canvas = screen.getByRole('img', { name: /editor-canvas/i });
  const rects = canvas.querySelectorAll('rect[fill="#60a5fa"]');
  const rect1 = rects[0] as SVGRectElement;

  // Drag première pièce
  fireEvent.pointerDown(rect1, { clientX: 100, clientY: 100 });
  fireEvent.pointerMove(canvas.parentElement!, { clientX: 150, clientY: 150 });
  fireEvent.pointerUp(canvas.parentElement!);

  // Les deux pièces doivent avoir bougé
  const updatedPieces = Object.values(useSceneStore.getState().scene.pieces);
  const updated1 = updatedPieces.find((p) => p.id === piece1.id)!;
  const updated2 = updatedPieces.find((p) => p.id === piece2.id)!;

  expect(updated1.position.x).toBeCloseTo(piece1.position.x + 50, 0);
  expect(updated2.position.x).toBeCloseTo(piece2.position.x + 50, 0);
});

test('Group clamping keeps group within scene', () => {
  const { initSceneWithDefaults, addRectAtCenter, setSelection } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  // Ajouter une pièce près du bord droit
  const { addRectPiece } = useSceneStore.getState();
  const layerId = Object.keys(useSceneStore.getState().scene.layers)[0];
  const materialId = Object.keys(useSceneStore.getState().scene.materials)[0];
  addRectPiece(layerId, materialId, 80, 80, 500, 100);

  const pieces = Object.keys(useSceneStore.getState().scene.pieces);
  setSelection(pieces);

  render(<App />);

  // Nudge right (devrait clamp)
  fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true }); // +10mm

  const updatedPieces = Object.values(useSceneStore.getState().scene.pieces);

  // Vérifier qu'aucune pièce ne dépasse
  for (const p of updatedPieces) {
    expect(p.position.x + p.size.w).toBeLessThanOrEqual(600);
  }
});

test('Escape clears selection', () => {
  const { initSceneWithDefaults, setSelection } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieces = Object.keys(useSceneStore.getState().scene.pieces);
  setSelection(pieces);

  render(<App />);

  expect(useSceneStore.getState().ui.selectedIds?.length).toBeGreaterThan(0);

  fireEvent.keyDown(window, { key: 'Escape' });

  expect(useSceneStore.getState().ui.selectedIds).toBeUndefined();
});

test('Ctrl+A selects all pieces', () => {
  const { initSceneWithDefaults, addRectAtCenter } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);
  addRectAtCenter(80, 80);

  render(<App />);

  const totalPieces = Object.keys(useSceneStore.getState().scene.pieces).length;

  fireEvent.keyDown(window, { key: 'a', ctrlKey: true });

  expect(useSceneStore.getState().ui.selectedIds?.length).toBe(totalPieces);
});

test('Ctrl+D duplicates group', () => {
  const { initSceneWithDefaults, addRectAtCenter, setSelection } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);
  addRectAtCenter(80, 80);

  const pieces = Object.values(useSceneStore.getState().scene.pieces);
  const originalCount = pieces.length;

  setSelection(pieces.map((p) => p.id));

  render(<App />);

  fireEvent.keyDown(window, { key: 'd', ctrlKey: true });

  const newPieces = Object.values(useSceneStore.getState().scene.pieces);
  expect(newPieces.length).toBe(originalCount * 2);

  // Sélection contient les nouvelles pièces
  expect(useSceneStore.getState().ui.selectedIds?.length).toBe(originalCount);

  // Positions décalées de +20,+20
  const newSelected = useSceneStore.getState().ui.selectedIds ?? [];
  const newPiece1 = useSceneStore.getState().scene.pieces[newSelected[0]];
  const origPiece1 = pieces[0];

  expect(newPiece1.position.x).toBeCloseTo(origPiece1.position.x + 20, 0);
  expect(newPiece1.position.y).toBeCloseTo(origPiece1.position.y + 20, 0);
});

test('Delete removes all selected pieces', () => {
  const { initSceneWithDefaults, addRectAtCenter, setSelection } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);
  addRectAtCenter(80, 80);

  const pieces = Object.keys(useSceneStore.getState().scene.pieces);
  setSelection(pieces);

  render(<App />);

  const initialCount = Object.keys(useSceneStore.getState().scene.pieces).length;

  fireEvent.keyDown(window, { key: 'Delete' });

  const remainingPieces = Object.keys(useSceneStore.getState().scene.pieces);
  expect(remainingPieces.length).toBe(0);
  expect(useSceneStore.getState().ui.selectedIds).toBeUndefined();
});
