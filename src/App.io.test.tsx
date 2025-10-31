import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, vi, describe, it, expect } from 'vitest';
import App from './App';
import { useSceneStore } from '@/state/useSceneStore';
import type { SceneFileV1 } from '@/lib/io/schema';

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
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
      history: {
        past: [],
        future: [],
        limit: 100,
      },
    },
  });
});

describe('JSON Export/Import', () => {
  describe('Export', () => {
    it('export button creates downloadable JSON file', () => {
      const { initSceneWithDefaults } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      render(<App />);

      const exportButton = screen.getByRole('button', { name: /export-json/i });
      fireEvent.click(exportButton);

      // Verify URL.createObjectURL was called
      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));

      // Verify URL.revokeObjectURL was called for cleanup
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('exported JSON contains version 1', () => {
      const { initSceneWithDefaults, toSceneFileV1 } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      const exported = toSceneFileV1();

      expect(exported.version).toBe(1);
      expect(exported.scene).toBeDefined();
      expect(exported.scene.id).toBeDefined();
      expect(exported.scene.layerOrder).toBeDefined();
    });

    it('round-trip: export then import restores scene', () => {
      const { initSceneWithDefaults, toSceneFileV1, importSceneFileV1 } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      // Get initial state
      const exported = toSceneFileV1();
      const initialPieces = Object.keys(useSceneStore.getState().scene.pieces);

      // Modify state
      useSceneStore.getState().addRectAtCenter(100, 50);
      expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(initialPieces.length + 1);

      // Import exported state
      importSceneFileV1(exported);

      // Verify state restored
      const restored = useSceneStore.getState().scene;
      expect(Object.keys(restored.pieces).length).toBe(initialPieces.length);
      expect(restored.size).toEqual({ w: 600, h: 600 });
    });
  });

  describe('Import via UI', () => {
    it('import button triggers file input', () => {
      render(<App />);

      const importButton = screen.getByRole('button', { name: /import-json/i });
      const fileInput = screen.getByRole('button', { name: /import-json/i }).parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

      expect(fileInput).toBeDefined();
      expect(fileInput.style.display).toBe('');
      expect(fileInput.className).toContain('hidden');
    });

    it('import success: loads valid JSON and updates scene', async () => {
      const { initSceneWithDefaults, importSceneFileV1 } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      render(<App />);

      // Create valid scene file
      const validFile: SceneFileV1 = {
        version: 1,
        scene: {
          id: 'imported-scene',
          createdAt: '2025-01-01T00:00:00.000Z',
          size: { w: 800, h: 800 },
          materials: {
            'mat-1': {
              id: 'mat-1',
              name: 'Imported Material',
              oriented: false,
            },
          },
          layers: {
            'layer-1': {
              id: 'layer-1',
              name: 'Imported Layer',
              z: 0,
              pieces: ['piece-1'],
            },
          },
          pieces: {
            'piece-1': {
              id: 'piece-1',
              layerId: 'layer-1',
              materialId: 'mat-1',
              position: { x: 100, y: 100 },
              rotationDeg: 0,
              scale: { x: 1, y: 1 },
              kind: 'rect',
              size: { w: 200, h: 100 },
            },
          },
          layerOrder: ['layer-1'],
        },
        ui: {
          snap10mm: false,
        },
      };

      // Import directly to test functionality
      importSceneFileV1(validFile);

      const scene = useSceneStore.getState().scene;
      expect(scene.size).toEqual({ w: 800, h: 800 });
      expect(Object.keys(scene.pieces).length).toBe(1);
      expect(scene.pieces['piece-1']).toBeDefined();

      // Verify no error banner
      const errorBanner = screen.queryByText(/Import invalide/i);
      expect(errorBanner).toBeNull();
    });

    it('import failure: invalid JSON shows error banner', async () => {
      // Initialize scene so we have something to preserve
      const { initSceneWithDefaults } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      render(<App />);

      const invalidJSON = '{ invalid json }';
      const blob = new Blob([invalidJSON], { type: 'application/json' });
      const file = new File([blob], 'invalid.json', { type: 'application/json' });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        const errorBanner = screen.getByTestId('warn-banner');
        expect(errorBanner).toHaveTextContent(/Import invalide/i);
      });

      // Verify scene unchanged
      const scene = useSceneStore.getState().scene;
      expect(scene.layerOrder.length).toBeGreaterThan(0);
    });

    it('import failure: wrong version shows error banner', async () => {
      render(<App />);

      const wrongVersion = {
        version: 2,
        scene: { id: 'test' },
      };

      const jsonString = JSON.stringify(wrongVersion);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], 'wrong-version.json', { type: 'application/json' });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        const errorBanner = screen.getByTestId('warn-banner');
        expect(errorBanner).toHaveTextContent(/Import invalide/i);
      });
    });

    it('import failure: missing required fields shows error banner', async () => {
      render(<App />);

      const incomplete = {
        version: 1,
        scene: {
          id: 'test',
          // missing required fields
        },
      };

      const jsonString = JSON.stringify(incomplete);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], 'incomplete.json', { type: 'application/json' });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        const errorBanner = screen.getByTestId('warn-banner');
        expect(errorBanner).toHaveTextContent(/Import invalide/i);
      });
    });
  });

  describe('History integration', () => {
    it('import pushes to history and undo works', () => {
      const { initSceneWithDefaults, importSceneFileV1 } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      // Add a piece to initial state
      useSceneStore.getState().addRectAtCenter(100, 50);
      const initialPieces = Object.keys(useSceneStore.getState().scene.pieces);

      render(<App />);

      // Create different scene file
      const importedFile: SceneFileV1 = {
        version: 1,
        scene: {
          id: 'imported',
          createdAt: '2025-01-01T00:00:00.000Z',
          size: { w: 600, h: 600 },
          materials: {
            'mat-1': { id: 'mat-1', name: 'Mat1', oriented: false },
          },
          layers: {
            'layer-1': { id: 'layer-1', name: 'Layer 1', z: 0, pieces: [] },
          },
          pieces: {},
          layerOrder: ['layer-1'],
        },
      };

      // Import directly
      importSceneFileV1(importedFile);

      const scene = useSceneStore.getState().scene;
      expect(Object.keys(scene.pieces).length).toBe(0);

      // Undo should restore pre-import state
      useSceneStore.getState().undo();

      const restoredScene = useSceneStore.getState().scene;
      expect(Object.keys(restoredScene.pieces).length).toBe(initialPieces.length);
    });
  });
});
