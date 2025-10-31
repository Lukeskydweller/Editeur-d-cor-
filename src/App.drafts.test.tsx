import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect } from 'vitest';
import App from './App';
import { useSceneStore } from '@/state/useSceneStore';
import { listDrafts } from '@/lib/drafts';

beforeEach(() => {
  localStorage.clear();
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

describe('Draft Management', () => {
  describe('Create Draft', () => {
    it('new draft button creates draft with auto-name', () => {
      const { initSceneWithDefaults } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      render(<App />);

      const newButton = screen.getByRole('button', { name: /new-draft/i });
      fireEvent.click(newButton);

      const drafts = listDrafts();
      expect(drafts).toHaveLength(1);
      expect(drafts[0].name).toBe('Brouillon 1');
      expect(drafts[0].id).toMatch(/^draft_/);
    });

    it('multiple new drafts increment counter', () => {
      const { initSceneWithDefaults } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      render(<App />);

      const newButton = screen.getByRole('button', { name: /new-draft/i });

      fireEvent.click(newButton);
      fireEvent.click(newButton);
      fireEvent.click(newButton);

      const drafts = listDrafts();
      expect(drafts).toHaveLength(3);
      expect(drafts.map((d) => d.name).sort()).toEqual(['Brouillon 1', 'Brouillon 2', 'Brouillon 3']);
    });

    it('new draft captures current scene state', () => {
      const { initSceneWithDefaults, addRectAtCenter } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);
      addRectAtCenter(100, 50);

      render(<App />);

      const newButton = screen.getByRole('button', { name: /new-draft/i });
      fireEvent.click(newButton);

      const drafts = listDrafts();
      expect(drafts[0].bytes).toBeGreaterThan(0);
      expect(drafts[0].updatedAt).toBeDefined();
    });
  });

  describe('Save to Draft', () => {
    it('save button updates existing draft', () => {
      const { initSceneWithDefaults, createDraft, addRectAtCenter } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);
      createDraft();

      const initialDrafts = listDrafts();
      expect(initialDrafts).toHaveLength(1);
      const initialBytes = initialDrafts[0].bytes;
      const initialUpdatedAt = initialDrafts[0].updatedAt;

      // Wait a bit to ensure timestamp changes
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      delay(10);

      // Modify scene
      addRectAtCenter(200, 100);

      render(<App />);

      const saveButton = screen.getByRole('button', { name: /save-draft-/i });
      fireEvent.click(saveButton);

      const updatedDrafts = listDrafts();
      expect(updatedDrafts).toHaveLength(1);
      expect(updatedDrafts[0].bytes).toBeGreaterThanOrEqual(initialBytes);
      expect(updatedDrafts[0].updatedAt).not.toBe(initialUpdatedAt);
    });
  });

  describe('Load Draft', () => {
    it('load button replaces current scene', () => {
      const { initSceneWithDefaults, createDraft, addRectAtCenter } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      // Create draft with one piece
      addRectAtCenter(100, 50);
      const initialPiecesCount = Object.keys(useSceneStore.getState().scene.pieces).length;
      createDraft();

      // Add more pieces to current scene
      addRectAtCenter(200, 100);
      addRectAtCenter(300, 150);
      expect(Object.keys(useSceneStore.getState().scene.pieces).length).toBe(initialPiecesCount + 2);

      render(<App />);

      const loadButton = screen.getByRole('button', { name: /load-draft-/i });
      fireEvent.click(loadButton);

      // Scene should be restored to draft state
      const scene = useSceneStore.getState().scene;
      expect(Object.keys(scene.pieces).length).toBe(initialPiecesCount);
    });

    it('load pushes to history and undo works', () => {
      const { initSceneWithDefaults, createDraft, addRectAtCenter, undo } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      // Create draft
      addRectAtCenter(100, 50);
      createDraft();

      // Modify scene
      addRectAtCenter(200, 100);
      const beforeLoadCount = Object.keys(useSceneStore.getState().scene.pieces).length;

      render(<App />);

      const loadButton = screen.getByRole('button', { name: /load-draft-/i });
      fireEvent.click(loadButton);

      const afterLoadCount = Object.keys(useSceneStore.getState().scene.pieces).length;
      expect(afterLoadCount).toBeLessThan(beforeLoadCount);

      // Undo should restore pre-load state
      undo();
      const afterUndoCount = Object.keys(useSceneStore.getState().scene.pieces).length;
      expect(afterUndoCount).toBe(beforeLoadCount);
    });
  });

  describe('Rename Draft', () => {
    it('rename button updates draft name', () => {
      const { initSceneWithDefaults, createDraft } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);
      createDraft();

      render(<App />);

      // Mock window.prompt
      const originalPrompt = window.prompt;
      window.prompt = () => 'My Custom Name';

      const renameButton = screen.getByRole('button', { name: /rename-draft-/i });
      fireEvent.click(renameButton);

      const drafts = listDrafts();
      expect(drafts[0].name).toBe('My Custom Name');

      // Restore
      window.prompt = originalPrompt;
    });

    it('rename validates non-empty name', () => {
      const { initSceneWithDefaults, createDraft } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);
      createDraft();

      render(<App />);

      // Mock window.prompt and alert
      const originalPrompt = window.prompt;
      const originalAlert = window.alert;
      let alertCalled = false;
      window.prompt = () => '   '; // Empty after trim
      window.alert = () => {
        alertCalled = true;
      };

      const renameButton = screen.getByRole('button', { name: /rename-draft-/i });
      fireEvent.click(renameButton);

      expect(alertCalled).toBe(true);
      const drafts = listDrafts();
      expect(drafts[0].name).toBe('Brouillon 1'); // Unchanged

      // Restore
      window.prompt = originalPrompt;
      window.alert = originalAlert;
    });

    it('rename validates max 60 characters', () => {
      const { initSceneWithDefaults, createDraft } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);
      createDraft();

      render(<App />);

      // Mock window.prompt and alert
      const originalPrompt = window.prompt;
      const originalAlert = window.alert;
      let alertCalled = false;
      window.prompt = () => 'x'.repeat(61); // Too long
      window.alert = () => {
        alertCalled = true;
      };

      const renameButton = screen.getByRole('button', { name: /rename-draft-/i });
      fireEvent.click(renameButton);

      expect(alertCalled).toBe(true);
      const drafts = listDrafts();
      expect(drafts[0].name).toBe('Brouillon 1'); // Unchanged

      // Restore
      window.prompt = originalPrompt;
      window.alert = originalAlert;
    });
  });

  describe('Delete Draft', () => {
    it('delete button removes draft after confirmation', () => {
      const { initSceneWithDefaults, createDraft } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);
      createDraft();

      expect(listDrafts()).toHaveLength(1);

      render(<App />);

      // Mock window.confirm
      const originalConfirm = window.confirm;
      window.confirm = () => true;

      const deleteButton = screen.getByRole('button', { name: /delete-draft-/i });
      fireEvent.click(deleteButton);

      expect(listDrafts()).toHaveLength(0);

      // Restore
      window.confirm = originalConfirm;
    });

    it('delete cancels when user declines confirmation', () => {
      const { initSceneWithDefaults, createDraft } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);
      createDraft();

      expect(listDrafts()).toHaveLength(1);

      render(<App />);

      // Mock window.confirm
      const originalConfirm = window.confirm;
      window.confirm = () => false;

      const deleteButton = screen.getByRole('button', { name: /delete-draft-/i });
      fireEvent.click(deleteButton);

      expect(listDrafts()).toHaveLength(1); // Unchanged

      // Restore
      window.confirm = originalConfirm;
    });
  });

  describe('UI Integration', () => {
    it('empty state shows "Aucun brouillon"', () => {
      const { initSceneWithDefaults } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      render(<App />);

      expect(screen.getByText(/Aucun brouillon/i)).toBeDefined();
    });

    it('drafts list displays metadata correctly', () => {
      const { initSceneWithDefaults, createDraft } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);
      createDraft();

      render(<App />);

      const drafts = listDrafts();
      expect(screen.getByText('Brouillon 1')).toBeDefined();
      expect(screen.getByText(/KB/i)).toBeDefined(); // Size displayed
    });

    it('drafts list is accessible', () => {
      const { initSceneWithDefaults, createDraft } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);
      createDraft();

      render(<App />);

      const list = screen.getByRole('list', { name: /drafts-list/i });
      expect(list).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('load nonexistent draft shows no error (graceful)', () => {
      const { initSceneWithDefaults, loadDraftById } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      const initialPiecesCount = Object.keys(useSceneStore.getState().scene.pieces).length;

      // Try to load nonexistent draft
      loadDraftById('nonexistent-id');

      // Scene should be unchanged
      const afterCount = Object.keys(useSceneStore.getState().scene.pieces).length;
      expect(afterCount).toBe(initialPiecesCount);
    });
  });
});
