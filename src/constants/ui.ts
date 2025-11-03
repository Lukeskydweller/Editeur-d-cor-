/**
 * Constantes UI configurables via variables d'environnement
 */

// Afficher le micro-tooltip de gap (par défaut: true)
export const SHOW_GAP_TOOLTIP = import.meta.env.VITE_UI_SHOW_GAP_TOOLTIP !== 'false';

// Seuil de collage (mm) - override via env
export const COLLAGE_MM = Number(import.meta.env.VITE_UI_COLLAGE_MM) || 1.0;

// Seuil de pré-collage (mm) - override via env
export const PRECOLLAGE_MM = Number(import.meta.env.VITE_UI_PRECOLLAGE_MM) || 5.0;

// Seuil maximal d'affichage du tooltip de gap (mm)
export const TOOLTIP_GAP_MAX_MM = Number(import.meta.env.VITE_UI_TOOLTIP_GAP_MAX_MM) || 10.0;

// Durée d'affichage du tooltip (ms) - utilisé si TOOLTIP_STICKY = false
export const TOOLTIP_DURATION_MS = Number(import.meta.env.VITE_UI_TOOLTIP_MS) || 400;

// Tooltip persistant (reste affiché tant que sélection active et gap ≤ max)
export const TOOLTIP_STICKY = import.meta.env.VITE_UI_TOOLTIP_STICKY !== 'false';
