import { useState, useEffect } from 'react';
import type { PluginLoader } from '../lib/plugin-loader';

interface PluginManagerProps {
  pluginLoader: PluginLoader;
  onClose: () => void;
  onPluginChange: () => void;
}

export default function PluginManager({ pluginLoader, onClose, onPluginChange }: PluginManagerProps) {
  const [plugins, setPlugins] = useState(pluginLoader.getAvailablePlugins());
  const [loading, setLoading] = useState<string | null>(null);

  const refreshPlugins = () => {
    setPlugins(pluginLoader.getAvailablePlugins());
  };

  const handleInstall = async (pluginId: string) => {
    setLoading(pluginId);
    try {
      await pluginLoader.installPlugin(pluginId);
      refreshPlugins();
      onPluginChange();
    } catch (error) {
      console.error('Failed to install plugin:', error);
      alert('Failed to install plugin. Check console for details.');
    } finally {
      setLoading(null);
    }
  };

  const handleUninstall = (pluginId: string) => {
    pluginLoader.uninstallPlugin(pluginId);
    refreshPlugins();
    onPluginChange();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Plugin Manager</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="plugins-grid">
            {plugins.map(plugin => (
              <div key={plugin.id} className={`plugin-card ${plugin.installed ? 'installed' : ''}`}>
                <div className="plugin-info">
                  <h3>{plugin.name}</h3>
                  <p className="plugin-description">{plugin.description}</p>
                  <ul className="plugin-features">
                    {plugin.features.map((feature, idx) => (
                      <li key={idx}>{feature}</li>
                    ))}
                  </ul>
                  <span className="plugin-size">{plugin.size}</span>
                </div>
                <div className="plugin-actions">
                  {plugin.installed ? (
                    <>
                      <span className="plugin-status">✓ Installed</span>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleUninstall(plugin.id)}
                        disabled={loading !== null}
                      >
                        Uninstall
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleInstall(plugin.id)}
                      disabled={loading !== null}
                    >
                      {loading === plugin.id ? 'Installing...' : 'Install'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
