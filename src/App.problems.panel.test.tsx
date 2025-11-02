import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProblemsPanel from './components/ProblemsPanel';
import * as editorStore from './store/editorStore';
import * as useSceneStore from './state/useSceneStore';

// Mock the stores
vi.mock('./store/editorStore', () => ({
  selectProblems: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock('./state/useSceneStore', () => ({
  useSceneStore: {
    getState: vi.fn(),
  },
}));

describe('ProblemsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no problems
    (editorStore.selectProblems as any).mockReturnValue({
      hasBlock: false,
      problems: [],
    });
    (editorStore.subscribe as any).mockReturnValue(() => {});
  });

  it('groups by code and shows counts', () => {
    const mockProblems = {
      hasBlock: true,
      problems: [
        { code: 'outside_scene', severity: 'BLOCK', pieceId: 'p1', message: 'Outside' },
        { code: 'outside_scene', severity: 'BLOCK', pieceId: 'p2', message: 'Outside' },
        { code: 'min_size_violation', severity: 'BLOCK', pieceId: 'p3', message: 'Too small' },
      ],
    };
    (editorStore.selectProblems as any).mockReturnValue(mockProblems);

    render(<ProblemsPanel />);

    // Check groups exist
    expect(screen.getByTestId('group-outside_scene')).toBeInTheDocument();
    expect(screen.getByTestId('group-min_size_violation')).toBeInTheDocument();

    // Check counts
    expect(screen.getByText(/Hors cadre scène \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Taille minimale non respectée \(1\)/)).toBeInTheDocument();
  });

  it('filters BLOCK/WARN correctly', () => {
    const mockProblems = {
      hasBlock: true,
      problems: [
        { code: 'outside_scene', severity: 'BLOCK', pieceId: 'p1', message: 'Outside' },
        { code: 'material_orientation_mismatch', severity: 'WARN', pieceId: 'p2', message: 'Orientation' },
      ],
    };
    (editorStore.selectProblems as any).mockReturnValue(mockProblems);

    render(<ProblemsPanel />);

    // Initially ALL filter is active, both groups visible
    expect(screen.getByTestId('group-outside_scene')).toBeInTheDocument();
    expect(screen.getByTestId('group-material_orientation_mismatch')).toBeInTheDocument();

    // Click BLOCK filter
    fireEvent.click(screen.getByTestId('filter-block'));

    // Only BLOCK group should be visible
    expect(screen.getByTestId('group-outside_scene')).toBeInTheDocument();
    expect(screen.queryByTestId('group-material_orientation_mismatch')).not.toBeInTheDocument();
  });

  it('zoom button triggers focus/flash', () => {
    const mockProblems = {
      hasBlock: true,
      problems: [
        { code: 'outside_scene', severity: 'BLOCK', pieceId: 'test-piece', message: 'Outside' },
      ],
    };
    (editorStore.selectProblems as any).mockReturnValue(mockProblems);

    const mockFocusPiece = vi.fn();
    const mockFlashOutline = vi.fn();
    (useSceneStore.useSceneStore.getState as any).mockReturnValue({
      focusPiece: mockFocusPiece,
      flashOutline: mockFlashOutline,
    });

    render(<ProblemsPanel />);

    const zoomButton = screen.getByTestId('zoom-test-piece');
    expect(zoomButton).toBeInTheDocument();

    fireEvent.click(zoomButton);

    expect(mockFocusPiece).toHaveBeenCalledWith('test-piece');
    expect(mockFlashOutline).toHaveBeenCalledWith('test-piece');
  });

  it('shows filter tabs with aria-selected', () => {
    const mockProblems = {
      hasBlock: true,
      problems: [{ code: 'outside_scene', severity: 'BLOCK', pieceId: 'p1', message: 'Outside' }],
    };
    (editorStore.selectProblems as any).mockReturnValue(mockProblems);

    render(<ProblemsPanel />);

    const allTab = screen.getByTestId('filter-all');
    const blockTab = screen.getByTestId('filter-block');
    const warnTab = screen.getByTestId('filter-warn');

    expect(allTab).toHaveAttribute('aria-selected', 'true');
    expect(blockTab).toHaveAttribute('aria-selected', 'false');
    expect(warnTab).toHaveAttribute('aria-selected', 'false');
  });
});
