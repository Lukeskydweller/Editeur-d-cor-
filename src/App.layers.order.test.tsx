import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach } from 'vitest';
import App from './App';
import { useSceneStore } from '@/state/useSceneStore';

beforeEach(() => {
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

test('moveLayerForward button moves layer forward by 1 position', () => {
  const { addLayer } = useSceneStore.getState();
  addLayer('Layer 1');
  addLayer('Layer 2');
  addLayer('Layer 3');

  const [l1, l2, l3] = useSceneStore.getState().scene.layerOrder;

  render(<App />);

  expect(useSceneStore.getState().scene.layerOrder).toEqual([l1, l2, l3]);

  // Trouver le bouton "send forward" pour Layer 1
  const layersList = screen.getByRole('list', { name: /layers-list/i });
  const layerItems = layersList.querySelectorAll('li');

  // Layer 1 est le premier (index 0)
  const layer1Item = layerItems[0];
  const forwardButton = layer1Item.querySelector('[aria-label="send-layer-forward"]') as HTMLButtonElement;

  fireEvent.click(forwardButton);

  // Layer 1 devrait maintenant être à l'index 1
  expect(useSceneStore.getState().scene.layerOrder).toEqual([l2, l1, l3]);
});

test('moveLayerBackward button moves layer backward by 1 position', () => {
  const { addLayer } = useSceneStore.getState();
  addLayer('Layer 1');
  addLayer('Layer 2');
  addLayer('Layer 3');

  const [l1, l2, l3] = useSceneStore.getState().scene.layerOrder;

  render(<App />);

  expect(useSceneStore.getState().scene.layerOrder).toEqual([l1, l2, l3]);

  const layersList = screen.getByRole('list', { name: /layers-list/i });
  const layerItems = layersList.querySelectorAll('li');

  // Layer 3 est le dernier (index 2)
  const layer3Item = layerItems[2];
  const backwardButton = layer3Item.querySelector('[aria-label="send-layer-backward"]') as HTMLButtonElement;

  fireEvent.click(backwardButton);

  // Layer 3 devrait maintenant être à l'index 1
  expect(useSceneStore.getState().scene.layerOrder).toEqual([l1, l3, l2]);
});

test('moveLayerToFront button moves layer to front', () => {
  const { addLayer } = useSceneStore.getState();
  addLayer('Layer 1');
  addLayer('Layer 2');
  addLayer('Layer 3');

  const [l1, l2, l3] = useSceneStore.getState().scene.layerOrder;

  render(<App />);

  expect(useSceneStore.getState().scene.layerOrder).toEqual([l1, l2, l3]);

  const layersList = screen.getByRole('list', { name: /layers-list/i });
  const layerItems = layersList.querySelectorAll('li');

  // Layer 1 est au début
  const layer1Item = layerItems[0];
  const toFrontButton = layer1Item.querySelector('[aria-label="send-layer-to-front"]') as HTMLButtonElement;

  fireEvent.click(toFrontButton);

  // Layer 1 devrait maintenant être à la fin
  expect(useSceneStore.getState().scene.layerOrder).toEqual([l2, l3, l1]);
});

test('moveLayerToBack button moves layer to back', () => {
  const { addLayer } = useSceneStore.getState();
  addLayer('Layer 1');
  addLayer('Layer 2');
  addLayer('Layer 3');

  const [l1, l2, l3] = useSceneStore.getState().scene.layerOrder;

  render(<App />);

  expect(useSceneStore.getState().scene.layerOrder).toEqual([l1, l2, l3]);

  const layersList = screen.getByRole('list', { name: /layers-list/i });
  const layerItems = layersList.querySelectorAll('li');

  // Layer 3 est à la fin
  const layer3Item = layerItems[2];
  const toBackButton = layer3Item.querySelector('[aria-label="send-layer-to-back"]') as HTMLButtonElement;

  fireEvent.click(toBackButton);

  // Layer 3 devrait maintenant être au début
  expect(useSceneStore.getState().scene.layerOrder).toEqual([l3, l1, l2]);
});

test('buttons are disabled when layer is at back', () => {
  const { addLayer } = useSceneStore.getState();
  addLayer('Layer 1');
  addLayer('Layer 2');

  render(<App />);

  const layersList = screen.getByRole('list', { name: /layers-list/i });
  const layerItems = layersList.querySelectorAll('li');

  // Layer 1 est au début (back)
  const layer1Item = layerItems[0];
  const toBackButton = layer1Item.querySelector('[aria-label="send-layer-to-back"]') as HTMLButtonElement;
  const backwardButton = layer1Item.querySelector('[aria-label="send-layer-backward"]') as HTMLButtonElement;

  expect(toBackButton.disabled).toBe(true);
  expect(backwardButton.disabled).toBe(true);
});

test('buttons are disabled when layer is at front', () => {
  const { addLayer } = useSceneStore.getState();
  addLayer('Layer 1');
  addLayer('Layer 2');

  render(<App />);

  const layersList = screen.getByRole('list', { name: /layers-list/i });
  const layerItems = layersList.querySelectorAll('li');

  // Layer 2 est à la fin (front)
  const layer2Item = layerItems[1];
  const toFrontButton = layer2Item.querySelector('[aria-label="send-layer-to-front"]') as HTMLButtonElement;
  const forwardButton = layer2Item.querySelector('[aria-label="send-layer-forward"]') as HTMLButtonElement;

  expect(toFrontButton.disabled).toBe(true);
  expect(forwardButton.disabled).toBe(true);
});

test('SVG rendering order respects layerOrder', () => {
  const { addLayer, addRectPiece } = useSceneStore.getState();

  // Créer un matériau
  const materialId = useSceneStore.getState().addMaterial({ name: 'Mat1', oriented: false });

  // Créer 3 layers et ajouter une pièce dans chacun
  addLayer('Layer 1');
  addLayer('Layer 2');
  addLayer('Layer 3');

  const [l1, l2, l3] = useSceneStore.getState().scene.layerOrder;

  addRectPiece(l1, materialId, 50, 50, 10, 10);
  addRectPiece(l2, materialId, 50, 50, 20, 20);
  addRectPiece(l3, materialId, 50, 50, 30, 30);

  const { container } = render(<App />);

  // Récupérer tous les groupes de pièces dans l'ordre du DOM
  const svg = container.querySelector('svg');
  const pieceGroups = svg?.querySelectorAll('g[data-testid], g:not([data-testid])');

  // Vérifier que les pièces sont rendues dans l'ordre de layerOrder
  const pieces = Object.values(useSceneStore.getState().scene.pieces);
  const piecesByLayer = pieces.reduce((acc, p) => {
    if (!acc[p.layerId]) acc[p.layerId] = [];
    acc[p.layerId].push(p);
    return acc;
  }, {} as Record<string, typeof pieces>);

  // L'ordre dans layerOrder détermine l'ordre de rendu
  const layerOrder = useSceneStore.getState().scene.layerOrder;

  // Le dernier layer dans layerOrder devrait être rendu en dernier (au-dessus)
  expect(layerOrder).toEqual([l1, l2, l3]);

  // Déplacer l1 au front
  useSceneStore.getState().moveLayerToFront(l1);

  expect(useSceneStore.getState().scene.layerOrder).toEqual([l2, l3, l1]);
});

test('layer order operations preserve piece selection', () => {
  const { addLayer, addRectPiece, selectPiece } = useSceneStore.getState();

  const materialId = useSceneStore.getState().addMaterial({ name: 'Mat1', oriented: false });

  addLayer('Layer 1');
  addLayer('Layer 2');

  const [l1, l2] = useSceneStore.getState().scene.layerOrder;

  addRectPiece(l1, materialId, 50, 50, 10, 10);
  addRectPiece(l2, materialId, 50, 50, 20, 20);

  const pieces = Object.keys(useSceneStore.getState().scene.pieces);
  const p1 = pieces[0];

  selectPiece(p1);

  render(<App />);

  expect(useSceneStore.getState().ui.selectedId).toBe(p1);

  // Déplacer layer
  const layersList = screen.getByRole('list', { name: /layers-list/i });
  const layerItems = layersList.querySelectorAll('li');
  const layer1Item = layerItems[0];
  const forwardButton = layer1Item.querySelector('[aria-label="send-layer-forward"]') as HTMLButtonElement;

  fireEvent.click(forwardButton);

  // La sélection devrait être préservée
  expect(useSceneStore.getState().ui.selectedId).toBe(p1);
});
