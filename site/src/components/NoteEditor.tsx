import { useState, useEffect } from 'react';
import type { PluginLoader } from '@/lib/plugin-loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, FileText, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Note {
  id: number;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
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
        const pluginResults = await pluginLoader.emit('content.changed', { content });

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

  const getContributions = (viewType: string) => {
    return pluginLoader.getContributions(viewType);
  };

  const getAllActiveContributions = () => {
    const allContribs = [];
    for (const viewType of ['preview.main', 'preview.stats', 'preview.tags', 'statusBar']) {
      allContribs.push(...getContributions(viewType));
    }
    return allContribs;
  };

  const renderSlot = (viewType: string) => {
    const contributions = getContributions(viewType);

    if (contributions.length === 0) {
      return null;
    }

    const slotConfig = (pluginLoader as any).slotTypes[viewType] || { type: 'multiple', layout: 'horizontal' };

    // Handle 'tabs' type
    if (slotConfig.type === 'tabs') {
      if (contributions.length === 1) {
        return renderContribution(contributions[0]);
      }

      const currentTab = activeTab || contributions[0].pluginId;
      const activeContribution = contributions.find(c => c.pluginId === currentTab);

      return (
        <Tabs value={currentTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start h-auto p-1">
            {contributions.map(contrib => (
              <TabsTrigger
                key={contrib.pluginId}
                value={contrib.pluginId}
                className="data-[state=active]:bg-background"
              >
                {contrib.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {contributions.map(contrib => (
            <TabsContent
              key={contrib.pluginId}
              value={contrib.pluginId}
              className="mt-4 animate-fade-in"
            >
              {renderContribution(contrib)}
            </TabsContent>
          ))}
        </Tabs>
      );
    }

    // Handle 'single' type
    if (slotConfig.type === 'single') {
      return renderContribution(contributions[0]);
    }

    // Handle 'multiple' type
    if (slotConfig.type === 'multiple') {
      const layout = slotConfig.layout || 'vertical';
      return (
        <div className={cn(
          "flex gap-4",
          layout === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'
        )}>
          {contributions.map(contrib => (
            <div key={contrib.pluginId} className="flex-1 min-w-0">
              {renderContribution(contrib)}
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  const renderContribution = (contribution: any) => {
    const result = contributionResults.get(contribution.pluginId);

    if (!result) {
      return null;
    }

    const resultType = result.type;

    // Render based on result type
    if (resultType === 'render' && result.html) {
      return (
        <div
          className="prose prose-sm dark:prose-invert max-w-none p-6 bg-card rounded-lg border border-border"
          dangerouslySetInnerHTML={{ __html: result.html }}
        />
      );
    }

    if (resultType === 'stats' && result.stats) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-card rounded-lg border border-border">
          <div className="text-center p-3 bg-background rounded-md">
            <div className="text-2xl font-bold text-primary">{result.stats.words}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Words</div>
          </div>
          <div className="text-center p-3 bg-background rounded-md">
            <div className="text-2xl font-bold text-primary">{result.stats.characters}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Characters</div>
          </div>
          <div className="text-center p-3 bg-background rounded-md">
            <div className="text-2xl font-bold text-primary">{result.stats.lines}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Lines</div>
          </div>
          <div className="text-center p-3 bg-background rounded-md">
            <div className="text-2xl font-bold text-primary">{result.stats.paragraphs}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Paragraphs</div>
          </div>
        </div>
      );
    }

    if (resultType === 'tags' && result.tags && result.tags.length > 0) {
      return (
        <div className="p-4 bg-card rounded-lg border border-border">
          <h3 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
            Tags
          </h3>
          <div className="flex flex-wrap gap-2">
            {result.tags.map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                #{tag}
              </Badge>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  const activeContributions = getAllActiveContributions();

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card px-8 py-4">
        <div className="flex items-center justify-between mb-3">
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled Note"
            className="text-2xl font-bold border-none bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-auto py-0"
          />
          <Button variant="destructive" size="sm" onClick={() => onDeleteNote(note.id)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>

        {activeContributions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Active plugins:</span>
            {activeContributions.map(contrib => (
              <Badge key={contrib.pluginId} variant="outline" className="text-xs">
                {contrib.pluginName || contrib.id}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Editor and Preview Split */}
      <div className="flex-1 grid grid-cols-2 overflow-hidden">
        {/* Editor Pane */}
        <div className="flex flex-col border-r border-border bg-background">
          <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-card">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Editor</h3>
          </div>
          <div className="flex-1 overflow-hidden p-6">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing your note..."
              className="w-full h-full bg-transparent resize-none border-none outline-none text-sm font-mono leading-relaxed"
            />
          </div>
        </div>

        {/* Preview Pane */}
        <div className="flex flex-col overflow-hidden bg-background">
          <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-card">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Preview</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {activeContributions.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <Eye className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="text-lg font-semibold mb-2">No Plugins Installed</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Install plugins from the Plugin Store to see your notes come to life with previews, stats, and more!
                  </p>
                </div>
              </div>
            ) : (
              <>
                {renderSlot('preview.stats')}
                {renderSlot('preview.tags')}
                {renderSlot('preview.main')}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
