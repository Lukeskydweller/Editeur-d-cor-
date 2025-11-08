/**
 * Ghost visual tokens (centralized DRY)
 * These styles are applied to pieces that are not fully supported by lower layers.
 */

// Ghost colors by severity
export const GHOST_FILL_BLOCK = '#ef4444'; // Red for blocking issues
export const GHOST_FILL_WARN = '#f59e0b'; // Orange for warnings
export const GHOST_STROKE_BLOCK = '#dc2626'; // Darker red for stroke
export const GHOST_STROKE_WARN = '#f59e0b'; // Orange for stroke

// Normal piece colors (non-ghost)
export const NORMAL_FILL = '#60a5fa'; // Blue
export const NORMAL_STROKE = '#1e3a8a'; // Dark blue
export const NORMAL_STROKE_SELECTED = '#22d3ee'; // Cyan for selected

// Ghost opacity
export const GHOST_OPACITY = 0.8;

/**
 * Get fill color based on ghost state and severity
 */
export function getGhostFillColor(hasBlock: boolean, hasWarn: boolean): string {
  if (hasBlock) return GHOST_FILL_BLOCK;
  if (hasWarn) return GHOST_FILL_WARN;
  return NORMAL_FILL;
}

/**
 * Get stroke color based on ghost state and severity
 */
export function getGhostStrokeColor(
  hasBlock: boolean,
  hasWarn: boolean,
  isSelected: boolean,
): string {
  if (isSelected && !hasBlock && !hasWarn) return NORMAL_STROKE_SELECTED;
  if (hasBlock) return GHOST_STROKE_BLOCK;
  if (hasWarn) return GHOST_STROKE_WARN;
  return NORMAL_STROKE;
}
