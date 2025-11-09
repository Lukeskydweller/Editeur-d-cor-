# S22-4j: E2E Tests & RBush Spatial Index

**Status**: ✅ Completed
**Date**: 2025-11-09
**Session**: S22-4j

## Overview

This session adds:

1. **E2E Test Infrastructure**: Playwright tests with programmatic scene control via `window.__TEST__` API
2. **RBush Spatial Index**: Per-layer R-tree indexes for fast collision/snap queries (feature-flagged)

## E2E Test Infrastructure

### Driver API (`window.__TEST__`)

Exposed when `VITE_E2E=1` flag is set during build. Provides programmatic scene manipulation for E2E tests.

**Location**: [src/testdriver.ts](../src/testdriver.ts)

**Available Methods**:

```typescript
window.__TEST__ = {
  // Scene management
  reset(): void                               // Reset scene to empty state
  initSceneWithDefaults(w, h): void          // Initialize 3-layer scene
  getFixedLayerIds(): { C1, C2, C3 }         // Get layer IDs

  // Piece creation
  newRect(layerId, x, y, w, h): ID           // Create rectangular piece

  // Selection
  select(id): void                            // Select piece exclusively

  // Manipulation
  dragBy(id, dx, dy): void                    // Simulate drag operation
  resizeBy(id, handle, dx, dy): void          // Simulate resize operation
  setActiveLayer(layerId): void               // Set active layer

  // Inspection
  ghostState(id): {                           // Get ghost state
    exact: boolean,
    dataGhost: '0' | '1',
    severity: 'none' | 'warn' | 'block'
  }
  getPieceRect(id): { x, y, w, h }           // Get piece bounds
}
```

### Running E2E Tests

```bash
# Run all E2E tests (Chromium only)
pnpm e2e

# Run with browser UI visible
pnpm e2e:headed

# Run all tests (Chromium, Firefox, WebKit)
pnpm e2e:run

# Interactive test explorer
pnpm e2e:open

# Manual preview for E2E (port 5176)
VITE_E2E=1 pnpm build && pnpm preview --host --port 5176
```

### Test Files

#### A1: Cross-layer blocking non-regression

**File**: [tests/e2e/c2-nonblocking-ghost.spec.ts](../tests/e2e/c2-nonblocking-ghost.spec.ts)

**Scenario**: A C2 piece in ghost (WARN) state should NOT block moving another C2 piece on the same layer.

**Validates**:

- Ghost state only affects the piece itself
- Same-layer pieces remain independently movable
- Ghost severity correctly set to `warn` (not `block`)

#### A2: Immediate ghost after resize

**File**: [tests/e2e/c2-resize-ghost-immediate.spec.ts](../tests/e2e/c2-resize-ghost-immediate.spec.ts)

**Scenario**: After resizing a C2 piece to become unsupported, ghost state appears immediately without requiring an additional move.

**Validates**:

- `recalculateExactSupport()` is called at resize commit
- Ghost state updates within 800ms
- No manual drag required to trigger validation

### Configuration

**Playwright Config**: [playwright.config.ts](../playwright.config.ts)

```typescript
webServer: {
  command: 'VITE_E2E=1 pnpm build && pnpm preview --host --port 5176',
  url: 'http://localhost:5176',
  reuseExistingServer: !process.env.CI,
}
```

**Key Points**:

- Tests use data attributes (`data-piece-id`, `data-ghost`, `data-ghost-severity`)
- No fragile color-based selectors
- Robust against UI refactoring
- Port 5176 avoids conflicts with dev server (5173) and other preview (5175)

## RBush Spatial Index

### Purpose

Optimize collision/snap queries for large scenes by organizing pieces into per-layer R-tree indexes.

**Performance Goal**:

- Reduce O(n) linear scans to O(log n) spatial queries
- Enable sub-50ms collision checks for 200+ pieces

### Design

**Location**: [src/spatial/rbushIndex.ts](../src/spatial/rbushIndex.ts)

**Architecture**:

```
LayeredRBush
├── trees: Map<LayerId, RBush<SpatialItem>>
├── insert(layerId, item)
├── load(layerId, items[])          // Bulk load (faster)
├── search(layerId, bbox) → items[] // Same-layer query
└── stats() → { layerId, count }[]
```

**Key Principle**: Maintain separate R-tree per layer to optimize same-layer collision checks (C2-C2, C3-C3).

### Feature Flag

**Default**: Disabled (uses existing global index fallback)

**Activation**:

1. **Manual** (dev): `window.__SPATIAL__ = 'rbush'`
2. **Auto**: Enable when `pieceCount >= 120` (with hysteresis at 100)

**Flag Check**:

```typescript
// In collision/snap functions:
const engine = ui.spatialEngine ?? 'global';
if (engine === 'rbush') {
  // Use layeredRBush.search(layerId, aabb)
} else {
  // Fallback to existing globalIndex
}
```

### Integration Points

RBush index should be used in:

1. `snapToPieces()` - Shortlist neighbors for snap-to-edge
2. `collisionsForPiece()` - Same-layer collision detection
3. `validateNoOverlapSameLayer()` - Validation checks

**Important**: Keep same logical flow:

- AABB query → Shortlist candidates → SAT exact test
- Results must match global index behavior (non-breaking change)

### Metrics

**Dev Panel** (`DevMetrics` component):

```
Shortlist Sources:
- GLOBAL: 456 queries
- RBUSH:  123 queries  ← Appears when flag active
- FALLBACK: 12 queries

Spatial Index:
- C1: 42 pieces
- C2: 67 pieces
- C3: 15 pieces
Total: 124 pieces indexed
```

**Console** (when `__DBG_DRAG__` enabled):

```
[SNAP] source=RBUSH layerId=C2 shortlist=3 (from 124 total)
```

### Unit Tests

**File**: [tests/unit/spatial.rbush.spec.ts](../tests/unit/spatial.rbush.spec.ts)

**Coverage**:

- ✅ Separate trees per layer
- ✅ Same-layer search isolation
- ✅ Bulk load performance
- ✅ Empty layer queries
- ✅ Intersection correctness
- ✅ Clear/reset operations

### Limitations

**Current Status**: Foundation implemented, full integration pending.

**Next Steps** (future session):

1. Wire `LayeredRBush` into `useSceneStore` lifecycle
2. Add rebuild hooks on piece create/move/delete
3. Implement shortlist switching in collision functions
4. Add instrumentation for metrics panel
5. Performance benchmarks (100-500 pieces)

### Tree-Shaking

The `window.__TEST__` API is dev-only and tree-shaken in production builds:

```typescript
// In App.tsx
if (import.meta.env.VITE_E2E === '1') {
  import('./testdriver').then((m) => m.installTestDriver(useSceneStore));
}
```

Production builds have `VITE_E2E` undefined → dead code elimination.

## Commands Reference

```bash
# E2E
pnpm e2e                          # Run E2E tests (Chromium)
pnpm e2e:headed                   # Run with visible browser
pnpm e2e:run                      # All browsers
pnpm e2e:open                     # Interactive UI

# Unit tests
pnpm test --run                   # All unit tests
pnpm test tests/unit/spatial.rbush.spec.ts  # RBush only

# Validation
pnpm typecheck                    # Type checking
pnpm build                        # Production build
VITE_E2E=1 pnpm build            # E2E build

# Preview
pnpm preview                      # Standard preview (port 5173)
VITE_E2E=1 pnpm build && pnpm preview --host --port 5176  # E2E preview
```

## Results

### E2E Tests

- ✅ 2/2 tests passing (Chromium)
- ⏱️ <10s local execution
- 🎯 0 fragile selectors (data-attributes only)

### Unit Tests

- ✅ 8/8 RBush tests passing
- ✅ 690 total tests passing (0 regressions)
- ✅ Typecheck OK

### Performance

- Current: Global index (O(n) fallback)
- RBush: Foundation ready, integration pending
- Target: <50ms collision checks @ 200+ pieces

## Commits

```
feat(e2e): add test driver with window.__TEST__ API
feat(e2e): add Playwright config and npm scripts
test(e2e): add cross-layer blocking non-regression test
test(e2e): add immediate ghost after resize test
feat(spatial): add LayeredRBush per-layer index
test(spatial): add RBush unit tests
docs: add S22-4j E2E and RBush documentation
```

## References

- [S22-4g: Ghost State Fixes](./S22-4g-FIXES-EN-COURS.md) - Previous session
- [Playwright Documentation](https://playwright.dev/)
- [RBush GitHub](https://github.com/mourner/rbush)
- [src/testdriver.ts](../src/testdriver.ts) - E2E driver implementation
- [playwright.config.ts](../playwright.config.ts) - Playwright configuration
