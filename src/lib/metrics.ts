// Legacy metrics object (backward compatibility)
export const metrics = {
  rbush_candidates_snap_total: 0,
  rbush_candidates_collision_total: 0,
  rbush_rebuild_total: 0,
  rbush_rebuild_ms_sum: 0,
};

// Runtime metrics context for dynamic counters and gauges
type Ctx = { [k: string]: number };
const ctx: Ctx = Object.create(null);

export function inc(key: string, by = 1) {
  ctx[key] = (ctx[key] ?? 0) + by;
}

export function setGauge(key: string, v: number) {
  ctx[key] = v;
}

export function getAll(): Record<string, number> {
  return { ...ctx };
}

// Helpers for shortlist source tracking
export function incShortlistSource(
  fn:
    | 'snapToPieces'
    | 'snapGroupToPieces'
    | 'collisionsForPiece'
    | 'collisionsSameLayer'
    | 'collisionsForCandidate',
  source: 'GLOBAL_IDX' | 'RBUSH' | 'FALLBACK' | 'ALL',
) {
  inc(`shortlist_source_total{fn=${fn},source=${source}}`);
}

export function setAutoSpatialState(on: boolean) {
  setGauge('auto_spatial_state', on ? 1 : 0);
}

// Helpers for resize block overlap tracking
export function incResizeBlockPreview() {
  inc('resize_block_preview_total');
}

export function incResizeBlockCommitBlocked() {
  inc('resize_block_commit_blocked_total');
}

export function incResizeBlockCommitSuccess() {
  inc('resize_block_commit_success_total');
}
