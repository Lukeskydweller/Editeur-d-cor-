import { describe, it, expect } from 'vitest';
import { selectNearestGap, type SceneStateForGap } from '@/store/selectors/gapSelector';
import type { Piece } from '@/types/scene';
import { MM_TO_PX } from '@/constants/validation';

describe('selectNearestGap - sélecteur de gap minimal', () => {
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

  function mockState(pieces: Record<string, Piece>, selectedIds: string[]): SceneStateForGap {
    return {
      scene: {
        id: 'test',
        createdAt: new Date().toISOString(),
        size: { w: 600, h: 600 },
        materials: {},
        layers: {},
        pieces,
        layerOrder: [],
      },
      ui: {
        selectedIds,
      },
    };
  }

  describe('Cas solo - pièce unique sélectionnée', () => {
    it('gap = 0 mm (collage parfait bord-à-bord)', () => {
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 10, 50, 50), // x: 100..150
          p2: mockPiece('p2', 150, 10, 50, 50), // x: 150..200 (collé à p1)
        },
        ['p1']
      );

      const result = selectNearestGap(state);

      expect(result.gapMm).toBeCloseTo(0, 2);
      expect(result.nearestId).toBe('p2');
      expect(result.side).toBe('right');
      expect(result.subjectCenter.x).toBeCloseTo(125, 1); // 100 + 50/2
      expect(result.subjectCenter.y).toBeCloseTo(35, 1);  // 10 + 50/2
    });

    it('gap ≈ 0.99 mm (< 1.0mm, dans fenêtre collage)', () => {
      const gapMm = 0.99; // gap de 0.99mm
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 10, 50, 50), // x: 100..150
          p2: mockPiece('p2', 150 + gapMm, 10, 50, 50), // gap = 0.99mm
        },
        ['p1']
      );

      const result = selectNearestGap(state);

      expect(result.gapMm).toBeCloseTo(0.99, 1);
      expect(result.nearestId).toBe('p2');
      expect(result.side).toBe('right');
    });

    it('gap ≈ 1.01 mm (> 1.0mm, hors fenêtre)', () => {
      const gapMm = 1.01; // gap de 1.01mm
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 150 + gapMm, 10, 50, 50), // gap = 1.01mm
        },
        ['p1']
      );

      const result = selectNearestGap(state);

      expect(result.gapMm).toBeCloseTo(1.01, 1);
      expect(result.nearestId).toBe('p2');
    });

    it('gap ≈ 3 mm', () => {
      const gapMm = 3.0; // gap de 3mm
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 150 + gapMm, 10, 50, 50), // gap = 3mm
        },
        ['p1']
      );

      const result = selectNearestGap(state);

      expect(result.gapMm).toBeCloseTo(3.0, 1);
      expect(result.nearestId).toBe('p2');
    });

    it('gap ≈ 6.1 mm (au-delà du seuil tooltip)', () => {
      const gapMm = 6.1; // gap de 6.1mm
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 150 + gapMm, 10, 50, 50), // gap = 6.1mm
        },
        ['p1']
      );

      const result = selectNearestGap(state);

      expect(result.gapMm).toBeCloseTo(6.1, 1);
      expect(result.nearestId).toBe('p2');
    });

    it('retourne nearestId correct parmi plusieurs voisins', () => {
      const state = mockState(
        {
          subject: mockPiece('subject', 100, 100, 50, 50), // x: 100..150, y: 100..150
          far: mockPiece('far', 200, 100, 50, 50),         // gap horizontal = 50mm
          near: mockPiece('near', 155, 100, 50, 50),       // gap horizontal = 5mm (plus proche)
        },
        ['subject']
      );

      const result = selectNearestGap(state);

      expect(result.nearestId).toBe('near');
      expect(result.gapMm).toBeCloseTo(5, 1); // gap = 5mm (155-150)
    });
  });

  describe('Détermination du side (côté)', () => {
    it('side = right (voisin à droite)', () => {
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 155, 10, 50, 50), // à droite
        },
        ['p1']
      );

      const result = selectNearestGap(state);
      expect(result.side).toBe('right');
    });

    it('side = left (voisin à gauche)', () => {
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 45, 10, 50, 50), // à gauche (right=95, gap=5px)
        },
        ['p1']
      );

      const result = selectNearestGap(state);
      expect(result.side).toBe('left');
    });

    it('side = bottom (voisin en bas)', () => {
      const state = mockState(
        {
          p1: mockPiece('p1', 10, 100, 50, 50),
          p2: mockPiece('p2', 10, 155, 50, 50), // en bas
        },
        ['p1']
      );

      const result = selectNearestGap(state);
      expect(result.side).toBe('bottom');
    });

    it('side = top (voisin en haut)', () => {
      const state = mockState(
        {
          p1: mockPiece('p1', 10, 100, 50, 50),
          p2: mockPiece('p2', 10, 45, 50, 50), // en haut (bottom=95, gap=5px)
        },
        ['p1']
      );

      const result = selectNearestGap(state);
      expect(result.side).toBe('top');
    });
  });

  describe('Cas groupe - plusieurs pièces sélectionnées', () => {
    it('bbox groupe vs voisin externe', () => {
      const state = mockState(
        {
          g1: mockPiece('g1', 100, 10, 30, 50),  // x: 100..130
          g2: mockPiece('g2', 135, 10, 30, 50),  // x: 135..165 (bbox groupe: 100..165)
          neighbor: mockPiece('neighbor', 170, 10, 50, 50), // x: 170..220, gap = 5mm
        },
        ['g1', 'g2']
      );

      const result = selectNearestGap(state);

      expect(result.nearestId).toBe('neighbor');
      expect(result.gapMm).toBeCloseTo(5, 1); // gap = 5mm (170-165)
      expect(result.side).toBe('right');
      expect(result.subjectCenter.x).toBeCloseTo(132.5, 1); // (100+165)/2
    });

    it('exclusion interne : membres du groupe ignorés', () => {
      const state = mockState(
        {
          g1: mockPiece('g1', 100, 10, 30, 50),  // x: 100..130
          g2: mockPiece('g2', 135, 10, 30, 50),  // x: 135..165 (gap interne = 5px, ignoré)
          external: mockPiece('external', 175, 10, 50, 50), // gap externe = 10px
        },
        ['g1', 'g2']
      );

      const result = selectNearestGap(state);

      // Doit ignorer le gap interne entre g1 et g2, ne considérer que external
      expect(result.nearestId).toBe('external');
      expect(result.gapMm).toBeCloseTo(10, 1); // gap = 10mm (175-165)
    });

    it('groupe avec 3+ pièces', () => {
      const state = mockState(
        {
          g1: mockPiece('g1', 100, 10, 20, 50),
          g2: mockPiece('g2', 125, 10, 20, 50),
          g3: mockPiece('g3', 150, 10, 20, 50), // bbox groupe: 100..170
          neighbor: mockPiece('neighbor', 173, 10, 50, 50), // gap = 3mm
        },
        ['g1', 'g2', 'g3']
      );

      const result = selectNearestGap(state);

      expect(result.nearestId).toBe('neighbor');
      expect(result.gapMm).toBeCloseTo(3, 1); // gap = 3mm (173-170)
    });
  });

  describe('Alignement - recouvrement perpendiculaire requis', () => {
    it('voisin diagonal non aligné → gapMm=null (pas de recouvrement)', () => {
      // p1: (100,10) 50x50 → bbox (100..150, 10..60)
      // p2: (160,70) 50x50 → bbox (160..210, 70..120) - en diagonal, aucun recouvrement
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 160, 70, 50, 50), // diagonal, pas aligné
        },
        ['p1']
      );

      const result = selectNearestGap(state);

      // Pas de recouvrement vertical ni horizontal → aucun gap mesuré
      expect(result.gapMm).toBe(null);
      expect(result.side).toBe(null);
    });

    it('voisin à droite avec recouvrement vertical → gap mesuré', () => {
      // p1: (100,10) 50x50 → bbox (100..150, 10..60)
      // p2: (155,20) 50x50 → bbox (155..205, 20..70) - recouvrement vertical (20..60)
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 155, 20, 50, 50), // à droite avec overlap vertical
        },
        ['p1']
      );

      const result = selectNearestGap(state);

      expect(result.gapMm).toBeCloseTo(5.0, 2);
      expect(result.side).toBe('right');
    });

    it('voisin en bas avec recouvrement horizontal → gap mesuré', () => {
      // p1: (100,10) 50x50 → bbox (100..150, 10..60)
      // p2: (110,65) 50x50 → bbox (110..160, 65..115) - recouvrement horizontal (110..150)
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
          p2: mockPiece('p2', 110, 65, 50, 50), // en bas avec overlap horizontal
        },
        ['p1']
      );

      const result = selectNearestGap(state);

      expect(result.gapMm).toBeCloseTo(5.0, 2);
      expect(result.side).toBe('bottom');
    });
  });

  describe('Cas limites', () => {
    it('aucune sélection → gapMm=null', () => {
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
        },
        []
      );

      const result = selectNearestGap(state);

      expect(result.gapMm).toBe(null);
      expect(result.nearestId).toBe(null);
      expect(result.side).toBe(null);
    });

    it('aucun voisin → gapMm=null', () => {
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
        },
        ['p1']
      );

      const result = selectNearestGap(state);

      expect(result.gapMm).toBe(null);
      expect(result.nearestId).toBe(null);
      expect(result.side).toBe(null);
    });

    it('pièce sélectionnée inexistante → gapMm=null', () => {
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 10, 50, 50),
        },
        ['nonexistent']
      );

      const result = selectNearestGap(state);

      expect(result.gapMm).toBe(null);
      expect(result.nearestId).toBe(null);
    });

    it('overlap (gap négatif) → retourne 0', () => {
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 10, 50, 50), // x: 100..150
          p2: mockPiece('p2', 140, 10, 50, 50), // x: 140..190 (overlap de 10px)
        },
        ['p1']
      );

      const result = selectNearestGap(state);

      // Overlap détecté, gap = 0
      expect(result.gapMm).toBeCloseTo(0, 2);
      expect(result.nearestId).toBe('p2');
      expect(result.side).toBe(null); // pas de côté définitif en cas d'overlap
    });
  });

  describe('Rotation-aware (AABB)', () => {
    it('pièce rotée 90° : utilise AABB swap', () => {
      const p1 = mockPiece('p1', 100, 10, 30, 50); // w=30, h=50
      p1.rotationDeg = 90; // AABB devient: w=50, h=30

      const state = mockState(
        {
          p1,
          p2: mockPiece('p2', 155, 10, 50, 50), // à droite de l'AABB
        },
        ['p1']
      );

      const result = selectNearestGap(state);

      // AABB de p1 après rotation: x ≈ 110, w=50 → right = 160
      // Gap avec p2.left (155) = négatif (overlap) → calcul corrigé via AABB
      expect(result.nearestId).toBe('p2');
      expect(result.gapMm).toBeGreaterThanOrEqual(0); // pas d'overlap logique
    });
  });

  describe('subjectOverride - bbox candidate (temps réel)', () => {
    it('utilise subjectOverride au lieu de la bbox commise', () => {
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 100, 50, 50), // x: 100..150 (état commité)
          p2: mockPiece('p2', 160, 100, 50, 50), // x: 160..210, gap = 10mm avec commité
        },
        ['p1']
      );

      // Simuler drag: p1 se déplace vers la droite (position candidate)
      const candidateBBox = { x: 110, y: 100, w: 50, h: 50 }; // x: 110..160

      const result = selectNearestGap(state, { subjectOverride: candidateBBox });

      // Gap avec p2 depuis position candidate: 160 - 160 = 0mm
      expect(result.gapMm).toBeCloseTo(0, 2);
      expect(result.nearestId).toBe('p2');
      expect(result.side).toBe('right');
      expect(result.subjectCenter.x).toBeCloseTo(135, 1); // 110 + 50/2
    });

    it('subjectOverride avec gap < 1mm (collage imminent)', () => {
      const gapMm = 0.8; // gap de 0.8mm
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 100, 50, 50), // état commité
          p2: mockPiece('p2', 160, 100, 50, 50),
        },
        ['p1']
      );

      // Position candidate : gap = 0.8mm avec p2
      const candidateBBox = { x: 160 - 50 - gapMm, y: 100, w: 50, h: 50 };

      const result = selectNearestGap(state, { subjectOverride: candidateBBox });

      expect(result.gapMm).toBeCloseTo(0.8, 1);
      expect(result.nearestId).toBe('p2');
    });

    it('subjectOverride groupe (bbox union candidate)', () => {
      const state = mockState(
        {
          g1: mockPiece('g1', 100, 100, 30, 50),  // état commité
          g2: mockPiece('g2', 135, 100, 30, 50),
          neighbor: mockPiece('neighbor', 175, 100, 50, 50),
        },
        ['g1', 'g2']
      );

      // Groupe se déplace vers la droite: bbox union candidate
      // Original bbox: x: 100..165 (w=65)
      // Candidate bbox: x: 110..175 (w=65, déplacé de 10px à droite)
      const candidateGroupBBox = { x: 110, y: 100, w: 65, h: 50 };

      const result = selectNearestGap(state, { subjectOverride: candidateGroupBBox });

      // Gap avec neighbor: 175 - 175 = 0px (collage)
      expect(result.gapMm).toBeCloseTo(0, 2);
      expect(result.nearestId).toBe('neighbor');
      expect(result.side).toBe('right');
    });

    it('excludeIds - exclure voisins supplémentaires', () => {
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 100, 50, 50), // x: 100..150
          blocker: mockPiece('blocker', 155, 100, 50, 50), // gap = 5mm (plus proche)
          far: mockPiece('far', 220, 100, 50, 50), // gap = 70mm
        },
        ['p1']
      );

      // Exclure blocker: devrait retourner far
      const result = selectNearestGap(state, { excludeIds: ['blocker'] });

      expect(result.nearestId).toBe('far');
      expect(result.gapMm).toBeCloseTo(70, 1); // gap = 70mm (220-150)
    });

    it('subjectOverride + excludeIds combinés', () => {
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 100, 50, 50),
          near1: mockPiece('near1', 155, 100, 50, 50), // gap = 5mm
          near2: mockPiece('near2', 160, 100, 50, 50), // gap = 10mm
        },
        ['p1']
      );

      // Override + exclure near1 → devrait retourner near2
      const candidateBBox = { x: 100, y: 100, w: 50, h: 50 };
      const result = selectNearestGap(state, {
        subjectOverride: candidateBBox,
        excludeIds: ['near1'],
      });

      expect(result.nearestId).toBe('near2');
      expect(result.gapMm).toBeCloseTo(10, 1); // gap = 10mm (160-150)
    });

    it('subjectOverride sans sélection (cas limite)', () => {
      const state = mockState(
        {
          p1: mockPiece('p1', 100, 100, 50, 50),
          p2: mockPiece('p2', 160, 100, 50, 50),
        },
        [] // aucune sélection
      );

      // Override avec bbox candidate (tooltip pendant drag par exemple)
      const candidateBBox = { x: 110, y: 100, w: 50, h: 50 };
      const result = selectNearestGap(state, { subjectOverride: candidateBBox });

      // Devrait calculer avec la bbox override, exclure rien (pas de sélection)
      expect(result.gapMm).toBeCloseTo(0, 2); // 160 - 160 = 0
      expect(result.nearestId).toBeTruthy();
      expect(result.subjectCenter.x).toBeCloseTo(135, 1);
    });
  });
});
