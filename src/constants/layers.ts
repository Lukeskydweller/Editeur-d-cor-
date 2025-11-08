// src/constants/layers.ts
export type LayerName = 'C1' | 'C2' | 'C3';
export const FIXED_LAYER_NAMES: LayerName[] = ['C1', 'C2', 'C3'];
export const isLayerName = (s: string): s is LayerName => s === 'C1' || s === 'C2' || s === 'C3';
