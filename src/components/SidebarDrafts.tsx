import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSceneStore, type SceneStoreState } from '@/state/useSceneStore';
import { listDrafts, type DraftMeta } from '@/lib/drafts';

export function SidebarDrafts() {
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);

  const createDraft = useSceneStore((s: SceneStoreState) => s.createDraft);
  const saveToDraft = useSceneStore((s: SceneStoreState) => s.saveToDraft);
  const loadDraftById = useSceneStore((s: SceneStoreState) => s.loadDraftById);
  const renameDraft = useSceneStore((s: SceneStoreState) => s.renameDraft);
  const deleteDraftById = useSceneStore((s: SceneStoreState) => s.deleteDraftById);

  // Refresh drafts list
  const refreshDrafts = () => {
    setDrafts(listDrafts());
  };

  // Load drafts on mount
  useEffect(() => {
    refreshDrafts();
  }, []);

  const handleNewDraft = () => {
    createDraft();
    refreshDrafts();
  };

  const handleLoad = (id: string) => {
    loadDraftById(id);
    refreshDrafts();
  };

  const handleSave = (id: string) => {
    saveToDraft(id);
    refreshDrafts();
  };

  const handleRename = (id: string, currentName: string) => {
    const newName = window.prompt('Renommer le brouillon:', currentName);
    if (!newName) return;

    const trimmed = newName.trim();
    if (trimmed.length === 0) {
      alert('Le nom ne peut pas être vide.');
      return;
    }

    if (trimmed.length > 60) {
      alert('Le nom ne peut pas dépasser 60 caractères.');
      return;
    }

    renameDraft(id, trimmed);
    refreshDrafts();
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Supprimer le brouillon "${name}" ?`)) {
      return;
    }

    deleteDraftById(id);
    refreshDrafts();
  };

  const formatDate = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const formatBytes = (bytes: number): string => {
    return `${Math.ceil(bytes / 1024)} KB`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Drafts</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={handleNewDraft}
          aria-label="new-draft"
          title="New draft"
        >
          + New
        </Button>
      </CardHeader>
      <CardContent>
        {drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun brouillon</p>
        ) : (
          <ul className="space-y-3" role="list" aria-label="drafts-list">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="flex flex-col gap-2 pb-3 border-b border-border last:border-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{draft.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(draft.updatedAt)}
                    </div>
                    <div className="text-xs text-muted-foreground">{formatBytes(draft.bytes)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleLoad(draft.id)}
                    aria-label={`load-draft-${draft.id}`}
                    title="Load draft"
                  >
                    Load
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSave(draft.id)}
                    aria-label={`save-draft-${draft.id}`}
                    title="Save to draft"
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRename(draft.id, draft.name)}
                    aria-label={`rename-draft-${draft.id}`}
                    title="Rename draft"
                  >
                    Rename
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(draft.id, draft.name)}
                    aria-label={`delete-draft-${draft.id}`}
                    title="Delete draft"
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
