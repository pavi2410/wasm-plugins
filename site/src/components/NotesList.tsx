interface Note {
  id: number;
  title: string;
  content: string;
}

interface NotesListProps {
  notes: Note[];
  currentNoteId: number | null;
  onSelectNote: (id: number) => void;
  onCreateNote: () => void;
  onOpenPlugins: () => void;
  installedPluginsCount: number;
}

export default function NotesList({
  notes,
  currentNoteId,
  onSelectNote,
  onCreateNote,
  onOpenPlugins,
  installedPluginsCount
}: NotesListProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>📝 WASM Notes</h1>
        <p>Extensible notes with WASM plugins</p>
        <button className="btn btn-secondary" onClick={onOpenPlugins}>
          🔌 Plugins ({installedPluginsCount})
        </button>
      </div>

      <div className="notes-list">
        {notes.length === 0 ? (
          <p style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            No notes yet
          </p>
        ) : (
          notes.map(note => (
            <div
              key={note.id}
              className={`note-item ${note.id === currentNoteId ? 'active' : ''}`}
              onClick={() => onSelectNote(note.id)}
            >
              <h3>{note.title}</h3>
              <p>
                {note.content.substring(0, 60)}
                {note.content.length > 60 ? '...' : ''}
              </p>
            </div>
          ))
        )}
      </div>

      <button className="new-note-btn" onClick={onCreateNote}>
        + New Note
      </button>
    </aside>
  );
}
