/**
 * Stable empty array reference to prevent unnecessary re-renders
 * Use this instead of [] in selectors and default values
 */
export const EMPTY_ARR: readonly never[] = Object.freeze([]);

/**
 * UI epsilon for validation throttling (mm)
 * Validation is skipped if cursor moved less than this since last validation
 */
export const EPS_UI_MM = 0.3;

/**
 * Standard offset for piece duplication (mm)
 * When duplicating a piece, it will be offset by this amount in both x and y
 */
export const DUPLICATE_OFFSET_MM = 60;
