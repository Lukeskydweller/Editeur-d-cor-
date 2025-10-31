import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  listDrafts,
  saveDraft,
  loadDraft,
  deleteDraft,
  upsertDraftName,
  newDraftName,
  type DraftMeta,
} from './index';

const KEY_LIST = 'editeur.drafts.v1';
const KEY_ITEM = (id: string) => `editeur.drafts.v1.${id}`;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('listDrafts', () => {
  it('returns empty array when no drafts exist', () => {
    expect(listDrafts()).toEqual([]);
  });

  it('returns empty array when list key has invalid JSON', () => {
    localStorage.setItem(KEY_LIST, '{ invalid json }');
    expect(listDrafts()).toEqual([]);
  });

  it('returns empty array when list is not an array', () => {
    localStorage.setItem(KEY_LIST, JSON.stringify({ foo: 'bar' }));
    expect(listDrafts()).toEqual([]);
  });

  it('filters out invalid draft metadata', () => {
    const list = [
      { id: 'draft-1', name: 'Valid', updatedAt: '2025-01-01T00:00:00.000Z', bytes: 100 },
      { id: 'draft-2', name: 'Missing bytes', updatedAt: '2025-01-01T00:00:00.000Z' }, // invalid
      { id: 'draft-3' }, // invalid
    ];
    localStorage.setItem(KEY_LIST, JSON.stringify(list));

    const result = listDrafts();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('draft-1');
  });

  it('sorts drafts by updatedAt descending', () => {
    const list = [
      { id: 'draft-1', name: 'Old', updatedAt: '2025-01-01T00:00:00.000Z', bytes: 100 },
      { id: 'draft-2', name: 'Newest', updatedAt: '2025-01-03T00:00:00.000Z', bytes: 200 },
      { id: 'draft-3', name: 'Middle', updatedAt: '2025-01-02T00:00:00.000Z', bytes: 150 },
    ];
    localStorage.setItem(KEY_LIST, JSON.stringify(list));

    const result = listDrafts();
    expect(result.map((d) => d.id)).toEqual(['draft-2', 'draft-3', 'draft-1']);
  });
});

describe('saveDraft', () => {
  it('creates new draft with metadata and content', () => {
    const meta: DraftMeta = {
      id: 'draft-1',
      name: 'Test Draft',
      updatedAt: '2025-01-01T00:00:00.000Z',
      bytes: 100,
    };
    const data = { version: 1, scene: { id: 'test' } };

    saveDraft(meta, data);

    // Check content saved
    const contentKey = KEY_ITEM('draft-1');
    const savedContent = localStorage.getItem(contentKey);
    expect(savedContent).toBeDefined();
    expect(JSON.parse(savedContent!)).toEqual(data);

    // Check metadata in list
    const list = listDrafts();
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(meta);
  });

  it('updates existing draft metadata', () => {
    const meta1: DraftMeta = {
      id: 'draft-1',
      name: 'Original',
      updatedAt: '2025-01-01T00:00:00.000Z',
      bytes: 100,
    };
    saveDraft(meta1, { foo: 'bar' });

    const meta2: DraftMeta = {
      id: 'draft-1',
      name: 'Updated',
      updatedAt: '2025-01-02T00:00:00.000Z',
      bytes: 200,
    };
    saveDraft(meta2, { foo: 'baz' });

    const list = listDrafts();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Updated');
    expect(list[0].bytes).toBe(200);
  });

  it('calculates bytes approximately equal to JSON length', () => {
    const data = { version: 1, scene: { id: 'test', large: 'x'.repeat(1000) } };
    const jsonString = JSON.stringify(data);
    const meta: DraftMeta = {
      id: 'draft-1',
      name: 'Test',
      updatedAt: '2025-01-01T00:00:00.000Z',
      bytes: jsonString.length,
    };

    saveDraft(meta, data);

    const list = listDrafts();
    expect(list[0].bytes).toBe(jsonString.length);
  });
});

describe('loadDraft', () => {
  it('returns null for non-existent draft', () => {
    expect(loadDraft('nonexistent')).toBeNull();
  });

  it('returns null for draft with invalid JSON content', () => {
    const meta: DraftMeta = {
      id: 'draft-1',
      name: 'Test',
      updatedAt: '2025-01-01T00:00:00.000Z',
      bytes: 100,
    };
    localStorage.setItem(KEY_LIST, JSON.stringify([meta]));
    localStorage.setItem(KEY_ITEM('draft-1'), '{ invalid json }');

    expect(loadDraft('draft-1')).toBeNull();
  });

  it('loads draft with metadata and data', () => {
    const meta: DraftMeta = {
      id: 'draft-1',
      name: 'Test Draft',
      updatedAt: '2025-01-01T00:00:00.000Z',
      bytes: 100,
    };
    const data = { version: 1, scene: { id: 'test' } };

    saveDraft(meta, data);

    const loaded = loadDraft('draft-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.meta).toEqual(meta);
    expect(loaded!.data).toEqual(data);
  });
});

describe('deleteDraft', () => {
  it('removes draft content and metadata', () => {
    const meta: DraftMeta = {
      id: 'draft-1',
      name: 'Test',
      updatedAt: '2025-01-01T00:00:00.000Z',
      bytes: 100,
    };
    saveDraft(meta, { foo: 'bar' });

    deleteDraft('draft-1');

    // Check content removed
    expect(localStorage.getItem(KEY_ITEM('draft-1'))).toBeNull();

    // Check metadata removed from list
    expect(listDrafts()).toHaveLength(0);
  });

  it('does not affect other drafts', () => {
    const meta1: DraftMeta = {
      id: 'draft-1',
      name: 'Draft 1',
      updatedAt: '2025-01-01T00:00:00.000Z',
      bytes: 100,
    };
    const meta2: DraftMeta = {
      id: 'draft-2',
      name: 'Draft 2',
      updatedAt: '2025-01-02T00:00:00.000Z',
      bytes: 200,
    };

    saveDraft(meta1, { foo: 'bar' });
    saveDraft(meta2, { baz: 'qux' });

    deleteDraft('draft-1');

    const list = listDrafts();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('draft-2');
    expect(loadDraft('draft-2')).not.toBeNull();
  });
});

describe('upsertDraftName', () => {
  it('updates draft name in metadata list', () => {
    const meta: DraftMeta = {
      id: 'draft-1',
      name: 'Original',
      updatedAt: '2025-01-01T00:00:00.000Z',
      bytes: 100,
    };
    saveDraft(meta, { foo: 'bar' });

    upsertDraftName('draft-1', 'Renamed');

    const list = listDrafts();
    expect(list[0].name).toBe('Renamed');
  });

  it('does nothing for non-existent draft', () => {
    upsertDraftName('nonexistent', 'New Name');
    expect(listDrafts()).toHaveLength(0);
  });
});

describe('newDraftName', () => {
  it('returns "Brouillon 1" when no drafts exist', () => {
    expect(newDraftName()).toBe('Brouillon 1');
  });

  it('increments counter to avoid name collision', () => {
    const meta1: DraftMeta = {
      id: 'draft-1',
      name: 'Brouillon 1',
      updatedAt: '2025-01-01T00:00:00.000Z',
      bytes: 100,
    };
    saveDraft(meta1, {});

    expect(newDraftName()).toBe('Brouillon 2');

    const meta2: DraftMeta = {
      id: 'draft-2',
      name: 'Brouillon 2',
      updatedAt: '2025-01-01T00:00:00.000Z',
      bytes: 100,
    };
    saveDraft(meta2, {});

    expect(newDraftName()).toBe('Brouillon 3');
  });

  it('handles gaps in numbering sequence', () => {
    const meta1: DraftMeta = {
      id: 'draft-1',
      name: 'Brouillon 1',
      updatedAt: '2025-01-01T00:00:00.000Z',
      bytes: 100,
    };
    const meta3: DraftMeta = {
      id: 'draft-3',
      name: 'Brouillon 3',
      updatedAt: '2025-01-01T00:00:00.000Z',
      bytes: 100,
    };

    saveDraft(meta1, {});
    saveDraft(meta3, {});

    // Should return "Brouillon 2" (fills gap)
    expect(newDraftName()).toBe('Brouillon 2');
  });

  it('supports custom basis name', () => {
    expect(newDraftName('Draft')).toBe('Draft 1');

    const meta: DraftMeta = {
      id: 'draft-1',
      name: 'Draft 1',
      updatedAt: '2025-01-01T00:00:00.000Z',
      bytes: 100,
    };
    saveDraft(meta, {});

    expect(newDraftName('Draft')).toBe('Draft 2');
  });
});

describe('round-trip integration', () => {
  it('save → load → delete workflow', () => {
    const meta: DraftMeta = {
      id: 'draft-test',
      name: 'Integration Test',
      updatedAt: '2025-01-01T00:00:00.000Z',
      bytes: 150,
    };
    const data = { version: 1, scene: { id: 'scene-1', materials: { 'mat-1': { id: 'mat-1', name: 'Material' } } } };

    // Save
    saveDraft(meta, data);
    expect(listDrafts()).toHaveLength(1);

    // Load
    const loaded = loadDraft('draft-test');
    expect(loaded).not.toBeNull();
    expect(loaded!.data).toEqual(data);

    // Delete
    deleteDraft('draft-test');
    expect(listDrafts()).toHaveLength(0);
    expect(loadDraft('draft-test')).toBeNull();
  });
});
