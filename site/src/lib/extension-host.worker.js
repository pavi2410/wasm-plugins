/**
 * Extension Host - Runs all plugin code in isolated Web Worker
 * No DOM access, controlled API surface, capability-based permissions
 * Runtime command registration for dynamic plugin behavior
 */

let loadedPlugins = new Map();  // pluginId -> module
let pluginPermissions = new Map();  // pluginId -> [permissions]
let commandRegistry = new Map();  // commandId -> {pluginId, handler}
let eventRegistry = new Map();  // eventName -> Map<pluginId, handler>

/**
 * Host API - Capability-based access control
 * Plugins can only call APIs they have permission for
 */
const HOST_API = {
  'text.read': {
    getContent: () => {
      return self._currentContent || '';
    },
    getSelection: () => {
      return self._currentSelection || '';
    }
  },

  'text.transform': {
    replaceContent: (newContent) => {
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
  }
};

/**
 * Create scoped API for a plugin based on its permissions
 */
function createPluginAPI(pluginId, permissions) {
  const scopedAPI = {};

  // Add host APIs based on permissions
  for (const perm of permissions) {
    const api = HOST_API[perm];
    if (api) {
      const [namespace, capability] = perm.split('.');
      if (!scopedAPI[namespace]) {
        scopedAPI[namespace] = {};
      }
      Object.assign(scopedAPI[namespace], api);
    }
  }

  // Add runtime registration APIs (always available)
  scopedAPI.registerCommand = (commandId, handler) => {
    if (commandRegistry.has(commandId)) {
      console.warn(`[ExtensionHost] Command ${commandId} already registered, overwriting`);
    }
    commandRegistry.set(commandId, { pluginId, handler });
    console.log(`[ExtensionHost] Plugin ${pluginId} registered command: ${commandId}`);
  };

  scopedAPI.registerEvent = (eventName, handler) => {
    if (!eventRegistry.has(eventName)) {
      eventRegistry.set(eventName, new Map());
    }
    eventRegistry.get(eventName).set(pluginId, handler);
    console.log(`[ExtensionHost] Plugin ${pluginId} subscribed to event: ${eventName}`);
  };

  scopedAPI.unregisterCommand = (commandId) => {
    const entry = commandRegistry.get(commandId);
    if (entry && entry.pluginId === pluginId) {
      commandRegistry.delete(commandId);
      console.log(`[ExtensionHost] Plugin ${pluginId} unregistered command: ${commandId}`);
    }
  };

  scopedAPI.unregisterEvent = (eventName) => {
    const handlers = eventRegistry.get(eventName);
    if (handlers) {
      handlers.delete(pluginId);
      console.log(`[ExtensionHost] Plugin ${pluginId} unsubscribed from event: ${eventName}`);
    }
  };

  return scopedAPI;
}

/**
 * Message handler
 */
self.onmessage = async (event) => {
  const { id, type, pluginId, method, args, permissions, commandId, eventName, data } = event.data;

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
          const pluginAPI = createPluginAPI(pluginId, perms);

          // Make API available to plugin
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

        // Clean up registrations
        for (const [cmdId, entry] of commandRegistry.entries()) {
          if (entry.pluginId === pluginId) {
            commandRegistry.delete(cmdId);
          }
        }

        for (const [evtName, handlers] of eventRegistry.entries()) {
          handlers.delete(pluginId);
        }

        self.postMessage({ id, type: 'success' });
        break;
      }

      case 'executeCommand': {
        const entry = commandRegistry.get(commandId);
        if (!entry) {
          throw new Error(`Command ${commandId} not registered`);
        }

        // Set up scoped API for this call
        const perms = pluginPermissions.get(entry.pluginId) || [];
        const pluginAPI = createPluginAPI(entry.pluginId, perms);
        self.pluginAPI = pluginAPI;

        // Execute command handler
        const result = await entry.handler(data);

        self.postMessage({ id, type: 'result', result });
        break;
      }

      case 'emitEvent': {
        const handlers = eventRegistry.get(eventName);
        const results = {};

        if (handlers) {
          // Execute all handlers for this event
          const promises = Array.from(handlers.entries()).map(async ([pid, handler]) => {
            try {
              // Set up scoped API
              const perms = pluginPermissions.get(pid) || [];
              const pluginAPI = createPluginAPI(pid, perms);
              self.pluginAPI = pluginAPI;

              const result = await handler(data);
              return { pluginId: pid, result };
            } catch (error) {
              console.error(`[ExtensionHost] Plugin ${pid} error handling ${eventName}:`, error);
              return { pluginId: pid, error: error.message };
            }
          });

          const responses = await Promise.all(promises);

          // Organize results by plugin ID
          for (const { pluginId: pid, result, error } of responses) {
            results[pid] = error ? { error } : result;
          }
        }

        self.postMessage({ id, type: 'result', result: results });
        break;
      }

      case 'unloadPlugin': {
        // Clean up all registrations
        for (const [cmdId, entry] of commandRegistry.entries()) {
          if (entry.pluginId === pluginId) {
            commandRegistry.delete(cmdId);
          }
        }

        for (const [evtName, handlers] of eventRegistry.entries()) {
          handlers.delete(pluginId);
        }

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
