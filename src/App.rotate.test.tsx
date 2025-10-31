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

  const set0Button = screen.getByRole('button', { name: /Rotation 0°/i });
  const set90Button = screen.getByRole('button', { name: /Rotation 90°/i });

  // Manipuler la rotation
  rotateSelected(90);
  rotateSelected(90);
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(180);

  // Rotation 90° → 90
  fireEvent.click(set90Button);
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(90);

  // Rotation 0° → 0
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

  // Rotation 90° → WARN doit apparaître
  const set90Button = screen.getByRole('button', { name: /Rotation 90°/i });
  fireEvent.click(set90Button);

  rerender(<App />);

  // WARN présent
  expect(screen.getByTestId('warn-banner')).toBeInTheDocument();

  // Rotation 0° → WARN doit disparaître
  const set0Button = screen.getByRole('button', { name: /Rotation 0°/i });
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
  const set0Button = screen.getByRole('button', { name: /Rotation 0°/i });
  const set90Button = screen.getByRole('button', { name: /Rotation 90°/i });

  expect(plus90Button).toBeDisabled();
  expect(minus90Button).toBeDisabled();
  expect(set0Button).toBeDisabled();
  expect(set90Button).toBeDisabled();
});

test('rotation clears transient UI (dragging, resizing, guides, marquee)', () => {
  const {
    initSceneWithDefaults,
    selectPiece,
    rotateSelected,
    beginDrag,
    updateDrag,
    startResize,
    updateResize,
  } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  selectPiece(pieceId);

  // Start a drag to create transient UI state
  beginDrag(pieceId);
  updateDrag(20, 20);

  // Verify dragging state exists
  expect(useSceneStore.getState().ui.dragging).toBeDefined();

  // Rotate piece
  rotateSelected(90);

  // Transient UI should be cleared
  expect(useSceneStore.getState().ui.dragging).toBeUndefined();
  expect(useSceneStore.getState().ui.resizing).toBeUndefined();
  expect(useSceneStore.getState().ui.guides).toBeUndefined();
  expect(useSceneStore.getState().ui.marquee).toBeUndefined();

  // Selection should be preserved
  expect(useSceneStore.getState().ui.selectedId).toBe(pieceId);
});

test('setSelectedRotation clears transient UI', () => {
  const { initSceneWithDefaults, selectPiece, setSelectedRotation, startResize, updateResize } =
    useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  const piece = useSceneStore.getState().scene.pieces[pieceId];
  selectPiece(pieceId);

  // Start a resize to create transient UI state
  startResize(pieceId, 'e');
  updateResize({
    x: piece.position.x + piece.size.w + 10,
    y: piece.position.y + piece.size.h / 2,
  });

  // Verify resizing state exists
  expect(useSceneStore.getState().ui.resizing).toBeDefined();

  // Set rotation directly
  setSelectedRotation(90);

  // Transient UI should be cleared
  expect(useSceneStore.getState().ui.dragging).toBeUndefined();
  expect(useSceneStore.getState().ui.resizing).toBeUndefined();
  expect(useSceneStore.getState().ui.guides).toBeUndefined();
  expect(useSceneStore.getState().ui.marquee).toBeUndefined();

  // Selection should be preserved
  expect(useSceneStore.getState().ui.selectedId).toBe(pieceId);
  expect(useSceneStore.getState().scene.pieces[pieceId].rotationDeg).toBe(90);
});
