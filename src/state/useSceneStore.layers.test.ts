import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from './useSceneStore';

describe('useSceneStore - layer ordering', () => {
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

  describe('moveLayerForward', () => {
    it('moves layer forward by 1 position', () => {
      const { addLayer, moveLayerForward } = useSceneStore.getState();
      addLayer('L1');
      addLayer('L2');
      addLayer('L3');

      const [l1, l2, l3] = useSceneStore.getState().scene.layerOrder;

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1, l2, l3]);

      moveLayerForward(l1);

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l2, l1, l3]);
    });

    it('does nothing when layer is already at front', () => {
      const { addLayer, moveLayerForward } = useSceneStore.getState();
      addLayer('L1');
      addLayer('L2');

      const [l1, l2] = useSceneStore.getState().scene.layerOrder;

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1, l2]);

      moveLayerForward(l2);

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1, l2]);
    });

    it('does nothing when layer does not exist', () => {
      const { addLayer, moveLayerForward } = useSceneStore.getState();
      addLayer('L1');

      const [l1] = useSceneStore.getState().scene.layerOrder;

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1]);

      moveLayerForward('nonexistent');

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1]);
    });
  });

  describe('moveLayerBackward', () => {
    it('moves layer backward by 1 position', () => {
      const { addLayer, moveLayerBackward } = useSceneStore.getState();
      addLayer('L1');
      addLayer('L2');
      addLayer('L3');

      const [l1, l2, l3] = useSceneStore.getState().scene.layerOrder;

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1, l2, l3]);

      moveLayerBackward(l3);

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1, l3, l2]);
    });

    it('does nothing when layer is already at back', () => {
      const { addLayer, moveLayerBackward } = useSceneStore.getState();
      addLayer('L1');
      addLayer('L2');

      const [l1, l2] = useSceneStore.getState().scene.layerOrder;

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1, l2]);

      moveLayerBackward(l1);

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1, l2]);
    });

    it('does nothing when layer does not exist', () => {
      const { addLayer, moveLayerBackward } = useSceneStore.getState();
      addLayer('L1');

      const [l1] = useSceneStore.getState().scene.layerOrder;

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1]);

      moveLayerBackward('nonexistent');

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1]);
    });
  });

  describe('moveLayerToFront', () => {
    it('moves layer to front (end of layerOrder)', () => {
      const { addLayer, moveLayerToFront } = useSceneStore.getState();
      addLayer('L1');
      addLayer('L2');
      addLayer('L3');

      const [l1, l2, l3] = useSceneStore.getState().scene.layerOrder;

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1, l2, l3]);

      moveLayerToFront(l1);

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l2, l3, l1]);
    });

    it('does nothing when layer is already at front', () => {
      const { addLayer, moveLayerToFront } = useSceneStore.getState();
      addLayer('L1');
      addLayer('L2');

      const [l1, l2] = useSceneStore.getState().scene.layerOrder;

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1, l2]);

      moveLayerToFront(l2);

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1, l2]);
    });

    it('does nothing when layer does not exist', () => {
      const { addLayer, moveLayerToFront } = useSceneStore.getState();
      addLayer('L1');

      const [l1] = useSceneStore.getState().scene.layerOrder;

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1]);

      moveLayerToFront('nonexistent');

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1]);
    });
  });

  describe('moveLayerToBack', () => {
    it('moves layer to back (beginning of layerOrder)', () => {
      const { addLayer, moveLayerToBack } = useSceneStore.getState();
      addLayer('L1');
      addLayer('L2');
      addLayer('L3');

      const [l1, l2, l3] = useSceneStore.getState().scene.layerOrder;

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1, l2, l3]);

      moveLayerToBack(l3);

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l3, l1, l2]);
    });

    it('does nothing when layer is already at back', () => {
      const { addLayer, moveLayerToBack } = useSceneStore.getState();
      addLayer('L1');
      addLayer('L2');

      const [l1, l2] = useSceneStore.getState().scene.layerOrder;

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1, l2]);

      moveLayerToBack(l1);

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1, l2]);
    });

    it('does nothing when layer does not exist', () => {
      const { addLayer, moveLayerToBack } = useSceneStore.getState();
      addLayer('L1');

      const [l1] = useSceneStore.getState().scene.layerOrder;

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1]);

      moveLayerToBack('nonexistent');

      expect(useSceneStore.getState().scene.layerOrder).toEqual([l1]);
    });
  });

  describe('layerOrder uniqueness', () => {
    it('preserves uniqueness after multiple operations', () => {
      const { addLayer, moveLayerForward, moveLayerBackward, moveLayerToFront, moveLayerToBack } =
        useSceneStore.getState();
      addLayer('L1');
      addLayer('L2');
      addLayer('L3');

      const [l1, l2, l3] = useSceneStore.getState().scene.layerOrder;

      moveLayerForward(l1);
      moveLayerBackward(l3);
      moveLayerToFront(l2);
      moveLayerToBack(l1);

      const layerOrder = useSceneStore.getState().scene.layerOrder;
      const uniqueLayers = Array.from(new Set(layerOrder));

      expect(layerOrder.length).toBe(uniqueLayers.length);
      expect(layerOrder).toContain(l1);
      expect(layerOrder).toContain(l2);
      expect(layerOrder).toContain(l3);
    });
  });
});
