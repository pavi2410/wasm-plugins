/**
 * Plugin Loader using Extension Host pattern (VS Code-style)
 * All plugins run in isolated Web Worker with no DOM access
 *
 * Security: Plugins cannot access DOM, localStorage, cookies, or make
 * arbitrary network requests. They execute in a sandboxed Web Worker.
 */

export class PluginLoader {
  constructor() {
    this.worker = null;
    this.messageId = 0;
    this.pendingMessages = new Map();
    this.loadedPlugins = new Set();

    this.availablePlugins = [
      {
        id: 'markdown-plugin',
        name: 'Markdown Renderer',
        description: 'Convert markdown to HTML with full syntax support',
        features: ['Bold/italic/strikethrough', 'Code blocks', 'Lists & tables', 'Links & images'],
        size: '238 KB',
        url: 'https://pavi2410.github.io/wasm-plugins/plugins/markdown/index.js',
        permissions: ['text.transform']
      },
      {
        id: 'word-counter-plugin',
        name: 'Word Counter',
        description: 'Real-time statistics about your text',
        features: ['Word count', 'Character count', 'Line count', 'Paragraph count'],
        size: '48 KB',
        url: 'https://pavi2410.github.io/wasm-plugins/plugins/word-counter/index.js',
        permissions: ['text.analyze']
      },
      {
        id: 'tag-manager-plugin',
        name: 'Tag Manager',
        description: 'Extract and manage hashtags in your notes',
        features: ['Auto-detect #hashtags', 'Tag filtering', 'Tag normalization'],
        size: '79 KB',
        url: 'https://pavi2410.github.io/wasm-plugins/plugins/tag-manager/index.js',
        permissions: ['text.analyze']
      }
    ];
  }

  /**
   * Initialize extension host worker
   */
  async initializeExtensionHost() {
    if (this.worker) return;

    // Create isolated Web Worker for plugins
    this.worker = new Worker(
      new URL('./extension-host.worker.js', import.meta.url),
      { type: 'module', name: 'extension-host' }
    );

    // Handle messages from worker
    this.worker.onmessage = (event) => {
      const { id, type, result, error } = event.data;
      const pending = this.pendingMessages.get(id);

      if (!pending) return;

      if (type === 'error') {
        pending.reject(new Error(error));
      } else {
        pending.resolve(result);
      }

      this.pendingMessages.delete(id);
    };

    this.worker.onerror = (error) => {
      console.error('Extension host error:', error);
    };
  }

  /**
   * Send message to extension host and wait for response
   */
  async sendMessage(message) {
    if (!this.worker) {
      await this.initializeExtensionHost();
    }

    const id = this.messageId++;

    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { resolve, reject });
      this.worker.postMessage({ id, ...message });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingMessages.has(id)) {
          this.pendingMessages.delete(id);
          reject(new Error('Plugin operation timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Load a plugin into the extension host
   */
  async loadPlugin(pluginId) {
    if (this.loadedPlugins.has(pluginId)) {
      console.log(`✓ Plugin already loaded: ${pluginId}`);
      return;
    }

    // Get plugin metadata with hardcoded URL
    const plugin = this.availablePlugins.find(p => p.id === pluginId);
    if (!plugin) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }

    const pluginUrl = plugin.url;
    console.log(`Loading plugin in worker: ${pluginUrl}`);

    await this.sendMessage({
      type: 'loadPlugin',
      pluginId,
      pluginUrl
    });

    this.loadedPlugins.add(pluginId);
    console.log(`✓ Plugin loaded securely: ${pluginId}`);
  }

  /**
   * Call a plugin method (executes in worker)
   */
  async callPlugin(pluginId, method, ...args) {
    if (!this.loadedPlugins.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} not loaded`);
    }

    // All execution happens in worker - no access to main thread
    const result = await this.sendMessage({
      type: 'callPlugin',
      pluginId,
      method,
      args
    });

    return result;
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId) {
    await this.sendMessage({
      type: 'unloadPlugin',
      pluginId
    });

    this.loadedPlugins.delete(pluginId);
  }

  /**
   * Emit an event to all subscribed plugins
   * @param {string} eventName - Event name (e.g., 'content.changed')
   * @param {any} data - Event data
   * @returns {Promise<Object>} Results from all subscribed plugins, keyed by plugin ID
   */
  async emit(eventName, data) {
    if (!this.worker) {
      await this.initializeExtensionHost();
    }

    const results = await this.sendMessage({
      type: 'emitEvent',
      eventName,
      data
    });

    return results;
  }

  // ===== Installation Management =====

  getInstalledPlugins() {
    const installed = localStorage.getItem('wasm-installed-plugins');
    return installed ? JSON.parse(installed) : [];
  }

  saveInstalledPlugins(pluginIds) {
    localStorage.setItem('wasm-installed-plugins', JSON.stringify(pluginIds));
  }

  isInstalled(pluginId) {
    return this.getInstalledPlugins().includes(pluginId);
  }

  async installPlugin(pluginId) {
    const installed = this.getInstalledPlugins();
    if (!installed.includes(pluginId)) {
      installed.push(pluginId);
      this.saveInstalledPlugins(installed);
    }

    await this.loadPlugin(pluginId);
    return true;
  }

  uninstallPlugin(pluginId) {
    const installed = this.getInstalledPlugins();
    const filtered = installed.filter(id => id !== pluginId);
    this.saveInstalledPlugins(filtered);

    this.unloadPlugin(pluginId);
    return true;
  }

  async loadInstalledPlugins() {
    const installed = this.getInstalledPlugins();
    console.log(`Loading ${installed.length} installed plugins securely...`);

    const results = await Promise.allSettled(
      installed.map(id => this.loadPlugin(id))
    );

    const loaded = results.filter(r => r.status === 'fulfilled').length;
    console.log(`✓ Securely loaded ${loaded}/${installed.length} plugins in worker`);
  }

  getAvailablePlugins() {
    return this.availablePlugins.map(plugin => ({
      ...plugin,
      installed: this.isInstalled(plugin.id),
      loaded: this.loadedPlugins.has(plugin.id)
    }));
  }

  hasPlugin(pluginId) {
    return this.loadedPlugins.has(pluginId);
  }
}
