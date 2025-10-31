/**
 * Draft management API for localStorage persistence
 * Multi-slot system for managing multiple named scenes
 */

export type DraftMeta = {
  id: string;
  name: string;
  updatedAt: string;
  bytes: number;
};

export type DraftList = DraftMeta[];

const KEY_LIST = 'editeur.drafts.v1';
const KEY_ITEM = (id: string) => `editeur.drafts.v1.${id}`;

/**
 * List all drafts, sorted by updatedAt descending
 */
export function listDrafts(): DraftList {
  try {
    const raw = localStorage.getItem(KEY_LIST);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Validate structure and sort
    const valid = parsed.filter(
      (item): item is DraftMeta =>
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.updatedAt === 'string' &&
        typeof item.bytes === 'number'
    );

    // Sort by updatedAt descending (newest first)
    return valid.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

/**
 * Save draft metadata and data to localStorage
 * Updates list metadata and stores content separately
 */
export function saveDraft(meta: DraftMeta, data: unknown): void {
  try {
    // Save draft content
    const contentKey = KEY_ITEM(meta.id);
    const jsonString = JSON.stringify(data);
    localStorage.setItem(contentKey, jsonString);

    // Update metadata list
    const list = listDrafts();
    const existingIndex = list.findIndex((d) => d.id === meta.id);

    if (existingIndex >= 0) {
      // Update existing draft
      list[existingIndex] = meta;
    } else {
      // Add new draft
      list.push(meta);
    }

    // Save updated list
    localStorage.setItem(KEY_LIST, JSON.stringify(list));
  } catch (err) {
    console.error('[drafts] saveDraft failed:', err);
  }
}

/**
 * Load draft by ID, returns metadata and data
 * Returns null if draft not found or invalid
 */
export function loadDraft(id: string): { meta: DraftMeta; data: unknown } | null {
  try {
    // Load draft content
    const contentKey = KEY_ITEM(id);
    const raw = localStorage.getItem(contentKey);
    if (!raw) return null;

    const data = JSON.parse(raw);

    // Find metadata
    const list = listDrafts();
    const meta = list.find((d) => d.id === id);
    if (!meta) return null;

    return { meta, data };
  } catch {
    return null;
  }
}

/**
 * Delete draft by ID
 * Removes both content and metadata
 */
export function deleteDraft(id: string): void {
  try {
    // Remove content
    const contentKey = KEY_ITEM(id);
    localStorage.removeItem(contentKey);

    // Update list
    const list = listDrafts();
    const filtered = list.filter((d) => d.id !== id);
    localStorage.setItem(KEY_LIST, JSON.stringify(filtered));
  } catch (err) {
    console.error('[drafts] deleteDraft failed:', err);
  }
}

/**
 * Rename draft (update name in metadata list)
 */
export function upsertDraftName(id: string, name: string): void {
  try {
    const list = listDrafts();
    const draft = list.find((d) => d.id === id);
    if (!draft) return;

    draft.name = name;
    localStorage.setItem(KEY_LIST, JSON.stringify(list));
  } catch (err) {
    console.error('[drafts] upsertDraftName failed:', err);
  }
}

/**
 * Generate new draft name with auto-incrementing number
 * Pattern: "Brouillon 1", "Brouillon 2", etc.
 */
export function newDraftName(basis = 'Brouillon'): string {
  const list = listDrafts();
  const existingNames = new Set(list.map((d) => d.name));

  let counter = 1;
  let candidate = `${basis} ${counter}`;

  while (existingNames.has(candidate)) {
    counter++;
    candidate = `${basis} ${counter}`;
  }

  return candidate;
}
