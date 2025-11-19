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
  const [contributionResults, setContributionResults] = useState<Map<string, any>>(new Map());
  const [activeTab, setActiveTab] = useState<string | null>(null);

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

  const updatePreview = async () => {
    const results = new Map<string, any>();

    if (content && pluginsLoaded) {
      try {
        // Emit content.changed event to all subscribed plugins
        const pluginResults = await pluginLoader.emit('content.changed', { content });

        // Store results keyed by pluginId
        for (const [pluginId, result] of Object.entries(pluginResults)) {
          if (result && !(result as any).error) {
            results.set(pluginId, result);
          } else if ((result as any)?.error) {
            console.error(`Plugin ${pluginId} error:`, (result as any).error);
          }
        }
      } catch (error) {
        console.error('Error emitting content.changed event:', error);
      }
    }

    setContributionResults(results);
  };

  // Get all contributions for a view type
  const getContributions = (viewType: string) => {
    return pluginLoader.getContributions(viewType);
  };

  // Get all active contributions (from loaded plugins)
  const getAllActiveContributions = () => {
    const allContribs = [];
    for (const [viewType, contribs] of [
      ['preview.main', getContributions('preview.main')],
      ['preview.stats', getContributions('preview.stats')],
      ['preview.tags', getContributions('preview.tags')],
      ['statusBar', getContributions('statusBar')]
    ]) {
      allContribs.push(...(contribs as any[]));
    }
    return allContribs;
  };

  // Render a contribution slot based on its type
  const renderSlot = (viewType: string) => {
    const contributions = getContributions(viewType);

    if (contributions.length === 0) {
      return null;
    }

    const slotConfig = (pluginLoader as any).slotTypes[viewType] || { type: 'multiple', layout: 'horizontal' };

    // Handle 'tabs' type - show multiple plugins as tabs
    if (slotConfig.type === 'tabs') {
      if (contributions.length === 1) {
        return renderContribution(contributions[0]);
      }

      // Multiple plugins - render as tabs
      const currentTab = activeTab || contributions[0].pluginId;
      const activeContribution = contributions.find(c => c.pluginId === currentTab);

      return (
        <div className="tabs-container">
          <div className="tabs-header">
            {contributions.map(contrib => (
              <button
                key={contrib.pluginId}
                className={`tab-button ${currentTab === contrib.pluginId ? 'active' : ''}`}
                onClick={() => setActiveTab(contrib.pluginId)}
              >
                {contrib.title}
              </button>
            ))}
          </div>
          <div className="tab-content">
            {activeContribution && renderContribution(activeContribution)}
          </div>
        </div>
      );
    }

    // Handle 'single' type - only show highest priority
    if (slotConfig.type === 'single') {
      return renderContribution(contributions[0]);
    }

    // Handle 'multiple' type - show all
    if (slotConfig.type === 'multiple') {
      const layout = slotConfig.layout || 'vertical';
      return (
        <div className={`multiple-slot ${layout}`}>
          {contributions.map(contrib => (
            <div key={contrib.pluginId} className="slot-item">
              {renderContribution(contrib)}
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  // Render a single contribution
  const renderContribution = (contribution: any) => {
    const result = contributionResults.get(contribution.pluginId);

    if (!result) {
      return null;
    }

    const resultType = result.type;

    // Render based on result type
    if (resultType === 'render' && result.html) {
      return (
        <div className="preview-content" dangerouslySetInnerHTML={{ __html: result.html }} />
      );
    }

    if (resultType === 'stats' && result.stats) {
      return (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{result.stats.words}</div>
            <div className="stat-label">Words</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{result.stats.characters}</div>
            <div className="stat-label">Characters</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{result.stats.lines}</div>
            <div className="stat-label">Lines</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{result.stats.paragraphs}</div>
            <div className="stat-label">Paragraphs</div>
          </div>
        </div>
      );
    }

    if (resultType === 'tags' && result.tags && result.tags.length > 0) {
      return (
        <div>
          <h3 style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            TAGS
          </h3>
          <div className="tags-container">
            {result.tags.map((tag: string) => (
              <span key={tag} className="tag">#{tag}</span>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  // Get active plugin badges for header
  const activeContributions = getAllActiveContributions();

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
            {activeContributions.map(contrib => (
              <span key={contrib.pluginId} className="plugin-badge">
                {contrib.pluginName || contrib.id}
              </span>
            ))}
          </h2>

          {activeContributions.length === 0 && (
            <div style={{ padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: '0.5rem', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                No plugins installed. Click the Plugins button to add features!
              </p>
            </div>
          )}

          {/* Render all contribution slots dynamically */}
          {renderSlot('preview.stats')}
          {renderSlot('preview.tags')}
          {renderSlot('preview.main')}
        </div>
      </div>
    </main>
  );
}
