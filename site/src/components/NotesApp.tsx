import { useState, useEffect, useMemo } from 'react';
import { PluginLoader } from '@/lib/plugin-loader';
import NoteEditor from './NoteEditor';
import PluginStore from './PluginStore';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Plus, Search, Settings, Command, Moon, Sun, FileText, Puzzle } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';

interface Note {
  id: number;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const pluginLoader = new PluginLoader();

export default function NotesApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [pluginsLoaded, setPluginsLoaded] = useState(false);
  const [showPluginStore, setShowPluginStore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Load notes from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('wasm-notes');
    if (saved) {
      const parsed = JSON.parse(saved);
      setNotes(parsed.map((note: any) => ({
        ...note,
        createdAt: new Date(note.createdAt),
        updatedAt: new Date(note.updatedAt)
      })));
    } else {
      // Create welcome note
      const welcomeNote: Note = {
        id: Date.now(),
        title: 'Welcome to WASM Notes! 👋',
        content: `# Welcome to WASM Notes

This is an **extensible notes app** powered by WebAssembly plugins!

## Features

- **Markdown Support**: Write notes in Markdown
- **Plugin System**: Extend functionality with WASM plugins
- **Real-time Preview**: See your formatted notes instantly
- **Fast & Secure**: Plugins run in isolated Web Workers

## Get Started

1. Click the **Plugins** button to browse available extensions
2. Install plugins to add new features (Markdown renderer, word counter, tag manager, etc.)
3. Start writing your notes!

## Keyboard Shortcuts

- **Cmd/Ctrl + K**: Open command palette
- **Cmd/Ctrl + N**: Create new note

Try installing some plugins from the store to see the magic happen! ✨
`,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setNotes([welcomeNote]);
      setSelectedNoteId(welcomeNote.id);
    }
  }, []);

  // Save notes to localStorage
  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem('wasm-notes', JSON.stringify(notes));
    }
  }, [notes]);

  // Load plugins
  useEffect(() => {
    const loadPlugins = async () => {
      await pluginLoader.initialize();
      await pluginLoader.loadInstalledPlugins();
      setPluginsLoaded(true);
    };
    loadPlugins();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K: Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
      // Cmd/Ctrl + N: New note
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        createNote();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Toggle theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const selectedNote = notes.find(n => n.id === selectedNoteId) || null;

  // Filter notes by search query
  const filteredNotes = useMemo(() => {
    if (!searchQuery) return notes;
    const query = searchQuery.toLowerCase();
    return notes.filter(note =>
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query)
    );
  }, [notes, searchQuery]);

  const createNote = () => {
    const newNote: Note = {
      id: Date.now(),
      title: 'Untitled Note',
      content: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setNotes([newNote, ...notes]);
    setSelectedNoteId(newNote.id);
  };

  const updateNote = (id: number, updates: Partial<Note>) => {
    setNotes(notes.map(note =>
      note.id === id
        ? { ...note, ...updates, updatedAt: new Date() }
        : note
    ));
  };

  const deleteNote = (id: number) => {
    const filtered = notes.filter(note => note.id !== id);
    setNotes(filtered);
    if (selectedNoteId === id) {
      setSelectedNoteId(filtered[0]?.id || null);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        {/* Sidebar */}
        <aside className="w-80 border-r border-border flex flex-col bg-card">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                WASM Notes
              </h1>
              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCommandOpen(true)}
                      className="h-8 w-8"
                    >
                      <Command className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Command Palette (⌘K)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleTheme}
                      className="h-8 w-8"
                    >
                      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle Theme</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="p-3 border-b border-border flex gap-2">
            <Button onClick={createNote} className="flex-1" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Note
            </Button>
            <Button
              onClick={() => setShowPluginStore(!showPluginStore)}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Puzzle className="h-4 w-4 mr-2" />
              Plugins
            </Button>
          </div>

          {/* Notes List */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {filteredNotes.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No notes found</p>
                </div>
              )}

              {filteredNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => setSelectedNoteId(note.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg transition-all duration-200",
                    "hover:bg-accent/50",
                    selectedNoteId === note.id
                      ? "bg-accent/80 shadow-md"
                      : "bg-card"
                  )}
                >
                  <h3 className="font-semibold text-sm mb-1 truncate">
                    {note.title || 'Untitled'}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate mb-1">
                    {note.content.slice(0, 60) || 'No content'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(note.updatedAt)}
                  </p>
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-3 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
              {pluginsLoaded && ` • ${pluginLoader.getInstalledPlugins().length} plugins`}
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {showPluginStore ? (
            <PluginStore
              pluginLoader={pluginLoader}
              onClose={() => setShowPluginStore(false)}
            />
          ) : selectedNote ? (
            <NoteEditor
              note={selectedNote}
              pluginLoader={pluginLoader}
              pluginsLoaded={pluginsLoaded}
              onUpdateNote={updateNote}
              onDeleteNote={deleteNote}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-24 w-24 mx-auto mb-6 text-muted-foreground/30" />
                <h2 className="text-2xl font-bold mb-2">No Note Selected</h2>
                <p className="text-muted-foreground mb-6">
                  Select a note from the sidebar or create a new one
                </p>
                <Button onClick={createNote}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Note
                </Button>
              </div>
            </div>
          )}
        </main>

        {/* Command Palette */}
        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => {
                  createNote();
                  setCommandOpen(false);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                <span>New Note</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setShowPluginStore(!showPluginStore);
                  setCommandOpen(false);
                }}
              >
                <Puzzle className="mr-2 h-4 w-4" />
                <span>Open Plugin Store</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  toggleTheme();
                  setCommandOpen(false);
                }}
              >
                {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                <span>Toggle Theme</span>
              </CommandItem>
            </CommandGroup>
            {notes.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Notes">
                  {notes.slice(0, 10).map((note) => (
                    <CommandItem
                      key={note.id}
                      onSelect={() => {
                        setSelectedNoteId(note.id);
                        setCommandOpen(false);
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      <span>{note.title || 'Untitled'}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </CommandDialog>
      </div>
    </TooltipProvider>
  );
}
