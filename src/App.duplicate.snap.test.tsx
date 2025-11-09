import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import App from './App';
import { useSceneStore } from '@/state/useSceneStore';
import { DUPLICATE_OFFSET_MM } from '@/state/constants';

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
      flashInvalidAt: undefined,
      dragging: undefined,
      snap10mm: false, // Disable snap to avoid rounding effects in duplication test
      guides: undefined,
    },
  });
});

test('Ctrl+D duplicates selected piece', () => {
  const { initSceneWithDefaults, selectPiece } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];

  // Resize piece to 50×50 to ensure +60,+60 offset won't trigger collision escape
  // Default piece: (40,40) w:120 h:80 → bbox [40..160] collides with (100,100)
  // With w:50 h:50 → bbox [40..90], duplicate at (100,100) is collision-free
  useSceneStore.setState((s) => ({
    scene: {
      ...s.scene,
      pieces: {
        ...s.scene.pieces,
        [pieceId]: { ...s.scene.pieces[pieceId], size: { w: 50, h: 50 } },
      },
    },
  }));

  const originalPos = { ...useSceneStore.getState().scene.pieces[pieceId].position };
  selectPiece(pieceId);

  render(<App />);

  // Nombre de pièces initial
  expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(1);

  // Ctrl+D
  fireEvent.keyDown(window, { key: 'd', ctrlKey: true });

  // Vérifier nombre de pièces
  const pieces = Object.keys(useSceneStore.getState().scene.pieces);
  expect(pieces.length).toBe(2);

  // Vérifier nouvelle sélection
  const selectedId = useSceneStore.getState().ui.selectedId;
  expect(selectedId).toBeDefined();
  expect(selectedId).not.toBe(pieceId);

  // Vérifier position décalée: net +60,+60 offset (no snap, no escape)
  // This test measures the raw duplicate offset constant, free from snap/escape logic
  const newPiece = useSceneStore.getState().scene.pieces[selectedId!];
  expect(newPiece.position.x).toBe(originalPos.x + DUPLICATE_OFFSET_MM);
  expect(newPiece.position.y).toBe(originalPos.y + DUPLICATE_OFFSET_MM);
});

test('duplicate button works', () => {
  const { initSceneWithDefaults, selectPiece } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  selectPiece(pieceId);

  render(<App />);

  const duplicateButton = screen.getByRole('button', { name: /Dupliquer/i });

  // Nombre de pièces initial
  expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(1);

  // Cliquer dupliquer
  fireEvent.click(duplicateButton);

  // Vérifier nombre de pièces
  expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(2);
});

test('snap to left edge within threshold', () => {
  const { initSceneWithDefaults, addRectAtCenter, setSnap10mm } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  // Désactiver snap grille pour tester uniquement snap pièces
  setSnap10mm(false);

  // Ajouter une 2ème pièce
  addRectAtCenter(80, 80);

  const pieces = Object.values(useSceneStore.getState().scene.pieces);
  expect(pieces.length).toBe(2);

  // Pièce 1 à (40, 40), pièce 2 au centre
  const piece1 = pieces[0];
  const piece2 = pieces[1];

  const { container } = render(<App />);

  const svg = container.querySelector('svg') as SVGSVGElement;

  // Mock getBoundingClientRect pour 600px = 600mm
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

  // Trouver le rect de piece2 (sélectionné)
  const rect2 = Array.from(rects).find((r) => {
    const parent = r.parentElement;
    const transform = parent?.getAttribute('transform');
    return transform?.includes(`translate(${piece2.position.x}`);
  }) as SVGRectElement;

  // Drag piece2 proche de piece1.left (40) → placer à x=43 (écart 3mm)
  fireEvent.pointerDown(rect2, { clientX: 300, clientY: 300 });
  // Calculer clientX pour atteindre x=43
  // piece2.x actuel ≈ 260, on veut 43 → delta = 43 - 260 = -217
  fireEvent.pointerMove(canvas.parentElement!, { clientX: 300 - 217, clientY: 300 });

  // Pendant le drag, les guides doivent être visibles
  const guidesElement = screen.queryByTestId('snap-guides');
  expect(guidesElement).toBeInTheDocument();

  fireEvent.pointerUp(canvas.parentElement!);

  // Vérifier que piece2.x a snappé exactement à piece1.left = 40
  const finalPiece2 = useSceneStore.getState().scene.pieces[piece2.id];
  expect(finalPiece2.position.x).toBe(40);

  // Les guides doivent avoir disparu
  const guidesAfter = screen.queryByTestId('snap-guides');
  expect(guidesAfter).not.toBeInTheDocument();
});

test('no snap when outside threshold', () => {
  const { initSceneWithDefaults, addRectAtCenter, setSnap10mm } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  setSnap10mm(false);

  addRectAtCenter(80, 80);

  const pieces = Object.values(useSceneStore.getState().scene.pieces);
  const piece2 = pieces[1];

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
  const rect2 = Array.from(rects).find((r) => {
    const parent = r.parentElement;
    const transform = parent?.getAttribute('transform');
    return transform?.includes(`translate(${piece2.position.x}`);
  }) as SVGRectElement;

  // Drag piece2 loin de piece1 (>5mm)
  fireEvent.pointerDown(rect2, { clientX: 300, clientY: 300 });
  fireEvent.pointerMove(canvas.parentElement!, { clientX: 350, clientY: 300 }); // +50mm

  // Pas de guides
  expect(screen.queryByTestId('snap-guides')).not.toBeInTheDocument();

  fireEvent.pointerUp(canvas.parentElement!);

  // Position n'a pas snappé
  const finalPiece2 = useSceneStore.getState().scene.pieces[piece2.id];
  expect(finalPiece2.position.x).toBeCloseTo(piece2.position.x + 50, 0);
});

test('guides rendering during snap', () => {
  const { initSceneWithDefaults, addRectAtCenter, setSnap10mm } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  setSnap10mm(false);
  addRectAtCenter(80, 80);

  const pieces = Object.values(useSceneStore.getState().scene.pieces);
  const piece2 = pieces[1];

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
  const rect2 = Array.from(rects).find((r) => {
    const parent = r.parentElement;
    const transform = parent?.getAttribute('transform');
    return transform?.includes(`translate(${piece2.position.x}`);
  }) as SVGRectElement;

  // Drag proche → snap actif
  fireEvent.pointerDown(rect2, { clientX: 300, clientY: 300 });
  fireEvent.pointerMove(canvas.parentElement!, { clientX: 83, clientY: 300 }); // proche de 40

  // Guides doivent être présents
  const guides = screen.getByTestId('snap-guides');
  expect(guides).toBeInTheDocument();

  // Au moins une ligne
  const lines = guides.querySelectorAll('line');
  expect(lines.length).toBeGreaterThan(0);

  fireEvent.pointerUp(canvas.parentElement!);

  // Guides nettoyés
  expect(screen.queryByTestId('snap-guides')).not.toBeInTheDocument();
});
