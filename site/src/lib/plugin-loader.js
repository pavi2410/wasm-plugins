/**
 * WASM Plugin Loader with Installation Management
 * Manages loading, installation, and interaction with WASM plugins
 */

export class PluginLoader {
  constructor() {
    this.plugins = new Map(); // Loaded plugin instances
    this.availablePlugins = [
      {
        id: 'markdown-plugin',
        name: 'Markdown Renderer',
        description: 'Convert markdown to HTML with full syntax support',
        features: ['Bold/italic/strikethrough', 'Code blocks', 'Lists & tables', 'Links & images'],
        size: '238 KB'
      },
      {
        id: 'word-counter-plugin',
        name: 'Word Counter',
        description: 'Real-time statistics about your text',
        features: ['Word count', 'Character count', 'Line count', 'Paragraph count'],
        size: '48 KB'
      },
      {
        id: 'tag-manager-plugin',
        name: 'Tag Manager',
        description: 'Extract and manage hashtags in your notes',
        features: ['Auto-detect #hashtags', 'Tag filtering', 'Tag normalization'],
        size: '79 KB'
      }
    ];
  }

  /**
   * Get list of installed plugin IDs from localStorage
   */
  getInstalledPlugins() {
    const installed = localStorage.getItem('wasm-installed-plugins');
    return installed ? JSON.parse(installed) : [];
  }

  /**
   * Save installed plugins to localStorage
   */
  saveInstalledPlugins(pluginIds) {
    localStorage.setItem('wasm-installed-plugins', JSON.stringify(pluginIds));
  }

  /**
   * Check if a plugin is installed
   */
  isInstalled(pluginId) {
    return this.getInstalledPlugins().includes(pluginId);
  }

  /**
   * Install a plugin
   */
  async installPlugin(pluginId) {
    const installed = this.getInstalledPlugins();
    if (!installed.includes(pluginId)) {
      installed.push(pluginId);
      this.saveInstalledPlugins(installed);
    }

    // Load the plugin immediately after installing
    await this.loadPlugin(pluginId);
    return true;
  }

  /**
   * Uninstall a plugin
   */
  uninstallPlugin(pluginId) {
    const installed = this.getInstalledPlugins();
    const filtered = installed.filter(id => id !== pluginId);
    this.saveInstalledPlugins(filtered);

    // Remove from loaded plugins
    this.plugins.delete(pluginId);
    return true;
  }

  /**
   * Load a WASM plugin
   * @param {string} pluginId - Plugin ID
   */
  async loadPlugin(pluginId) {
    if (this.plugins.has(pluginId)) {
      console.log(`✓ Plugin already loaded: ${pluginId}`);
      return this.plugins.get(pluginId);
    }

    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const pluginPath = baseUrl.endsWith('/') ? `${baseUrl}plugins` : `${baseUrl}/plugins`;

      // Directory name: remove '-plugin' suffix (e.g., 'markdown-plugin' -> 'markdown')
      const pluginDir = pluginId.replace('-plugin', '');
      // File name: replace '-' with '_' (e.g., 'markdown-plugin' -> 'markdown_plugin')
      const pluginFile = pluginId.replace('-plugin', '_plugin');
      const pluginUrl = `${pluginPath}/${pluginDir}/${pluginFile}.js`;

      console.log(`Loading plugin from: ${pluginUrl}`);

      // Import the JS glue code
      const module = await import(/* @vite-ignore */ pluginUrl);

      // Initialize the WASM module
      await module.default();

      // Store the plugin
      this.plugins.set(pluginId, module);

      console.log(`✓ Loaded plugin: ${pluginId}`);
      return module;
    } catch (error) {
      console.error(`✗ Failed to load plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Load only installed plugins
   */
  async loadInstalledPlugins() {
    const installed = this.getInstalledPlugins();
    console.log(`Loading ${installed.length} installed plugins...`);

    const results = await Promise.allSettled(
      installed.map(id => this.loadPlugin(id))
    );

    const loaded = results.filter(r => r.status === 'fulfilled').length;
    console.log(`Successfully loaded ${loaded}/${installed.length} plugins`);

    return this.plugins;
  }

  /**
   * Get available plugins list
   */
  getAvailablePlugins() {
    return this.availablePlugins.map(plugin => ({
      ...plugin,
      installed: this.isInstalled(plugin.id),
      loaded: this.plugins.has(plugin.id)
    }));
  }

  /**
   * Get a loaded plugin
   * @param {string} pluginId - Plugin ID
   */
  getPlugin(pluginId) {
    return this.plugins.get(pluginId);
  }

  /**
   * Check if a plugin is loaded
   * @param {string} pluginId - Plugin ID
   */
  hasPlugin(pluginId) {
    return this.plugins.has(pluginId);
  }
}
