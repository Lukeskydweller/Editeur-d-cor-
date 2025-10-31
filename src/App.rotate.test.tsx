import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach } from 'vitest';
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

test('rotate +90 button works', () => {
  const { initSceneWithDefaults, selectPiece } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  selectPiece(pieceId);

  render(<App />);

  const plus90Button = screen.getByRole('button', { name: /Rotate \+90°/i });

  // Rotation initiale : 0
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(0);

  // Cliquer +90 → 90
  fireEvent.click(plus90Button);
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(90);

  // Cliquer +90 → 180
  fireEvent.click(plus90Button);
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(180);

  // Cliquer +90 → 270
  fireEvent.click(plus90Button);
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(270);

  // Cliquer +90 → 0 (retour)
  fireEvent.click(plus90Button);
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(0);
});

test('rotate -90 button works', () => {
  const { initSceneWithDefaults, selectPiece } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  selectPiece(pieceId);

  render(<App />);

  const minus90Button = screen.getByRole('button', { name: /Rotate −90°/i });

  // Rotation initiale : 0
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(0);

  // Cliquer -90 → 270
  fireEvent.click(minus90Button);
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(270);

  // Cliquer -90 → 180
  fireEvent.click(minus90Button);
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(180);
});

test('set 0° and 90° buttons work', () => {
  const { initSceneWithDefaults, selectPiece, rotateSelected } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  selectPiece(pieceId);

  render(<App />);

  const set0Button = screen.getByRole('button', { name: /Set 0°/i });
  const set90Button = screen.getByRole('button', { name: /Set 90°/i });

  // Manipuler la rotation
  rotateSelected(90);
  rotateSelected(90);
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(180);

  // Set 90° → 90
  fireEvent.click(set90Button);
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(90);

  // Set 0° → 0
  fireEvent.click(set0Button);
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(0);
});

test('keyboard R rotates +90, Shift+R rotates -90', () => {
  const { initSceneWithDefaults, selectPiece } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  selectPiece(pieceId);

  render(<App />);

  // R → +90
  fireEvent.keyDown(window, { key: 'r' });
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(90);

  // R → +90 (180)
  fireEvent.keyDown(window, { key: 'r' });
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(180);

  // Shift+R → -90 (90)
  fireEvent.keyDown(window, { key: 'R', shiftKey: true });
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(90);
});

test('keyboard 0 sets 0°, 9 sets 90°', () => {
  const { initSceneWithDefaults, selectPiece, rotateSelected } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  selectPiece(pieceId);

  render(<App />);

  // Manipuler la rotation
  rotateSelected(90);
  rotateSelected(90);
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(180);

  // 9 → 90
  fireEvent.keyDown(window, { key: '9' });
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(90);

  // 0 → 0
  fireEvent.keyDown(window, { key: '0' });
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(0);
});

test('WARN reactivity: rotation triggers orientation warnings', () => {
  const { initSceneWithDefaults, selectPiece, setMaterialOriented } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  const materialId = Object.keys(useSceneStore.getState().scene.materials)[0];

  selectPiece(pieceId);

  // Activer oriented=true avec orientationDeg=0 (par défaut)
  setMaterialOriented(materialId, true);

  const { rerender } = render(<App />);

  // Pas de WARN initialement (rotation = 0, orientation = 0)
  expect(screen.queryByTestId('warn-banner')).not.toBeInTheDocument();

  // Set 90° → WARN doit apparaître
  const set90Button = screen.getByRole('button', { name: /Set 90°/i });
  fireEvent.click(set90Button);

  rerender(<App />);

  // WARN présent
  expect(screen.getByTestId('warn-banner')).toBeInTheDocument();

  // Set 0° → WARN doit disparaître
  const set0Button = screen.getByRole('button', { name: /Set 0°/i });
  fireEvent.click(set0Button);

  rerender(<App />);

  // WARN absent
  expect(screen.queryByTestId('warn-banner')).not.toBeInTheDocument();
});

test('rotation buttons are disabled when nothing selected', () => {
  const { initSceneWithDefaults } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  render(<App />);

  const plus90Button = screen.getByRole('button', { name: /Rotate \+90°/i });
  const minus90Button = screen.getByRole('button', { name: /Rotate −90°/i });
  const set0Button = screen.getByRole('button', { name: /Set 0°/i });
  const set90Button = screen.getByRole('button', { name: /Set 90°/i });

  expect(plus90Button).toBeDisabled();
  expect(minus90Button).toBeDisabled();
  expect(set0Button).toBeDisabled();
  expect(set90Button).toBeDisabled();
});
