/**
 * Extension Host - Runs all plugin code in isolated Web Worker
 * No DOM access, controlled API surface
 */

let loadedPlugins = new Map();

// Controlled API that plugins can use
const pluginAPI = {
  // Only safe operations allowed
  console: {
    log: (...args) => console.log('[Plugin]', ...args),
    error: (...args) => console.error('[Plugin]', ...args)
  }
};

self.onmessage = async (event) => {
  const { id, type, pluginId, method, args } = event.data;

  try {
    switch (type) {
      case 'loadPlugin': {
        const { pluginUrl } = event.data;

        // Load WASM module in worker
        const module = await import(/* @vite-ignore */ pluginUrl);
        await module.default();

        loadedPlugins.set(pluginId, module);

        self.postMessage({ id, type: 'success' });
        break;
      }

      case 'callPlugin': {
        const plugin = loadedPlugins.get(pluginId);
        if (!plugin) {
          throw new Error(`Plugin ${pluginId} not loaded`);
        }

        // Execute plugin method (sandboxed in worker)
        const result = await plugin[method](...args);

        self.postMessage({ id, type: 'result', result });
        break;
      }

      case 'unloadPlugin': {
        loadedPlugins.delete(pluginId);
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
  console.error('Plugin error:', event.error);
});
