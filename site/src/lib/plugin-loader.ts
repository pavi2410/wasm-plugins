/**
 * Plugin Loader - Manifest-based plugin system
 * Fetches plugin registry and manifests, loads plugins securely in Web Worker
 *
 * Security: Plugins run in isolated Web Worker with capability-based API access
 */

// ===== Types and Interfaces =====

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  main: string;
  description?: string;
  author?: string;
  permissions: string[];
  contributes: PluginContributes;
  metadata?: {
    features?: string[];
    size?: string;
  };
}

export interface PluginContributes {
  panels?: PanelContribution[];
  statusBar?: StatusBarContribution[];
  commands?: CommandContribution[];
}

export interface PanelContribution {
  id: string;
  title: string;
  viewType: string;
  priority?: number;
  when?: string;
  command: string;
}

export interface StatusBarContribution {
  id: string;
  text: string;
  command: string;
  priority?: number;
}

export interface CommandContribution {
  id: string;
  title: string;
  handler: string;
}

export interface PluginRegistry {
  plugins: Array<{
    id: string;
    manifestUrl: string;
  }>;
}

export interface Contribution extends PanelContribution {
  pluginId: string;
  pluginName?: string;
}

export interface SlotTypeConfig {
  type: 'tabs' | 'single' | 'multiple';
  layout?: 'horizontal' | 'vertical';
  conflict?: 'priority' | 'user-choice';
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  features: string[];
  size: string;
  permissions: string[];
  installed: boolean;
  loaded: boolean;
}

interface PendingMessage {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

// ===== Plugin Loader Class =====

export class PluginLoader {
  private worker: Worker | null = null;
  private messageId: number = 0;
  private pendingMessages: Map<number, PendingMessage> = new Map();

  // Plugin state management
  private registry: PluginRegistry | null = null;
  private manifests: Map<string, PluginManifest> = new Map();
  private loadedPlugins: Set<string> = new Set();
  private contributions: Map<string, Contribution[]> = new Map();

  // Registry URL (can be overridden for testing)
  public registryUrl: string = 'https://pavi2410.github.io/wasm-plugins/plugin-registry.json';

  // Slot type configuration - defines how conflicts are resolved
  public slotTypes: Record<string, SlotTypeConfig> = {
    'preview.main': {
      type: 'tabs',
      layout: 'horizontal'
    },
    'preview.stats': {
      type: 'multiple',
      layout: 'vertical'
    },
    'preview.tags': {
      type: 'multiple',
      layout: 'horizontal'
    },
    'statusBar': {
      type: 'multiple',
      layout: 'horizontal'
    },
    'editor.gutter': {
      type: 'single',
      conflict: 'priority'
    }
  };

  /**
   * Initialize: Fetch plugin registry and all manifests
   */
  async initialize(): Promise<void> {
    try {
      const response = await fetch(this.registryUrl);
      this.registry = await response.json();

      console.log(`📦 Found ${this.registry!.plugins.length} plugins in registry`);

      const manifestPromises = this.registry!.plugins.map(entry =>
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
  async fetchManifest(pluginId: string, manifestUrl: string): Promise<PluginManifest> {
    try {
      const response = await fetch(manifestUrl);
      const manifest: PluginManifest = await response.json();

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
  private validateManifest(manifest: any): manifest is PluginManifest {
    const required = ['id', 'name', 'version', 'main', 'permissions', 'contributes'];
    return required.every(field => manifest.hasOwnProperty(field));
  }

  /**
   * Initialize extension host worker
   */
  private async initializeExtensionHost(): Promise<void> {
    if (this.worker) return;

    this.worker = new Worker(
      new URL('./extension-host.worker.js', import.meta.url),
      { type: 'module', name: 'extension-host' }
    );

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
  private async sendMessage(message: any): Promise<any> {
    if (!this.worker) {
      await this.initializeExtensionHost();
    }

    const id = this.messageId++;

    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { resolve, reject });
      this.worker!.postMessage({ id, ...message });

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
  async installPlugin(pluginId: string): Promise<boolean> {
    const manifest = this.manifests.get(pluginId);
    if (!manifest) {
      throw new Error(`Plugin ${pluginId} not found in registry`);
    }

    const installed = this.getInstalledPlugins();
    if (!installed.includes(pluginId)) {
      installed.push(pluginId);
      this.saveInstalledPlugins(installed);
    }

    await this.loadPlugin(pluginId);
    await this.activatePlugin(pluginId);

    console.log(`✓ Installed: ${manifest.name}`);
    return true;
  }

  /**
   * LIFECYCLE: Load a plugin into the extension host
   */
  async loadPlugin(pluginId: string): Promise<void> {
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
  async activatePlugin(pluginId: string): Promise<void> {
    const manifest = this.manifests.get(pluginId);
    if (!manifest) {
      throw new Error(`No manifest found for ${pluginId}`);
    }

    try {
      await this.sendMessage({
        type: 'activatePlugin',
        pluginId
      });
    } catch (error) {
      console.log(`Plugin ${pluginId} has no activate() method (optional)`);
    }

    this.registerContributions(pluginId, manifest.contributes);

    console.log(`✓ Activated: ${manifest.name}`);
  }

  /**
   * Register plugin contributions from manifest
   */
  private registerContributions(pluginId: string, contributes: PluginContributes): void {
    const manifest = this.manifests.get(pluginId);

    if (contributes.panels) {
      for (const panel of contributes.panels) {
        const viewType = panel.viewType;

        if (!this.contributions.has(viewType)) {
          this.contributions.set(viewType, []);
        }

        this.contributions.get(viewType)!.push({
          pluginId,
          ...panel,
          pluginName: manifest?.name
        });
      }
    }

    if (contributes.statusBar) {
      if (!this.contributions.has('statusBar')) {
        this.contributions.set('statusBar', []);
      }

      for (const item of contributes.statusBar) {
        this.contributions.get('statusBar')!.push({
          pluginId,
          ...item as any,
          pluginName: manifest?.name
        });
      }
    }

    // Sort contributions by priority (higher = first)
    for (const [, contribs] of this.contributions.entries()) {
      contribs.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }
  }

  /**
   * Get all contributions for a specific extension point
   */
  getContributions(viewType: string): Contribution[] {
    return this.contributions.get(viewType) || [];
  }

  /**
   * Execute a contribution's command
   */
  async executeContribution(pluginId: string, commandId: string, data: any): Promise<any> {
    const manifest = this.manifests.get(pluginId);
    if (!manifest) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    const command = manifest.contributes.commands?.find(cmd => cmd.id === commandId);
    if (!command) {
      throw new Error(`Command ${commandId} not found in ${pluginId}`);
    }

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
  async deactivatePlugin(pluginId: string): Promise<void> {
    try {
      await this.sendMessage({
        type: 'deactivatePlugin',
        pluginId
      });
    } catch (error) {
      console.log(`Plugin ${pluginId} has no deactivate() method (optional)`);
    }

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
  async unloadPlugin(pluginId: string): Promise<void> {
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
  async uninstallPlugin(pluginId: string): Promise<boolean> {
    if (this.loadedPlugins.has(pluginId)) {
      await this.deactivatePlugin(pluginId);
      await this.unloadPlugin(pluginId);
    }

    const installed = this.getInstalledPlugins();
    const filtered = installed.filter(id => id !== pluginId);
    this.saveInstalledPlugins(filtered);

    console.log(`✓ Uninstalled: ${pluginId}`);
    return true;
  }

  /**
   * Load all installed plugins
   */
  async loadInstalledPlugins(): Promise<void> {
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

  getInstalledPlugins(): string[] {
    const installed = localStorage.getItem('wasm-installed-plugins');
    return installed ? JSON.parse(installed) : [];
  }

  private saveInstalledPlugins(pluginIds: string[]): void {
    localStorage.setItem('wasm-installed-plugins', JSON.stringify(pluginIds));
  }

  isInstalled(pluginId: string): boolean {
    return this.getInstalledPlugins().includes(pluginId);
  }

  /**
   * Get available plugins from registry with install status
   */
  getAvailablePlugins(): PluginInfo[] {
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

  hasPlugin(pluginId: string): boolean {
    return this.loadedPlugins.has(pluginId);
  }

  /**
   * Legacy API for backward compatibility (deprecated)
   */
  async emit(eventName: string, data: any): Promise<Record<string, any>> {
    console.warn('emit() is deprecated, use contributions API instead');
    const results: Record<string, any> = {};

    for (const [, contribs] of this.contributions.entries()) {
      for (const contrib of contribs) {
        try {
          const result = await this.executeContribution(
            contrib.pluginId,
            contrib.command,
            data
          );
          results[contrib.pluginId] = result;
        } catch (error: any) {
          results[contrib.pluginId] = { error: error.message };
        }
      }
    }

    return results;
  }

  /**
   * Legacy callPlugin for backward compatibility (deprecated)
   */
  async callPlugin(pluginId: string, method: string, ...args: any[]): Promise<any> {
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
