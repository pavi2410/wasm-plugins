import { useState, useEffect } from 'react';
import { PluginLoader } from '../lib/plugin-loader';
import PluginManager from './PluginManager';
import NotesList from './NotesList';
import NoteEditor from './NoteEditor';

interface Note {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export default function NotesApp() {
  const [pluginLoader] = useState(() => new PluginLoader());
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNoteId, setCurrentNoteId] = useState<number | null>(null);
  const [showPluginManager, setShowPluginManager] = useState(false);
  const [pluginsLoaded, setPluginsLoaded] = useState(false);

  // Load notes from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('wasm-notes');
    if (stored) {
      setNotes(JSON.parse(stored));
    }
  }, []);

  // Load installed plugins on mount
  useEffect(() => {
    const loadPlugins = async () => {
      await pluginLoader.loadInstalledPlugins();
      setPluginsLoaded(true);
    };
    loadPlugins();
  }, [pluginLoader]);

  // Save notes to localStorage
  const saveNotes = (updatedNotes: Note[]) => {
    localStorage.setItem('wasm-notes', JSON.stringify(updatedNotes));
    setNotes(updatedNotes);
  };

  const createNote = () => {
    const note: Note = {
      id: Date.now(),
      title: 'Untitled Note',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const updatedNotes = [note, ...notes];
    saveNotes(updatedNotes);
    setCurrentNoteId(note.id);
  };

  const updateNote = (id: number, updates: Partial<Note>) => {
    const updatedNotes = notes.map(note =>
      note.id === id
        ? { ...note, ...updates, updatedAt: new Date().toISOString() }
        : note
    );
    saveNotes(updatedNotes);
  };

  const deleteNote = (id: number) => {
    if (!confirm('Delete this note?')) return;
    const updatedNotes = notes.filter(note => note.id !== id);
    saveNotes(updatedNotes);
    if (currentNoteId === id) {
      setCurrentNoteId(null);
    }
  };

  const currentNote = notes.find(note => note.id === currentNoteId);

  return (
    <>
      <div className="app-container">
        <NotesList
          notes={notes}
          currentNoteId={currentNoteId}
          onSelectNote={setCurrentNoteId}
          onCreateNote={createNote}
          onOpenPlugins={() => setShowPluginManager(true)}
          installedPluginsCount={pluginLoader.getInstalledPlugins().length}
        />

        {currentNote ? (
          <NoteEditor
            note={currentNote}
            pluginLoader={pluginLoader}
            pluginsLoaded={pluginsLoaded}
            onUpdateNote={updateNote}
            onDeleteNote={deleteNote}
          />
        ) : (
          <main className="main-content">
            <div className="empty-state">
              <h2>Welcome to WASM Notes</h2>
              <p>Create a new note to get started</p>
              <button className="btn btn-primary" onClick={createNote}>
                Create Your First Note
              </button>
            </div>
          </main>
        )}
      </div>

      {showPluginManager && (
        <PluginManager
          pluginLoader={pluginLoader}
          onClose={() => setShowPluginManager(false)}
          onPluginChange={() => setPluginsLoaded(!pluginsLoaded)}
        />
      )}
    </>
  );
}
