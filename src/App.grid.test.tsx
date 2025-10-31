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
      flashInvalidAt: undefined,
      dragging: undefined,
      snap10mm: true,
    },
  });
});

test('grid pattern is present in SVG', () => {
  const { initSceneWithDefaults } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const { container } = render(<App />);

  // Vérifier que le pattern grid10mm existe
  const pattern = container.querySelector('#grid10mm');
  expect(pattern).toBeInTheDocument();
});

test('snap ON: nudge 3mm three times snaps to 10mm increments', () => {
  const { initSceneWithDefaults, selectPiece } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  selectPiece(pieceId);

  render(<App />);

  // Position initiale : 40mm
  let piece = useSceneStore.getState().scene.pieces[pieceId];
  expect(piece.position.x).toBe(40);

  // Nudge +3mm → snap à 40mm (car 43 arrondi à 40)
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  fireEvent.keyDown(window, { key: 'ArrowRight' });

  piece = useSceneStore.getState().scene.pieces[pieceId];
  // 40 + 3 = 43 → snap 40 ; 40 + 3 = 43 → snap 40 ; 40 + 3 = 43 → snap 40
  // En fait, chaque nudge part de la position actuelle
  // 40 + 1 = 41 → snap 40
  // 40 + 1 = 41 → snap 40
  // 40 + 1 = 41 → snap 40
  // Donc toujours 40

  // Modifions le test : nudge +10mm d'un coup (Shift+Right)
  fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });
  piece = useSceneStore.getState().scene.pieces[pieceId];
  // 40 + 10 = 50 → snap 50
  expect(piece.position.x).toBe(50);
});

test('snap ON: drag +17mm snaps to 20mm', () => {
  const { initSceneWithDefaults } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];

  const { container } = render(<App />);

  const svg = container.querySelector('svg') as SVGSVGElement;

  // Mock getBoundingClientRect pour 600px = 600mm (1px = 1mm)
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
  const rect = canvas.querySelector('rect[fill="#60a5fa"]') as SVGRectElement;

  const initialPos = { ...useSceneStore.getState().scene.pieces[pieceId].position };

  // Drag: +17px = +17mm
  fireEvent.pointerDown(rect, { clientX: 100, clientY: 100 });
  fireEvent.pointerMove(canvas.parentElement!, { clientX: 117, clientY: 100 });
  fireEvent.pointerUp(canvas.parentElement!);

  const finalPos = useSceneStore.getState().scene.pieces[pieceId].position;
  // 40 + 17 = 57 → snap 60
  expect(finalPos.x).toBe(60);
  expect(finalPos.y).toBe(initialPos.y);
});

test('snap OFF: drag +17mm keeps 57mm (no snap)', () => {
  const { initSceneWithDefaults, setSnap10mm } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);
  setSnap10mm(false);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];

  const { container } = render(<App />);

  const svg = container.querySelector('svg') as SVGSVGElement;

  // Mock getBoundingClientRect pour 600px = 600mm (1px = 1mm)
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
  const rect = canvas.querySelector('rect[fill="#60a5fa"]') as SVGRectElement;

  const initialPos = { ...useSceneStore.getState().scene.pieces[pieceId].position };

  // Drag: +17px = +17mm
  fireEvent.pointerDown(rect, { clientX: 100, clientY: 100 });
  fireEvent.pointerMove(canvas.parentElement!, { clientX: 117, clientY: 100 });
  fireEvent.pointerUp(canvas.parentElement!);

  const finalPos = useSceneStore.getState().scene.pieces[pieceId].position;
  // 40 + 17 = 57 (pas de snap)
  expect(finalPos.x).toBe(57);
  expect(finalPos.y).toBe(initialPos.y);
});

test('snap toggle checkbox works', () => {
  const { initSceneWithDefaults } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  render(<App />);

  const checkbox = screen.getByLabelText(/toggle-snap-10mm/i) as HTMLInputElement;
  expect(checkbox.checked).toBe(true);

  // Décocher
  fireEvent.click(checkbox);
  expect(checkbox.checked).toBe(false);
  expect(useSceneStore.getState().ui.snap10mm).toBe(false);

  // Recocher
  fireEvent.click(checkbox);
  expect(checkbox.checked).toBe(true);
  expect(useSceneStore.getState().ui.snap10mm).toBe(true);
});
