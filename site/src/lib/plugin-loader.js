/**
 * WASM Plugin Loader
 * Manages loading and interaction with WASM plugins
 */

export class PluginLoader {
  constructor() {
    this.plugins = new Map();
  }

  /**
   * Load a WASM plugin
   * @param {string} name - Plugin name
   * @param {string} path - Path to the plugin directory
   */
  async loadPlugin(name, path) {
    try {
      // Import the JS glue code
      const module = await import(path + `/${name}.js`);

      // Initialize the WASM module
      await module.default();

      // Store the plugin
      this.plugins.set(name, module);

      console.log(`✓ Loaded plugin: ${name}`);
      return module;
    } catch (error) {
      console.error(`✗ Failed to load plugin ${name}:`, error);
      throw error;
    }
  }

  /**
   * Load all plugins
   */
  async loadAllPlugins() {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const pluginPath = baseUrl.endsWith('/') ? `${baseUrl}plugins` : `${baseUrl}/plugins`;

    const plugins = [
      'markdown-plugin',
      'word-counter-plugin',
      'tag-manager-plugin'
    ];

    const results = await Promise.allSettled(
      plugins.map(name => this.loadPlugin(name, pluginPath))
    );

    const loaded = results.filter(r => r.status === 'fulfilled').length;
    console.log(`Loaded ${loaded}/${plugins.length} plugins`);

    return this.plugins;
  }

  /**
   * Get a loaded plugin
   * @param {string} name - Plugin name
   */
  getPlugin(name) {
    return this.plugins.get(name);
  }

  /**
   * Check if a plugin is loaded
   * @param {string} name - Plugin name
   */
  hasPlugin(name) {
    return this.plugins.has(name);
  }
}
