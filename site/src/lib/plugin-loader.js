/**
 * Plugin Loader - Manifest-based plugin system
 * Fetches plugin registry and manifests, loads plugins securely in Web Worker
 *
 * Security: Plugins run in isolated Web Worker with capability-based API access
 */

export class PluginLoader {
  constructor() {
    this.worker = null;
    this.messageId = 0;
    this.pendingMessages = new Map();

    // Plugin state management
    this.registry = null;
    this.manifests = new Map();  // pluginId -> manifest
    this.loadedPlugins = new Set();  // Plugins currently loaded in worker
    this.contributions = new Map();  // extensionPoint -> [contributions]

    // Registry URL (can be overridden for testing)
    this.registryUrl = 'https://pavi2410.github.io/wasm-plugins/plugin-registry.json';
  }

  /**
   * Initialize: Fetch plugin registry and all manifests
   */
  async initialize() {
    try {
      // Fetch plugin registry
      const response = await fetch(this.registryUrl);
      this.registry = await response.json();

      console.log(`📦 Found ${this.registry.plugins.length} plugins in registry`);

      // Fetch all manifests
      const manifestPromises = this.registry.plugins.map(entry =>
        this.fetchManifest(entry.id, entry.manifestUrl)
      );

      await Promise.allSettled(manifestPromises);

      console.log(`✓ Loaded ${this.manifests.size} plugin manifests`);
    } catch (error) {
      console.error('Failed to initialize plugin registry:', error);
    }
  }

  /**
   * Fetch and validate a plugin manifest
   */
  async fetchManifest(pluginId, manifestUrl) {
    try {
      const response = await fetch(manifestUrl);
      const manifest = await response.json();

      // Validate manifest structure
      if (!this.validateManifest(manifest)) {
        throw new Error(`Invalid manifest for ${pluginId}`);
      }

      this.manifests.set(pluginId, manifest);
      console.log(`✓ Loaded manifest: ${manifest.name} v${manifest.version}`);

      return manifest;
    } catch (error) {
      console.error(`Failed to load manifest for ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Validate manifest structure
   */
  validateManifest(manifest) {
    const required = ['id', 'name', 'version', 'main', 'permissions', 'contributes'];
    return required.every(field => manifest.hasOwnProperty(field));
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
   * LIFECYCLE: Install a plugin
   */
  async installPlugin(pluginId) {
    const manifest = this.manifests.get(pluginId);
    if (!manifest) {
      throw new Error(`Plugin ${pluginId} not found in registry`);
    }

    // Save to installed list
    const installed = this.getInstalledPlugins();
    if (!installed.includes(pluginId)) {
      installed.push(pluginId);
      this.saveInstalledPlugins(installed);
    }

    // Load and activate
    await this.loadPlugin(pluginId);
    await this.activatePlugin(pluginId);

    console.log(`✓ Installed: ${manifest.name}`);
    return true;
  }

  /**
   * LIFECYCLE: Load a plugin into the extension host
   */
  async loadPlugin(pluginId) {
    if (this.loadedPlugins.has(pluginId)) {
      console.log(`✓ Plugin already loaded: ${pluginId}`);
      return;
    }

    const manifest = this.manifests.get(pluginId);
    if (!manifest) {
      throw new Error(`No manifest found for ${pluginId}`);
    }

    const pluginUrl = manifest.main;
    console.log(`Loading plugin in worker: ${manifest.name}`);

    await this.sendMessage({
      type: 'loadPlugin',
      pluginId,
      pluginUrl,
      permissions: manifest.permissions
    });

    this.loadedPlugins.add(pluginId);
    console.log(`✓ Plugin loaded: ${manifest.name}`);
  }

  /**
   * LIFECYCLE: Activate a plugin (register contributions)
   */
  async activatePlugin(pluginId) {
    const manifest = this.manifests.get(pluginId);
    if (!manifest) {
      throw new Error(`No manifest found for ${pluginId}`);
    }

    // Call activate() lifecycle method if exists
    try {
      await this.sendMessage({
        type: 'activatePlugin',
        pluginId
      });
    } catch (error) {
      console.log(`Plugin ${pluginId} has no activate() method (optional)`);
    }

    // Register contributions from manifest
    this.registerContributions(pluginId, manifest.contributes);

    console.log(`✓ Activated: ${manifest.name}`);
  }

  /**
   * Register plugin contributions from manifest
   */
  registerContributions(pluginId, contributes) {
    const manifest = this.manifests.get(pluginId);

    // Register panels
    if (contributes.panels) {
      for (const panel of contributes.panels) {
        const viewType = panel.viewType;

        if (!this.contributions.has(viewType)) {
          this.contributions.set(viewType, []);
        }

        this.contributions.get(viewType).push({
          pluginId,
          ...panel,
          pluginName: manifest.name
        });
      }
    }

    // Register status bar items
    if (contributes.statusBar) {
      if (!this.contributions.has('statusBar')) {
        this.contributions.set('statusBar', []);
      }

      for (const item of contributes.statusBar) {
        this.contributions.get('statusBar').push({
          pluginId,
          ...item,
          pluginName: manifest.name
        });
      }
    }

    // Sort contributions by priority (higher = first)
    for (const [viewType, contribs] of this.contributions.entries()) {
      contribs.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }
  }

  /**
   * Get all contributions for a specific extension point
   */
  getContributions(viewType) {
    return this.contributions.get(viewType) || [];
  }

  /**
   * Execute a contribution's command
   */
  async executeContribution(pluginId, commandId, data) {
    const manifest = this.manifests.get(pluginId);
    if (!manifest) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Find command handler
    const command = manifest.contributes.commands?.find(cmd => cmd.id === commandId);
    if (!command) {
      throw new Error(`Command ${commandId} not found in ${pluginId}`);
    }

    // Call the handler function
    const result = await this.sendMessage({
      type: 'callPlugin',
      pluginId,
      method: command.handler,
      args: [data]
    });

    return result;
  }

  /**
   * LIFECYCLE: Deactivate a plugin
   */
  async deactivatePlugin(pluginId) {
    // Call deactivate() lifecycle method if exists
    try {
      await this.sendMessage({
        type: 'deactivatePlugin',
        pluginId
      });
    } catch (error) {
      console.log(`Plugin ${pluginId} has no deactivate() method (optional)`);
    }

    // Unregister contributions
    for (const [viewType, contribs] of this.contributions.entries()) {
      this.contributions.set(
        viewType,
        contribs.filter(c => c.pluginId !== pluginId)
      );
    }

    console.log(`✓ Deactivated: ${pluginId}`);
  }

  /**
   * LIFECYCLE: Unload a plugin
   */
  async unloadPlugin(pluginId) {
    await this.sendMessage({
      type: 'unloadPlugin',
      pluginId
    });

    this.loadedPlugins.delete(pluginId);
    console.log(`✓ Unloaded: ${pluginId}`);
  }

  /**
   * LIFECYCLE: Uninstall a plugin
   */
  async uninstallPlugin(pluginId) {
    // Deactivate and unload
    if (this.loadedPlugins.has(pluginId)) {
      await this.deactivatePlugin(pluginId);
      await this.unloadPlugin(pluginId);
    }

    // Remove from installed list
    const installed = this.getInstalledPlugins();
    const filtered = installed.filter(id => id !== pluginId);
    this.saveInstalledPlugins(filtered);

    console.log(`✓ Uninstalled: ${pluginId}`);
    return true;
  }

  /**
   * Load all installed plugins
   */
  async loadInstalledPlugins() {
    const installed = this.getInstalledPlugins();
    console.log(`Loading ${installed.length} installed plugins...`);

    for (const pluginId of installed) {
      try {
        await this.loadPlugin(pluginId);
        await this.activatePlugin(pluginId);
      } catch (error) {
        console.error(`Failed to load ${pluginId}:`, error);
      }
    }

    console.log(`✓ Loaded ${this.loadedPlugins.size} plugins`);
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

  /**
   * Get available plugins from registry with install status
   */
  getAvailablePlugins() {
    return Array.from(this.manifests.values()).map(manifest => ({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      features: manifest.metadata?.features || [],
      size: manifest.metadata?.size || 'Unknown',
      permissions: manifest.permissions,
      installed: this.isInstalled(manifest.id),
      loaded: this.loadedPlugins.has(manifest.id)
    }));
  }

  hasPlugin(pluginId) {
    return this.loadedPlugins.has(pluginId);
  }

  /**
   * Legacy API for backward compatibility (deprecated)
   */
  async emit(eventName, data) {
    console.warn('emit() is deprecated, use contributions API instead');
    const results = {};

    // Find all contributions that respond to this event
    for (const [viewType, contribs] of this.contributions.entries()) {
      for (const contrib of contribs) {
        try {
          const result = await this.executeContribution(
            contrib.pluginId,
            contrib.command,
            data
          );
          results[contrib.pluginId] = result;
        } catch (error) {
          results[contrib.pluginId] = { error: error.message };
        }
      }
    }

    return results;
  }

  /**
   * Legacy callPlugin for backward compatibility (deprecated)
   */
  async callPlugin(pluginId, method, ...args) {
    console.warn('callPlugin() is deprecated, use executeContribution() instead');

    if (!this.loadedPlugins.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} not loaded`);
    }

    return await this.sendMessage({
      type: 'callPlugin',
      pluginId,
      method,
      args
    });
  }
}
