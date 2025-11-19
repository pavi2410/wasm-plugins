/**
 * Extension Host - Runs all plugin code in isolated Web Worker
 * No DOM access, controlled API surface, capability-based permissions
 */

let loadedPlugins = new Map();  // pluginId -> module
let pluginPermissions = new Map();  // pluginId -> [permissions]

/**
 * Host API - Capability-based access control
 * Plugins can only call APIs they have permission for
 */
const HOST_API = {
  'text.read': {
    getContent: () => {
      // Would get from main thread
      return self._currentContent || '';
    },
    getSelection: () => {
      return self._currentSelection || '';
    }
  },

  'text.transform': {
    replaceContent: (newContent) => {
      // Send to main thread
      self.postMessage({
        type: 'api_call',
        api: 'text.replaceContent',
        args: [newContent]
      });
    },
    insertAtCursor: (text) => {
      self.postMessage({
        type: 'api_call',
        api: 'text.insertAtCursor',
        args: [text]
      });
    }
  },

  'ui.panel': {
    updatePanel: (panelId, html) => {
      self.postMessage({
        type: 'api_call',
        api: 'ui.updatePanel',
        args: [panelId, html]
      });
    }
  },

  'ui.statusBar': {
    updateStatusBar: (itemId, text) => {
      self.postMessage({
        type: 'api_call',
        api: 'ui.updateStatusBar',
        args: [itemId, text]
      });
    }
  },

  'storage.local': {
    get: async (key) => {
      // Would communicate with main thread
      return null;
    },
    set: async (key, value) => {
      // Would communicate with main thread
    }
  }
};

/**
 * Create scoped API for a plugin based on its permissions
 */
function createPluginAPI(permissions) {
  const scopedAPI = {};

  for (const perm of permissions) {
    const api = HOST_API[perm];
    if (api) {
      // Create namespace
      const [namespace, capability] = perm.split('.');
      if (!scopedAPI[namespace]) {
        scopedAPI[namespace] = {};
      }
      Object.assign(scopedAPI[namespace], api);
    }
  }

  return scopedAPI;
}

/**
 * Message handler
 */
self.onmessage = async (event) => {
  const { id, type, pluginId, method, args, permissions } = event.data;

  try {
    switch (type) {
      case 'loadPlugin': {
        const { pluginUrl } = event.data;

        // Load WASM module in worker
        const module = await import(/* @vite-ignore */ pluginUrl);
        await module.default();

        loadedPlugins.set(pluginId, module);
        pluginPermissions.set(pluginId, permissions || []);

        console.log(`[ExtensionHost] Loaded plugin: ${pluginId}`);
        self.postMessage({ id, type: 'success' });
        break;
      }

      case 'activatePlugin': {
        const plugin = loadedPlugins.get(pluginId);
        if (!plugin) {
          throw new Error(`Plugin ${pluginId} not loaded`);
        }

        // Call activate() lifecycle method if it exists
        if (typeof plugin.activate === 'function') {
          const perms = pluginPermissions.get(pluginId) || [];
          const pluginAPI = createPluginAPI(perms);

          // Make API available to plugin (simplified - would use more secure injection)
          self.pluginAPI = pluginAPI;

          await plugin.activate();

          console.log(`[ExtensionHost] Activated plugin: ${pluginId}`);
        }

        self.postMessage({ id, type: 'success' });
        break;
      }

      case 'deactivatePlugin': {
        const plugin = loadedPlugins.get(pluginId);
        if (!plugin) {
          throw new Error(`Plugin ${pluginId} not loaded`);
        }

        // Call deactivate() lifecycle method if it exists
        if (typeof plugin.deactivate === 'function') {
          await plugin.deactivate();
          console.log(`[ExtensionHost] Deactivated plugin: ${pluginId}`);
        }

        self.postMessage({ id, type: 'success' });
        break;
      }

      case 'callPlugin': {
        const plugin = loadedPlugins.get(pluginId);
        if (!plugin) {
          throw new Error(`Plugin ${pluginId} not loaded`);
        }

        // Set up scoped API for this call
        const perms = pluginPermissions.get(pluginId) || [];
        const pluginAPI = createPluginAPI(perms);
        self.pluginAPI = pluginAPI;

        // Execute plugin method (sandboxed in worker)
        const result = await plugin[method](...args);

        self.postMessage({ id, type: 'result', result });
        break;
      }

      case 'unloadPlugin': {
        loadedPlugins.delete(pluginId);
        pluginPermissions.delete(pluginId);

        console.log(`[ExtensionHost] Unloaded plugin: ${pluginId}`);
        self.postMessage({ id, type: 'success' });
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      error: error.message
    });
  }
};

// Plugin environment validation
self.addEventListener('error', (event) => {
  console.error('[ExtensionHost] Plugin error:', event.error);
});
