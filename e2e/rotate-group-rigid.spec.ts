import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════
// ORACLE MATH — Fonctions indépendantes pour vérification (PAS de code prod)
// ═══════════════════════════════════════════════════════════════════════════

/** Calcul AABB à partir des intrinsèques (w, h) et rotation */
function aabbFromIntrinsic(
  pos: { x: number; y: number },
  size: { w: number; h: number },
  deg: number,
): { x: number; y: number; w: number; h: number } {
  const r = ((deg % 360) + 360) % 360;
  const { w, h } = size;

  if (r === 90 || r === 270) {
    // Position = local origin, center = pos + (w/2, h/2)
    const cx = pos.x + w / 2;
    const cy = pos.y + h / 2;
    // AABB swapped: center - (h/2, w/2)
    return { x: cx - h / 2, y: cy - w / 2, w: h, h: w };
  }

  // 0° ou 180°: AABB = position
  return { x: pos.x, y: pos.y, w, h };
}

/** Rotation +90° d'un point autour d'un pivot */
function rot90(
  p: { x: number; y: number },
  pivot: { x: number; y: number },
): { x: number; y: number } {
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;
  return { x: pivot.x - dy, y: pivot.y + dx };
}

/** Centre d'un AABB */
function aabbCenter(aabb: { x: number; y: number; w: number; h: number }): {
  x: number;
  y: number;
} {
  return { x: aabb.x + aabb.w / 2, y: aabb.y + aabb.h / 2 };
}

/** Distance euclidienne entre deux points */
function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST E2E: Rotation rigide de groupe dans navigateur
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Rigid Group Rotation E2E', () => {
  // Skip if PWREADY not set (only run in dedicated E2E environment)
  test.skip(process.env.PWREADY !== '1', 'Disabled unless PWREADY=1');

  test('preserves exact geometry through 4× +90° cycle', async ({ page }) => {
    // ─────────────────────────────────────────────────────────────────────
    // 1. Setup: charger app avec flag E2E
    // ─────────────────────────────────────────────────────────────────────
    await page.goto('/?e2e=1');

    // Attendre que l'API E2E soit disponible
    await page.waitForFunction(() => typeof (window as any).__e2e !== 'undefined');

    // ─────────────────────────────────────────────────────────────────────
    // 2. Seed: pattern réaliste avec 5 rectangles mixtes 0°/90°, bord-à-bord
    // ─────────────────────────────────────────────────────────────────────
    // Pattern en croix:
    //   p1: 60×30 à 0° (horizontal) — gauche
    //   p2: 30×60 à 90° (vertical) — centre-haut
    //   p3: 60×30 à 0° (horizontal) — droite
    //   p4: 30×60 à 90° (vertical) — centre-bas
    //   p5: 40×40 à 0° (carré) — centre
    // Tous bord-à-bord dans une disposition en croix
    await page.evaluate(() => {
      (window as any).__e2e.seedPieces([
        { id: 'p1', x: 100, y: 200, w: 60, h: 30, deg: 0 }, // gauche
        { id: 'p2', x: 175, y: 140, w: 30, h: 60, deg: 90 }, // haut
        { id: 'p3', x: 220, y: 200, w: 60, h: 30, deg: 0 }, // droite
        { id: 'p4', x: 175, y: 230, w: 30, h: 60, deg: 90 }, // bas
        { id: 'p5', x: 180, y: 190, w: 40, h: 40, deg: 0 }, // centre (carré)
      ]);
    });

    // ─────────────────────────────────────────────────────────────────────
    // 3. Capturer état initial avec AABBs calculés
    // ─────────────────────────────────────────────────────────────────────
    const initial = await page.evaluate(() => {
      const snap = (window as any).__e2e.getSceneSnapshot();
      return {
        pieces: snap.scene.pieces,
      };
    });

    // Calculer centres initiaux et pivot avec oracle math
    const initialAABBs: Record<string, any> = {};
    const initialCenters: Record<string, { x: number; y: number }> = {};

    for (const [id, piece] of Object.entries(initial.pieces) as [string, any][]) {
      const aabb = aabbFromIntrinsic(piece.position, piece.size, piece.rotationDeg);
      initialAABBs[id] = aabb;
      initialCenters[id] = aabbCenter(aabb);
    }

    // Pivot = centre de l'AABB union (pas moyenne des centres!)
    const allAABBs = Object.values(initialAABBs);
    const minX = Math.min(...allAABBs.map((b) => b.x));
    const minY = Math.min(...allAABBs.map((b) => b.y));
    const maxX = Math.max(...allAABBs.map((b) => b.x + b.w));
    const maxY = Math.max(...allAABBs.map((b) => b.y + b.h));
    const pivot = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

    // Distances initiales au pivot
    const initialDistToPivot: Record<string, number> = {};
    for (const [id, center] of Object.entries(initialCenters)) {
      initialDistToPivot[id] = dist(center, pivot);
    }

    // Distances inter-pièces initiales
    const ids = Object.keys(initialCenters);
    const initialInterPieceDist: Record<string, number> = {};
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}-${ids[j]}`;
        initialInterPieceDist[key] = dist(initialCenters[ids[i]], initialCenters[ids[j]]);
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 4. Sélectionner toutes les pièces et appliquer rotation +90° (1ère)
    // ─────────────────────────────────────────────────────────────────────
    await page.evaluate(() => {
      (window as any).__e2e.selectAll();
      (window as any).__e2e.rotateDelta(90);
    });

    // Capturer état après 1ère rotation
    const after1st = await page.evaluate(() => {
      const snap = (window as any).__e2e.getSceneSnapshot();
      return {
        pieces: snap.scene.pieces,
      };
    });

    // ─────────────────────────────────────────────────────────────────────
    // 5. Vérifier rigidité après 1ère rotation avec oracle math
    // ─────────────────────────────────────────────────────────────────────

    // Calculer centres attendus après +90° avec oracle
    const expectedCenters: Record<string, { x: number; y: number }> = {};
    for (const id of ids) {
      expectedCenters[id] = rot90(initialCenters[id], pivot);
    }

    // Calculer centres réels après 1ère rotation
    const actualCenters: Record<string, { x: number; y: number }> = {};
    for (const [id, piece] of Object.entries(after1st.pieces) as [string, any][]) {
      const aabb = aabbFromIntrinsic(piece.position, piece.size, piece.rotationDeg);
      actualCenters[id] = aabbCenter(aabb);
    }

    // Vérifier que centres réels correspondent à oracle (tolérance 0.1mm)
    for (const id of ids) {
      const expected = expectedCenters[id];
      const actual = actualCenters[id];
      const error = dist(expected, actual);

      expect(error).toBeLessThan(0.1); // max 0.1mm deviation
    }

    // Vérifier conservation des distances au pivot
    for (const id of ids) {
      const newDist = dist(actualCenters[id], pivot);
      const initialDist = initialDistToPivot[id];
      expect(Math.abs(newDist - initialDist)).toBeLessThan(0.1);
    }

    // Vérifier conservation des distances inter-pièces
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}-${ids[j]}`;
        const newDist = dist(actualCenters[ids[i]], actualCenters[ids[j]]);
        const initialDist = initialInterPieceDist[key];
        expect(Math.abs(newDist - initialDist)).toBeLessThan(0.1);
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 6. Appliquer 3× rotations supplémentaires pour cycle complet (4× total)
    // ─────────────────────────────────────────────────────────────────────
    await page.evaluate(() => {
      (window as any).__e2e.rotateDelta(90); // 2ème rotation
      (window as any).__e2e.rotateDelta(90); // 3ème rotation
      (window as any).__e2e.rotateDelta(90); // 4ème rotation (cycle complet)
    });

    // Capturer état après cycle complet
    const afterCycle = await page.evaluate(() => {
      const snap = (window as any).__e2e.getSceneSnapshot();
      return {
        pieces: snap.scene.pieces,
      };
    });

    // ─────────────────────────────────────────────────────────────────────
    // 7. Vérifier retour exact à l'état initial après 4× +90°
    // ─────────────────────────────────────────────────────────────────────
    for (const [id, initialPiece] of Object.entries(initial.pieces) as [string, any][]) {
      const finalPiece = (afterCycle.pieces as any)[id];

      // Vérifier rotation (doit être identique modulo 360)
      const initialRot = ((initialPiece.rotationDeg % 360) + 360) % 360;
      const finalRot = ((finalPiece.rotationDeg % 360) + 360) % 360;
      expect(finalRot).toBe(initialRot);

      // Vérifier position (tolérance 0.1mm pour erreurs d'arrondi)
      expect(Math.abs(finalPiece.position.x - initialPiece.position.x)).toBeLessThan(0.1);
      expect(Math.abs(finalPiece.position.y - initialPiece.position.y)).toBeLessThan(0.1);

      // Vérifier que size est strictement inchangé (pas de tolérance)
      expect(finalPiece.size.w).toBe(initialPiece.size.w);
      expect(finalPiece.size.h).toBe(initialPiece.size.h);
    }
  });

  test('rotation blocked when would cause overlap with external piece', async ({ page }) => {
    // ─────────────────────────────────────────────────────────────────────
    // Test validation overlap: rotation bloquée si collision avec pièce externe
    // ─────────────────────────────────────────────────────────────────────
    await page.goto('/?e2e=1');
    await page.waitForFunction(() => typeof (window as any).__e2e !== 'undefined');

    // Seed: 3 rectangles — p1+p2 forment groupe, p3 bloque rotation
    await page.evaluate(() => {
      (window as any).__e2e.seedPieces([
        { id: 'p1', x: 100, y: 100, w: 30, h: 60, deg: 0 },
        { id: 'p2', x: 140, y: 100, w: 30, h: 60, deg: 0 },
        { id: 'p3', x: 130, y: 155, w: 40, h: 80, deg: 0 }, // bloque rotation du groupe
      ]);
    });

    // Sélectionner p1+p2 (pas p3)
    const beforeRotation = await page.evaluate(() => {
      (window as any).__e2e.select(['p1', 'p2']);
      const snap = (window as any).__e2e.getSceneSnapshot();

      return {
        p1Rot: snap.scene.pieces.p1.rotationDeg,
        p2Rot: snap.scene.pieces.p2.rotationDeg,
        flashBefore: snap.ui.flashInvalidAt,
      };
    });

    // Tenter rotation +90° (doit être bloquée)
    await page.evaluate(() => {
      (window as any).__e2e.rotateDelta(90);
    });

    const afterRotation = await page.evaluate(() => {
      const snap = (window as any).__e2e.getSceneSnapshot();
      return {
        p1Rot: snap.scene.pieces.p1.rotationDeg,
        p2Rot: snap.scene.pieces.p2.rotationDeg,
        flashAfter: snap.ui.flashInvalidAt,
      };
    });

    // Vérifier que rotation n'a PAS été appliquée
    expect(afterRotation.p1Rot).toBe(beforeRotation.p1Rot);
    expect(afterRotation.p2Rot).toBe(beforeRotation.p2Rot);

    // Vérifier que flashInvalidAt a été déclenché
    expect(afterRotation.flashAfter).toBeGreaterThan(beforeRotation.flashBefore ?? 0);
  });
});
