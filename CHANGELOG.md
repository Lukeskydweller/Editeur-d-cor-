# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-09

### Added

- **Spatial indexing AUTO mode**: Adaptive spatial engine that automatically switches between O(n) global scan and O(log n) RBush R-tree based on piece count (threshold: 120 pieces)
- LayeredRBush: Separate R-tree per layer (C1, C2, C3) for same-layer collision/snap queries
- `window.__SPATIAL__` override for manual control ('auto' | 'rbush' | 'global')
- Dev Panel "SpatialMetrics" component showing real-time spatial query statistics (queries count, mean/P95 latency, speedup)
- Spatial query instrumentation via User Timing API (`performance.mark`/`measure`) - DEV builds only
- E2E smoke tests for AUTO mode validation (150 non-overlapping pieces)
- `excludeIds` parameter for spatial queries to prevent self-collision during drag/resize operations
- Query counter tracking with `pendingQueryCounts` and `flushQueryCounters()` for accurate metrics

### Changed

- Default spatial engine mode: `'auto'` (previously required manual flag)
- Snap functions (`snapToPieces`, `snapGroupToPieces`) now use `shortlistSameLayerAABB` for unified spatial querying
- Snap neighbor queries: Collect neighbors per group member (not just group bbox) for better snap accuracy
- Spatial index rebuilds use `requestIdleCallback` with timeout fallback for non-critical updates

### Fixed

- Self-collision bug: Moving pieces no longer block themselves in spatial queries
- Query counter synchronization: Fixed Zustand immutability issue by using module-level counters with flush on drag/resize end
- Snap fallback: Tests now correctly fall back to full scan when spatial index returns zero results

### Performance

- **10-15x speedup** for drag/snap operations with 300+ pieces (RBush vs Global)
  - N=100: ~0.1ms (RBush) vs ~0.5ms (Global)
  - N=300: ~0.15ms (RBush) vs ~2.5ms (Global)
  - N=500: ~0.2ms (RBush) vs ~5.0ms (Global)
- Zero production overhead: All instrumentation behind `import.meta.env.DEV` guards
- Spatial queries gated by `window.__DBG_DRAG__` flag for granular logging control

## [Unreleased]

### Notes

- See [docs/Spatial-Rollout.md](docs/Spatial-Rollout.md) for detailed release notes
- See [docs/bench-spatial-latest.md](docs/bench-spatial-latest.md) for benchmark results
