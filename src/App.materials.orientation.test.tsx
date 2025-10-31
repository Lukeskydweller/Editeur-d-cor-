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

test('no WARN by default', () => {
  const { initSceneWithDefaults } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  render(<App />);

  // La bannière WARN ne doit pas être présente
  expect(screen.queryByTestId('warn-banner')).not.toBeInTheDocument();
});

test('WARN appears when piece rotation mismatches oriented material', () => {
  const { initSceneWithDefaults, setMaterialOriented, rotatePiece } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  const materialId = Object.keys(useSceneStore.getState().scene.materials)[0];

  // Activer oriented=true et orientationDeg=0 (par défaut)
  setMaterialOriented(materialId, true);

  // Forcer rotationDeg=90 sur la pièce
  rotatePiece(pieceId, 90);

  render(<App />);

  // La bannière WARN doit être présente
  const warnBanner = screen.getByTestId('warn-banner');
  expect(warnBanner).toBeInTheDocument();
  expect(warnBanner).toHaveTextContent(/WARN/i);
  expect(warnBanner).toHaveTextContent(/1 matériau non aligné/i);
});

test('WARN disappears after correcting rotation', () => {
  const { initSceneWithDefaults, setMaterialOriented, rotatePiece } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  const materialId = Object.keys(useSceneStore.getState().scene.materials)[0];

  // Activer oriented=true et orientationDeg=0
  setMaterialOriented(materialId, true);

  // Forcer rotationDeg=90 → WARN
  rotatePiece(pieceId, 90);

  const { rerender } = render(<App />);
  expect(screen.getByTestId('warn-banner')).toBeInTheDocument();

  // Corriger : remettre rotationDeg=0
  rotatePiece(pieceId, 0);

  rerender(<App />);

  // La bannière WARN ne doit plus être présente
  expect(screen.queryByTestId('warn-banner')).not.toBeInTheDocument();
});

test('WARN disappears after changing material orientation to match piece', () => {
  const { initSceneWithDefaults, setMaterialOriented, setMaterialOrientation, rotatePiece } =
    useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  const materialId = Object.keys(useSceneStore.getState().scene.materials)[0];

  // Activer oriented=true et orientationDeg=0
  setMaterialOriented(materialId, true);

  // Forcer rotationDeg=90 → WARN
  rotatePiece(pieceId, 90);

  const { rerender } = render(<App />);
  expect(screen.getByTestId('warn-banner')).toBeInTheDocument();

  // Corriger : changer orientationDeg à 90
  setMaterialOrientation(materialId, 90);

  rerender(<App />);

  // La bannière WARN ne doit plus être présente
  expect(screen.queryByTestId('warn-banner')).not.toBeInTheDocument();
});

test('sidebar oriented checkbox works', () => {
  const { initSceneWithDefaults } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const materialId = Object.keys(useSceneStore.getState().scene.materials)[0];

  render(<App />);

  const checkbox = screen.getByLabelText(`material-${materialId}-oriented`) as HTMLInputElement;
  expect(checkbox.checked).toBe(false);

  // Cocher
  fireEvent.click(checkbox);
  expect(checkbox.checked).toBe(true);
  expect(useSceneStore.getState().scene.materials[materialId].oriented).toBe(true);

  // Le select d'orientation doit apparaître
  const orientationSelect = screen.getByLabelText(`material-${materialId}-orientation`);
  expect(orientationSelect).toBeInTheDocument();
});

test('sidebar orientation select works', () => {
  const { initSceneWithDefaults, setMaterialOriented } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const materialId = Object.keys(useSceneStore.getState().scene.materials)[0];

  // Activer oriented
  setMaterialOriented(materialId, true);

  render(<App />);

  const orientationSelect = screen.getByLabelText(`material-${materialId}-orientation`) as HTMLSelectElement;
  expect(orientationSelect.value).toBe('0');

  // Changer à 90
  fireEvent.change(orientationSelect, { target: { value: '90' } });
  expect(orientationSelect.value).toBe('90');
  expect(useSceneStore.getState().scene.materials[materialId].orientationDeg).toBe(90);
});

test('180deg rotation is congruent with 0deg orientation (no WARN)', () => {
  const { initSceneWithDefaults, setMaterialOriented, rotatePiece } = useSceneStore.getState();
  initSceneWithDefaults(600, 600);

  const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
  const materialId = Object.keys(useSceneStore.getState().scene.materials)[0];

  // Activer oriented=true et orientationDeg=0
  setMaterialOriented(materialId, true);

  // Forcer rotationDeg=180 (congruent à 0 modulo 180)
  rotatePiece(pieceId, 180);

  render(<App />);

  // Pas de WARN car 180 ≡ 0 (mod 180)
  expect(screen.queryByTestId('warn-banner')).not.toBeInTheDocument();
});
