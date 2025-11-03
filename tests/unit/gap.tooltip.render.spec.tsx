import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import MicroGapTooltip from '@/ui/overlays/MicroGapTooltip';
import { useSceneStore } from '@/state/useSceneStore';
import type { Piece } from '@/types/scene';

describe('MicroGapTooltip - Rendering et lifecycle', () => {
  let mockSVG: SVGSVGElement;
  let rafSpy: any;
  let cancelRafSpy: any;

  beforeAll(() => {
    // Mock requestAnimationFrame/cancelAnimationFrame to execute synchronously
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      // Execute callback immediately in tests
      cb(performance.now());
      return 1; // Return a fake frame ID
    });
    cancelRafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    // Mock DOMPoint for SVG coordinate transformation
    (window as any).DOMPoint = class MockDOMPoint {
      x: number;
      y: number;
      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
      }
      matrixTransform() {
        // Identity transform for tests (1:1 mm to px)
        return { x: this.x, y: this.y };
      }
    };
  });

  afterAll(() => {
    rafSpy?.mockRestore();
    cancelRafSpy?.mockRestore();
  });

  beforeEach(() => {
    vi.useFakeTimers();

    // Create mock SVG element
    mockSVG = document.createElement('svg') as unknown as SVGSVGElement;
    (mockSVG as any).getScreenCTM = () => ({
      a: 1, b: 0, c: 0, d: 1, e: 0, f: 0,
    });
    document.body.appendChild(mockSVG);

    // Mock querySelector to return our SVG
    vi.spyOn(document, 'querySelector').mockImplementation((selector: string) => {
      if (selector === 'svg') return mockSVG;
      return null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    // Clean up SVG elements
    document.querySelectorAll('svg').forEach(el => el.remove());
  });

  function mockPiece(id: string, x: number, y: number, w: number, h: number): Piece {
    return {
      id,
      layerId: 'L1',
      materialId: 'M1',
      position: { x, y },
      rotationDeg: 0,
      scale: { x: 1, y: 1 },
      kind: 'rect',
      size: { w, h },
    };
  }

  function mockStore(pieces: Record<string, Piece>, selectedIds: string[]) {
    useSceneStore.setState({
      scene: {
        id: 'test',
        createdAt: new Date().toISOString(),
        size: { w: 600, h: 600 },
        materials: {},
        layers: {},
        pieces,
        layerOrder: [],
        revision: 1,
      },
      ui: {
        selectedIds,
      },
    } as any);
  }

  describe('Cas gap > 10mm → rien affiché', () => {
    it('gap = 10.1mm → tooltip non rendue', () => {
      const gapMm = 10.1; // gap de 10.1mm
      mockStore(
        {
          p1: mockPiece('p1', 100, 10, 50, 50), // x: 100..150
          p2: mockPiece('p2', 150 + gapMm, 10, 50, 50), // gap = 10.1mm
        },
        ['p1']
      );

      render(<MicroGapTooltip />);

      // Tooltip ne doit pas être visible
      expect(screen.queryByText(/mm/)).not.toBeInTheDocument();
      expect(screen.queryByText('Bord à bord')).not.toBeInTheDocument();
    });

    it('gap = 15mm → tooltip non rendue', () => {
      const gapMm = 15; // gap de 15mm
      mockStore(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 150 + gapMm, 10, 50, 50),
        },
        ['p1']
      );

      render(<MicroGapTooltip />);

      expect(screen.queryByText(/mm/)).not.toBeInTheDocument();
    });
  });

  describe('Cas gap ≤ 10mm → affichage "X,YY mm" (mode sticky)', () => {
    it('gap = 10.00mm → affiche "10.00 mm" et reste visible', () => {
      const gapMm = 10.0; // gap de 10.0mm (seuil max inclus)
      mockStore(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 150 + gapMm, 10, 50, 50),
        },
        ['p1']
      );

      render(<MicroGapTooltip />);

      // Tooltip doit être visible avec le bon label (rAF mocké = synchrone)
      expect(screen.getByText('10.00 mm')).toBeInTheDocument();

      // En mode sticky, avancer le temps ne doit pas masquer le tooltip
      vi.advanceTimersByTime(1000);
      expect(screen.getByText('10.00 mm')).toBeInTheDocument();
    });

    it('gap = 3.00mm → affiche "3.00 mm" et reste visible', () => {
      const gapMm = 3.0; // gap de 3.0mm
      mockStore(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 150 + gapMm, 10, 50, 50),
        },
        ['p1']
      );

      render(<MicroGapTooltip />);

      // Tooltip doit être visible avec le bon label
      expect(screen.getByText('3.00 mm')).toBeInTheDocument();

      // En mode sticky, reste visible même après 400ms
      vi.advanceTimersByTime(400);
      expect(screen.getByText('3.00 mm')).toBeInTheDocument();
    });

    it('gap = 5.50mm → affiche "5.50 mm"', () => {
      const gapMm = 5.5; // gap de 5.5mm
      mockStore(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 150 + gapMm, 10, 50, 50),
        },
        ['p1']
      );

      render(<MicroGapTooltip />);

      expect(screen.getByText('5.50 mm')).toBeInTheDocument();
    });

    it('gap = 1.01mm → affiche "1.00 mm" (normalisé)', () => {
      const gapMm = 1.01; // gap de 1.01mm → normalisation à 1.00 mm
      mockStore(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 150 + gapMm, 10, 50, 50),
        },
        ['p1']
      );

      render(<MicroGapTooltip />);

      // Gap dans [1.00, 1.12] → affichage normalisé "1.00 mm"
      expect(screen.getByText('1.00 mm')).toBeInTheDocument();
    });
  });

  describe('Cas gap < 1.0mm → affichage "Bord à bord"', () => {
    it('gap = 0.90mm → affiche "Bord à bord" et reste visible', () => {
      const gapMm = 0.9; // gap de 0.9mm
      mockStore(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 150 + gapMm, 10, 50, 50),
        },
        ['p1']
      );

      render(<MicroGapTooltip />);

      // Gap < 1.0mm → "Bord à bord"
      expect(screen.getByText('Bord à bord')).toBeInTheDocument();

      // En mode sticky, reste visible
      vi.advanceTimersByTime(400);
      expect(screen.getByText('Bord à bord')).toBeInTheDocument();
    });

    it('gap = 0.00mm (collage parfait) → affiche "Bord à bord"', () => {
      const gapMm = 0.0; // collage parfait
      mockStore(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 150 + gapMm, 10, 50, 50), // x: 150 (bord à bord)
        },
        ['p1']
      );

      render(<MicroGapTooltip />);

      expect(screen.getByText('Bord à bord')).toBeInTheDocument();
    });

    it('gap = 0.50mm → affiche "Bord à bord"', () => {
      const gapMm = 0.5; // gap de 0.5mm
      mockStore(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 150 + gapMm, 10, 50, 50),
        },
        ['p1']
      );

      render(<MicroGapTooltip />);

      expect(screen.getByText('Bord à bord')).toBeInTheDocument();
    });
  });

  describe('Comportement sticky - persistance', () => {
    it('reste visible tant que sélection active + gap ≤ 10mm', () => {
      const gapMm = 5.0; // gap de 5.0mm
      mockStore(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 150 + gapMm, 10, 50, 50),
        },
        ['p1']
      );

      const { rerender } = render(<MicroGapTooltip />);

      // Tooltip visible initialement
      expect(screen.getByText('5.00 mm')).toBeInTheDocument();

      // Avancer le temps → tooltip reste visible
      vi.advanceTimersByTime(1000);
      rerender(<MicroGapTooltip />);
      expect(screen.getByText('5.00 mm')).toBeInTheDocument();
    });

    it('disparaît quand gap > 10mm', () => {
      const gapMm = 5.0; // gap de 5.0mm
      mockStore(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 150 + gapMm, 10, 50, 50),
        },
        ['p1']
      );

      const { rerender } = render(<MicroGapTooltip />);

      // Tooltip visible initialement
      expect(screen.getByText('5.00 mm')).toBeInTheDocument();

      // Changer le gap à > 10mm
      mockStore(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 150 + 11, 10, 50, 50), // gap = 11mm
        },
        ['p1']
      );
      rerender(<MicroGapTooltip />);

      // Tooltip doit disparaître
      expect(screen.queryByText(/mm/)).not.toBeInTheDocument();
    });

    it('reste visible pour un groupe sélectionné', () => {
      // Groupe g1+g2 : g1 (100..130), g2 (135..165) → bbox groupe (100..165)
      // Neighbor à 172 → gap = 172 - 165 = 7mm
      mockStore(
        {
          g1: mockPiece('g1', 100, 10, 30, 50),
          g2: mockPiece('g2', 135, 10, 30, 50),
          neighbor: mockPiece('neighbor', 172, 10, 50, 50),
        },
        ['g1', 'g2'] // Groupe sélectionné
      );

      render(<MicroGapTooltip />);

      // Tooltip doit être visible avec le gap du groupe (rAF mocké = synchrone)
      expect(screen.getByText('7.00 mm')).toBeInTheDocument();

      // En mode sticky, reste visible
      vi.advanceTimersByTime(1000);
      expect(screen.getByText('7.00 mm')).toBeInTheDocument();
    });
  });

  describe('Cas limites', () => {
    it('aucune sélection → rien affiché', () => {
      mockStore(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 155, 10, 50, 50),
        },
        []
      );

      render(<MicroGapTooltip />);

      expect(screen.queryByText(/mm/)).not.toBeInTheDocument();
      expect(screen.queryByText('Bord à bord')).not.toBeInTheDocument();
    });

    it('ne mesure pas contre son propre ghost pendant resize', () => {
      // Scène avec une seule pièce sélectionnée, pas de voisins
      mockStore(
        {
          p1: mockPiece('p1', 10, 10, 100, 40),
        },
        ['p1']
      );

      // Simuler un resize en cours avec transientBBox
      useSceneStore.setState((state: any) => ({
        ...state,
        scene: {
          ...state.scene,
          revision: (state.scene.revision ?? 0) + 1,
        },
        ui: {
          ...state.ui,
          isTransientActive: true,
          transientBBox: { x: 10, y: 10, w: 100, h: 40 },
          resizing: { handle: 's', originalBBox: { x: 10, y: 10, w: 100, h: 40 } },
        },
      }));

      const { queryByText } = render(<MicroGapTooltip />);

      // Pas de voisin externe → pas de tooltip
      expect(queryByText(/mm$/)).not.toBeInTheDocument();
      expect(queryByText('Bord à bord')).not.toBeInTheDocument();
    });

    it('aucun voisin → rien affiché', () => {
      mockStore(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
        },
        ['p1']
      );

      render(<MicroGapTooltip />);

      expect(screen.queryByText(/mm/)).not.toBeInTheDocument();
      expect(screen.queryByText('Bord à bord')).not.toBeInTheDocument();
    });
  });

  describe('Positionnement', () => {
    it('tooltip positionnée au centre de la sélection + offset', () => {
      const gapMm = 3.0; // gap de 3.0mm
      mockStore(
        {
          p1: mockPiece('p1', 100, 10, 50, 50), // centre: (125, 35)
          p2: mockPiece('p2', 150 + gapMm, 10, 50, 50),
        },
        ['p1']
      );

      const { container } = render(<MicroGapTooltip />);

      const tooltip = container.querySelector('.micro-gap-tooltip');
      expect(tooltip).toBeInTheDocument();

      // Vérifier que le style contient les coordonnées fixed (edge anchor)
      // p1 à (100,10,50,50), gap right, anchor = (150, 35)
      const style = tooltip?.getAttribute('style');
      expect(style).toContain('position: fixed');
      expect(style).toContain('left: 150'); // right edge of p1
      expect(style).toContain('top: 35');    // vertical center of p1
    });
  });

  describe('Props de style', () => {
    it('tooltip a pointer-events: none', () => {
      const gapMm = 3.0; // gap de 3.0mm
      mockStore(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 150 + gapMm, 10, 50, 50),
        },
        ['p1']
      );

      const { container } = render(<MicroGapTooltip />);

      const tooltip = container.querySelector('.micro-gap-tooltip');
      const style = tooltip?.getAttribute('style');
      expect(style).toContain('pointer-events: none');
    });

    it('tooltip a aria-hidden', () => {
      const gapMm = 3.0; // gap de 3.0mm
      mockStore(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 150 + gapMm, 10, 50, 50),
        },
        ['p1']
      );

      const { container } = render(<MicroGapTooltip />);

      const tooltip = container.querySelector('.micro-gap-tooltip');
      expect(tooltip?.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
