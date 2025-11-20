import { useState, useEffect } from 'react';
import type { PluginLoader, PluginInfo } from '@/lib/plugin-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { X, Package, Download, Trash2, Check, Loader2, Shield } from 'lucide-react';

interface PluginStoreProps {
  pluginLoader: PluginLoader;
  onClose: () => void;
}

export default function PluginStore({ pluginLoader, onClose }: PluginStoreProps) {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    refreshPlugins();
  }, []);

  const refreshPlugins = () => {
    const available = pluginLoader.getAvailablePlugins();
    setPlugins(available);
  };

  const handleInstall = async (pluginId: string) => {
    setLoading({ ...loading, [pluginId]: true });
    try {
      await pluginLoader.installPlugin(pluginId);
      refreshPlugins();
    } catch (error) {
      console.error('Failed to install plugin:', error);
      alert('Failed to install plugin. Check console for details.');
    }
    setLoading({ ...loading, [pluginId]: false });
  };

  const handleUninstall = async (pluginId: string) => {
    if (!confirm('Are you sure you want to uninstall this plugin?')) return;

    setLoading({ ...loading, [pluginId]: true });
    try {
      await pluginLoader.uninstallPlugin(pluginId);
      refreshPlugins();
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
      alert('Failed to uninstall plugin. Check console for details.');
    }
    setLoading({ ...loading, [pluginId]: false });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Plugin Store</h2>
                <p className="text-sm text-muted-foreground">
                  Extend your notes app with powerful plugins
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="px-8 py-6">
          {plugins.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">No Plugins Available</h3>
              <p className="text-sm text-muted-foreground">
                Check back later for new plugins
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {plugins.map((plugin) => (
                <Card
                  key={plugin.id}
                  className={`transition-all duration-200 hover:shadow-lg ${
                    plugin.installed ? 'border-primary/50 bg-primary/5' : ''
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                          {plugin.name.charAt(0)}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{plugin.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">v{plugin.version}</p>
                        </div>
                      </div>
                      {plugin.installed && (
                        <Badge variant="default" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Installed
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2">
                      {plugin.description || 'No description available'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Features */}
                    {plugin.features.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase">
                          Features
                        </h4>
                        <ul className="space-y-1">
                          {plugin.features.slice(0, 3).map((feature, idx) => (
                            <li key={idx} className="text-xs flex items-start gap-2">
                              <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                              <span className="text-foreground/80">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Permissions */}
                    {plugin.permissions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          Permissions
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {plugin.permissions.slice(0, 3).map((perm, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {perm}
                            </Badge>
                          ))}
                          {plugin.permissions.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{plugin.permissions.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {plugin.author && (
                        <span>
                          By <span className="font-medium text-foreground">{plugin.author}</span>
                        </span>
                      )}
                      <span>•</span>
                      <span>{plugin.size}</span>
                    </div>
                  </CardContent>

                  <CardFooter>
                    {plugin.installed ? (
                      <Button
                        onClick={() => handleUninstall(plugin.id)}
                        variant="destructive"
                        className="w-full"
                        disabled={loading[plugin.id]}
                      >
                        {loading[plugin.id] ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uninstalling...
                          </>
                        ) : (
                          <>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Uninstall
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleInstall(plugin.id)}
                        className="w-full"
                        disabled={loading[plugin.id]}
                      >
                        {loading[plugin.id] ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Installing...
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Install
                          </>
                        )}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
