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
    },
  });
});

test('drag with 1200px width (factor 0.5): +100px = +50mm', () => {
  const { initSceneWithDefaults } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];

  const { container } = render(<App />);

  const svg = container.querySelector('svg') as SVGSVGElement;

  // Mock getBoundingClientRect pour retourner 1200px de largeur
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    width: 1200,
    height: 1200,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 1200,
    bottom: 1200,
    toJSON: () => ({}),
  });

  const canvas = screen.getByRole('img', { name: /editor-canvas/i });
  const rect = canvas.querySelector('rect[fill="#60a5fa"]') as SVGRectElement;

  const initialPos = { ...useSceneStore.getState().scene.pieces[pieceId].position };

  // Drag: +100px en X devrait donner +50mm (facteur 0.5)
  fireEvent.pointerDown(rect, { clientX: 100, clientY: 100 });
  fireEvent.pointerMove(canvas.parentElement!, { clientX: 200, clientY: 100 });
  fireEvent.pointerUp(canvas.parentElement!);

  const finalPos = useSceneStore.getState().scene.pieces[pieceId].position;
  expect(finalPos.x).toBeCloseTo(initialPos.x + 50, 1);
  expect(finalPos.y).toBeCloseTo(initialPos.y, 1);
});

test('drag with 600px width (factor 1): +100px = +100mm', () => {
  const { initSceneWithDefaults } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];

  const { container } = render(<App />);

  const svg = container.querySelector('svg') as SVGSVGElement;

  // Mock getBoundingClientRect pour retourner 600px de largeur
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

  // Drag: +100px en X devrait donner +100mm (facteur 1)
  fireEvent.pointerDown(rect, { clientX: 100, clientY: 100 });
  fireEvent.pointerMove(canvas.parentElement!, { clientX: 200, clientY: 100 });
  fireEvent.pointerUp(canvas.parentElement!);

  const finalPos = useSceneStore.getState().scene.pieces[pieceId].position;
  expect(finalPos.x).toBeCloseTo(initialPos.x + 100, 1);
  expect(finalPos.y).toBeCloseTo(initialPos.y, 1);
});
