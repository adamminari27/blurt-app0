import { useState, useEffect } from 'react';
import { db } from './db/database';
import type { Notebook } from './db/types';
import { NotebookList } from './screens/NotebookList';
import { NotebookEditor } from './screens/NotebookEditor';
import { BlurtSession } from './screens/BlurtSession';
import type { SessionMode } from './engine/ntd';

type View =
  | { name: 'list' }
  | { name: 'editor'; notebookId: string }
  | { name: 'blurt'; notebookId: string; itemCount: number; mode: SessionMode };

export default function App() {
  const [view, setView] = useState<View>({ name: 'list' });
  const [notebook, setNotebook] = useState<Notebook | null>(null);

  useEffect(() => {
    if (view.name === 'editor' || view.name === 'blurt') {
      db.notebooks.get(view.notebookId).then((nb) => setNotebook(nb || null));
    } else {
      setNotebook(null);
    }
  }, [view]);

  if (view.name === 'list') {
    return <NotebookList onOpen={(id) => setView({ name: 'editor', notebookId: id })} />;
  }

  if (view.name === 'editor') {
    return (
      <NotebookEditor
        notebookId={view.notebookId}
        notebookName={notebook?.name || 'Notebook'}
        onBack={() => setView({ name: 'list' })}
        onStartBlurt={(itemCount, mode) =>
          setView({ name: 'blurt', notebookId: view.notebookId, itemCount, mode })
        }
      />
    );
  }

  return (
    <BlurtSession
      notebookId={view.notebookId}
      itemCount={view.itemCount}
      mode={view.mode}
      onExit={() => setView({ name: 'editor', notebookId: view.notebookId })}
    />
  );
}
