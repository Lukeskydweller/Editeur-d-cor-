import { render, screen } from '@testing-library/react';
import { beforeEach, describe, it, expect } from 'vitest';
import App from './App';
import { useSceneStore } from '@/state/useSceneStore';

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
      lockEdge: false,
      guides: undefined,
      resizing: undefined,
      history: {
        past: [],
        future: [],
        limit: 100,
      },
    },
  });
});

describe('Resize functionality', () => {
  describe('Resize handles visibility', () => {
    it('displays 8 resize handles when exactly 1 piece is selected', () => {
      const { initSceneWithDefaults, selectPiece } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
      selectPiece(pieceId);

      render(<App />);

      // Should have 8 handles: n, s, e, w, ne, nw, se, sw
      expect(screen.getByLabelText('resize-handle-n')).toBeDefined();
      expect(screen.getByLabelText('resize-handle-s')).toBeDefined();
      expect(screen.getByLabelText('resize-handle-e')).toBeDefined();
      expect(screen.getByLabelText('resize-handle-w')).toBeDefined();
      expect(screen.getByLabelText('resize-handle-ne')).toBeDefined();
      expect(screen.getByLabelText('resize-handle-nw')).toBeDefined();
      expect(screen.getByLabelText('resize-handle-se')).toBeDefined();
      expect(screen.getByLabelText('resize-handle-sw')).toBeDefined();
    });

    it('hides resize handles when no piece is selected', () => {
      const { initSceneWithDefaults } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      render(<App />);

      expect(screen.queryByLabelText('resize-handle-n')).toBeNull();
    });

    it('shows group resize handles when multiple pieces are selected', () => {
      const { initSceneWithDefaults, addRectAtCenter, setSelection } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);
      addRectAtCenter(100, 50);

      const pieceIds = Object.keys(useSceneStore.getState().scene.pieces);
      setSelection(pieceIds);

      render(<App />);

      // Group handles should be visible for multi-selection
      expect(screen.queryByLabelText('resize-handle-n')).not.toBeNull();
    });
  });

  describe('Store actions - East handle resize', () => {
    it('dragging east handle increases width with lockEdge=true', () => {
      const { initSceneWithDefaults, startResize, updateResize, endResize, setLockEdge } =
        useSceneStore.getState();
      initSceneWithDefaults(600, 600);
      setLockEdge(true);

      const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
      const piece = useSceneStore.getState().scene.pieces[pieceId];
      const initialX = piece.position.x;
      const initialW = piece.size.w;

      // Start resize on east handle
      startResize(pieceId, 'e');

      // Simulate drag to the right (increase width by ~50mm)
      updateResize({ x: initialX + initialW + 50, y: piece.position.y + piece.size.h / 2 });

      // Commit resize
      endResize(true);

      const updatedPiece = useSceneStore.getState().scene.pieces[pieceId];
      expect(updatedPiece.position.x).toBe(initialX); // X unchanged with lockEdge
      expect(updatedPiece.size.w).toBeGreaterThan(initialW); // Width increased
    });
  });

  describe('Store actions - West handle resize', () => {
    it('dragging west handle resizes from left edge with lockEdge=true', () => {
      const { initSceneWithDefaults, startResize, updateResize, endResize, setLockEdge } =
        useSceneStore.getState();
      initSceneWithDefaults(600, 600);
      setLockEdge(true);

      const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
      const piece = useSceneStore.getState().scene.pieces[pieceId];
      const initialRight = piece.position.x + piece.size.w;

      // Start resize on west handle
      startResize(pieceId, 'w');

      // Simulate drag to the left (increase width by moving left edge)
      updateResize({ x: piece.position.x - 50, y: piece.position.y + piece.size.h / 2 });

      // Commit resize
      endResize(true);

      const updatedPiece = useSceneStore.getState().scene.pieces[pieceId];
      const updatedRight = updatedPiece.position.x + updatedPiece.size.w;

      // Right edge should stay fixed with lockEdge
      expect(updatedRight).toBe(initialRight);
      // X and W should change
      expect(updatedPiece.position.x).toBeLessThan(piece.position.x);
      expect(updatedPiece.size.w).toBeGreaterThan(piece.size.w);
    });
  });

  describe('Store actions - Scene bounds clamping', () => {
    it('cannot resize beyond scene bounds', () => {
      const { initSceneWithDefaults, startResize, updateResize, endResize } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];

      // Start resize on east handle
      startResize(pieceId, 'e');

      // Try to drag beyond scene bounds
      updateResize({ x: 10000, y: 100 });

      // Commit resize
      endResize(true);

      const updatedPiece = useSceneStore.getState().scene.pieces[pieceId];

      // Should be clamped to scene width
      expect(updatedPiece.position.x + updatedPiece.size.w).toBeLessThanOrEqual(600);
    });
  });

  describe('Store actions - Minimum size constraint', () => {
    it('enforces minimum size of 5mm', () => {
      const { initSceneWithDefaults, startResize, updateResize, endResize, setSnap10mm } =
        useSceneStore.getState();
      initSceneWithDefaults(600, 600);
      setSnap10mm(false); // Disable grid snap for this test

      const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
      const piece = useSceneStore.getState().scene.pieces[pieceId];

      // Start resize on east handle
      startResize(pieceId, 'e');

      // Try to drag to very small size
      updateResize({ x: piece.position.x + 1, y: piece.position.y + piece.size.h / 2 });

      // Commit resize
      endResize(true);

      const updatedPiece = useSceneStore.getState().scene.pieces[pieceId];

      // Should enforce minimum
      expect(updatedPiece.size.w).toBeGreaterThanOrEqual(5);
      expect(updatedPiece.size.h).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Store actions - Grid snap', () => {
    it('snaps dimensions to 10mm grid when snap is enabled', () => {
      const { initSceneWithDefaults, startResize, updateResize, endResize, setSnap10mm } =
        useSceneStore.getState();
      initSceneWithDefaults(600, 600);
      setSnap10mm(true);

      const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
      const piece = useSceneStore.getState().scene.pieces[pieceId];

      // Start resize on east handle
      startResize(pieceId, 'e');

      // Simulate drag
      updateResize({ x: piece.position.x + piece.size.w + 37, y: piece.position.y + piece.size.h / 2 });

      // Commit resize
      endResize(true);

      const updatedPiece = useSceneStore.getState().scene.pieces[pieceId];

      // Width should be multiple of 10
      expect(updatedPiece.size.w % 10).toBe(0);
      expect(updatedPiece.position.x % 10).toBe(0);
    });
  });

  describe('Store actions - Escape cancels resize', () => {
    it('canceling resize rolls back dimensions', () => {
      const { initSceneWithDefaults, startResize, updateResize, endResize } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
      const piece = useSceneStore.getState().scene.pieces[pieceId];
      const initialW = piece.size.w;

      // Start resize
      startResize(pieceId, 'e');

      // Simulate drag
      updateResize({ x: piece.position.x + piece.size.w + 100, y: piece.position.y + piece.size.h / 2 });

      // Cancel resize (Escape)
      endResize(false);

      const updatedPiece = useSceneStore.getState().scene.pieces[pieceId];

      // Should be unchanged
      expect(updatedPiece.size.w).toBe(initialW);
    });
  });

  describe('Store actions - History integration', () => {
    it('resize pushes to history and undo works', () => {
      const { initSceneWithDefaults, startResize, updateResize, endResize, undo } =
        useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
      const piece = useSceneStore.getState().scene.pieces[pieceId];
      const initialW = piece.size.w;

      // Start resize
      startResize(pieceId, 'e');

      // Simulate drag
      updateResize({ x: piece.position.x + piece.size.w + 50, y: piece.position.y + piece.size.h / 2 });

      // Commit resize
      endResize(true);

      const resizedPiece = useSceneStore.getState().scene.pieces[pieceId];
      expect(resizedPiece.size.w).not.toBe(initialW);

      // Undo should restore
      undo();

      const restoredPiece = useSceneStore.getState().scene.pieces[pieceId];
      expect(restoredPiece.size.w).toBe(initialW);
    });
  });

  describe('UI integration - Lock edge toggle', () => {
    it('lock edge checkbox is present and toggleable', () => {
      const { initSceneWithDefaults } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      render(<App />);

      const lockEdgeCheckbox = screen.getByLabelText('toggle-lock-edge') as HTMLInputElement;
      expect(lockEdgeCheckbox).toBeDefined();
      expect(lockEdgeCheckbox.checked).toBe(false);

      // Check state via store (more reliable than simulating click in jsdom)
      const { setLockEdge } = useSceneStore.getState();
      setLockEdge(true);
      expect(useSceneStore.getState().ui.lockEdge).toBe(true);

      setLockEdge(false);
      expect(useSceneStore.getState().ui.lockEdge).toBe(false);
    });
  });

  describe('UI integration - All 8 handles', () => {
    it('all handles are present and focusable', () => {
      const { initSceneWithDefaults, selectPiece } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
      selectPiece(pieceId);

      render(<App />);

      const handles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

      handles.forEach((handleName) => {
        const handle = screen.getByLabelText(`resize-handle-${handleName}`);
        expect(handle).toBeDefined();

        // Test that it can be focused (accessibility)
        expect(handle.getAttribute('tabindex')).toBe('0');
      });
    });

    it('shows resize handles when piece is rotated', () => {
      const { initSceneWithDefaults, rotateSelected } = useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
      useSceneStore.getState().selectPiece(pieceId);

      const { rerender } = render(<App />);

      // Initially, handles should be visible (rotation = 0)
      expect(screen.queryByLabelText('resize-handle-e')).toBeInTheDocument();

      // Rotate piece by 90°
      rotateSelected(90);
      rerender(<App />);

      // S23b: Handles should still be visible (supports all rotations)
      expect(screen.queryByLabelText('resize-handle-e')).toBeInTheDocument();
      expect(screen.queryByLabelText('resize-handle-n')).toBeInTheDocument();
    });
  });

  describe('Store actions - Snap to pieces', () => {
    it('generates guides when resizing near another piece', () => {
      const { initSceneWithDefaults, addRectAtCenter, startResize, updateResize } =
        useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      // Add second piece at known position
      addRectAtCenter(100, 50);

      const pieceIds = Object.keys(useSceneStore.getState().scene.pieces);
      const firstPieceId = pieceIds[0];
      const firstPiece = useSceneStore.getState().scene.pieces[firstPieceId];

      // Start resize on first piece
      startResize(firstPieceId, 'e');

      // Drag towards the second piece to trigger snap
      const secondPiece = useSceneStore.getState().scene.pieces[pieceIds[1]];
      updateResize({
        x: secondPiece.position.x - 3, // Within snap threshold
        y: firstPiece.position.y + firstPiece.size.h / 2,
      });

      // Guides should be generated
      const guides = useSceneStore.getState().ui.guides;
      expect(guides).toBeDefined();
      expect(guides && guides.length).toBeGreaterThan(0);
    });
  });

  describe('Minimum size enforcement after snap', () => {
    it('cannot resize below 5mm even with snap ON', () => {
      const { initSceneWithDefaults, startResize, updateResize, endResize, setSnap10mm } =
        useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
      const piece = useSceneStore.getState().scene.pieces[pieceId];

      // Enable snap
      setSnap10mm(true);

      // Start resize from east handle (moving right edge left)
      startResize(pieceId, 'e');

      // Try to resize to very small width (would snap to 0 or negative)
      // Piece at x=40, w=100 → right edge at 140
      // Move pointer to x=42 (would give w=2, snap to 0)
      updateResize({
        x: piece.position.x + 2, // Would result in w=2, snapped to 0
        y: piece.position.y + piece.size.h / 2,
      });

      const resizedPiece = useSceneStore.getState().scene.pieces[pieceId];

      // Width should be at least 5mm, not 0 or negative
      expect(resizedPiece.size.w).toBeGreaterThanOrEqual(5);

      // Height should remain unchanged
      expect(resizedPiece.size.h).toBe(piece.size.h);

      endResize(false); // Cancel
    });

    it('cannot resize below 5mm even with snap OFF', () => {
      const { initSceneWithDefaults, startResize, updateResize, endResize, setSnap10mm } =
        useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
      const piece = useSceneStore.getState().scene.pieces[pieceId];

      // Disable snap
      setSnap10mm(false);

      // Start resize from south handle (moving bottom edge up)
      startResize(pieceId, 's');

      // Try to resize to very small height
      // Piece at y=40, h=50 → bottom edge at 90
      // Move pointer to y=42 (would give h=2)
      updateResize({
        x: piece.position.x + piece.size.w / 2,
        y: piece.position.y + 2, // Would result in h=2
      });

      const resizedPiece = useSceneStore.getState().scene.pieces[pieceId];

      // Height should be at least 5mm
      expect(resizedPiece.size.h).toBeGreaterThanOrEqual(5);

      // Width should remain unchanged
      expect(resizedPiece.size.w).toBe(piece.size.w);

      endResize(false); // Cancel
    });

    it('respects lockEdge when enforcing minSize', () => {
      const { initSceneWithDefaults, startResize, updateResize, endResize, setSnap10mm, setLockEdge } =
        useSceneStore.getState();
      initSceneWithDefaults(600, 600);

      const pieceId = Object.keys(useSceneStore.getState().scene.pieces)[0];
      const piece = useSceneStore.getState().scene.pieces[pieceId];

      // Disable snap for precise lockEdge test (snap can round to grid)
      setSnap10mm(false);
      setLockEdge(true);

      const originalRight = piece.position.x + piece.size.w;

      // Start resize from west handle (moving left edge, right edge locked)
      startResize(pieceId, 'w');

      // Try to resize to very small width
      // Move left edge far to the right (would collapse width)
      updateResize({
        x: piece.position.x + piece.size.w - 2, // Would give w=2
        y: piece.position.y + piece.size.h / 2,
      });

      const resizedPiece = useSceneStore.getState().scene.pieces[pieceId];

      // Width should be at least 5mm
      expect(resizedPiece.size.w).toBeGreaterThanOrEqual(5);

      // Right edge should stay fixed (lockEdge=true)
      const newRight = resizedPiece.position.x + resizedPiece.size.w;
      expect(Math.abs(newRight - originalRight)).toBeLessThan(1); // Allow small rounding error

      endResize(false); // Cancel
    });
  });
});
