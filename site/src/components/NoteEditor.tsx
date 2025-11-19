import { useState, useEffect } from 'react';
import type { PluginLoader } from '../lib/plugin-loader';

interface Note {
  id: number;
  title: string;
  content: string;
}

interface NoteEditorProps {
  note: Note;
  pluginLoader: PluginLoader;
  pluginsLoaded: boolean;
  onUpdateNote: (id: number, updates: Partial<Note>) => void;
  onDeleteNote: (id: number) => void;
}

export default function NoteEditor({
  note,
  pluginLoader,
  pluginsLoaded,
  onUpdateNote,
  onDeleteNote
}: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [preview, setPreview] = useState({ html: '', stats: null as any, tags: [] as string[] });

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
  }, [note.id]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onUpdateNote(note.id, { title });
    }, 500);
    return () => clearTimeout(timeout);
  }, [title]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onUpdateNote(note.id, { content });
    }, 500);
    return () => clearTimeout(timeout);
  }, [content]);

  useEffect(() => {
    updatePreview();
  }, [content, pluginsLoaded]);

  const updatePreview = () => {
    let html = content || '<p style="color: var(--text-muted);">Preview will appear here...</p>';
    let stats = null;
    let tags: string[] = [];

    // Markdown Plugin
    const markdownPlugin = pluginLoader.getPlugin('markdown-plugin');
    if (markdownPlugin && content) {
      try {
        html = markdownPlugin.render(content);
      } catch (error) {
        console.error('Markdown plugin error:', error);
      }
    }

    // Word Counter Plugin
    const counterPlugin = pluginLoader.getPlugin('word-counter-plugin');
    if (counterPlugin && content) {
      try {
        stats = counterPlugin.count(content);
      } catch (error) {
        console.error('Word counter plugin error:', error);
      }
    }

    // Tag Manager Plugin
    const tagPlugin = pluginLoader.getPlugin('tag-manager-plugin');
    if (tagPlugin && content) {
      try {
        tags = tagPlugin.extract_tags(content);
      } catch (error) {
        console.error('Tag manager plugin error:', error);
      }
    }

    setPreview({ html, stats, tags });
  };

  const hasMarkdown = pluginLoader.hasPlugin('markdown-plugin');
  const hasCounter = pluginLoader.hasPlugin('word-counter-plugin');
  const hasTags = pluginLoader.hasPlugin('tag-manager-plugin');

  return (
    <main className="main-content">
      <div className="editor-header">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled Note"
          className="note-title-input"
        />
        <div className="editor-actions">
          <button className="btn danger" onClick={() => onDeleteNote(note.id)}>
            Delete
          </button>
        </div>
      </div>

      <div className="editor-content">
        <div className="editor-pane">
          <h2>✍️ Editor</h2>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start writing..."
          />
        </div>

        <div className="editor-pane">
          <h2>
            👁️ Live Preview
            {hasMarkdown && <span className="plugin-badge">Markdown</span>}
            {hasCounter && <span className="plugin-badge">Counter</span>}
            {hasTags && <span className="plugin-badge">Tags</span>}
          </h2>

          {!hasMarkdown && !hasCounter && !hasTags && (
            <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '0.5rem', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                No plugins installed. Click the Plugins button to add features!
              </p>
            </div>
          )}

          {hasCounter && preview.stats && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{preview.stats.words}</div>
                <div className="stat-label">Words</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{preview.stats.characters}</div>
                <div className="stat-label">Characters</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{preview.stats.lines}</div>
                <div className="stat-label">Lines</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{preview.stats.paragraphs}</div>
                <div className="stat-label">Paragraphs</div>
              </div>
            </div>
          )}

          {hasTags && preview.tags.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                TAGS
              </h3>
              <div className="tags-container">
                {preview.tags.map(tag => (
                  <span key={tag} className="tag">#{tag}</span>
                ))}
              </div>
            </div>
          )}

          {hasMarkdown && (
            <div className="preview-content" dangerouslySetInnerHTML={{ __html: preview.html }} />
          )}
        </div>
      </div>
    </main>
  );
}
