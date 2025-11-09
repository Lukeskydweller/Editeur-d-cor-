// Types de base pour l'éditeur (V1)

export type Milli = number; // millimètres (réel)
export type Deg = number; // degrés (0..360)
export type ID = string;

export type Vec2 = { x: Milli; y: Milli };

export type BBox = {
  x: Milli; // minX
  y: Milli; // minY
  w: Milli; // width
  h: Milli; // height
};

export type MaterialRef = {
  id: ID; // ex: "paper-white-200gsm"
  name: string; // affichage
  oriented?: boolean; // si la matière a un sens (0/90°)
  orientationDeg?: Deg; // sens choisi pour la scène (0|90), si oriented
};

export type Piece = {
  id: ID;
  readonly layerId: ID; // Immutable: piece layer cannot be reassigned after creation
  materialId: ID;

  // Pose dans la scène (origine en mm, repère scène)
  position: Vec2; // origine locale
  rotationDeg: Deg; // rotation autour de l'origine locale
  scale: { x: number; y: number }; // 1 par défaut

  // Géométrie nominale (WYSIWYC) — V1: rectangle minimal
  kind: 'rect'; // on élargira plus tard (polygon, ellipse…)
  size: { w: Milli; h: Milli };

  // Autoriser bord-à-bord (ignore spacing_too_small)
  joined?: boolean;

  // Dérivés utiles (optionnels, calculés côté front)
  bbox?: BBox;
};

export type Layer = {
  id: ID;
  name: string;
  z: number; // ordre d’affichage (plus grand = au-dessus)
  pieces: Piece['id'][]; // référentiel par id (source-of-truth dans map)
};

export type SceneDraft = {
  id: ID;
  createdAt: string; // ISO
  size: { w: Milli; h: Milli }; // surface murale utile (mm)
  materials: Record<ID, MaterialRef>;
  layers: Record<ID, Layer>;
  pieces: Record<ID, Piece>;
  layerOrder: ID[]; // ordre z croissant (cohérent avec Layer.z)
  revision: number; // Incrémenté à chaque mutation de géométrie (position/taille/rotation)
  // (nouveau) ids stables des couches fixes (résolus à l'init / chargement)
  fixedLayerIds?: { C1: ID; C2: ID; C3: ID };
};
