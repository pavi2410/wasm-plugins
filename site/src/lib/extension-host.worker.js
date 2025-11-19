/**
 * Extension Host - Runs all plugin code in isolated Web Worker
 * No DOM access, controlled API surface
 */

let loadedPlugins = new Map();
// Store event subscriptions: Map<eventName, Map<pluginId, handler>>
let eventSubscriptions = new Map();

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

        // Check if plugin exports a subscribe function for event-based API
        if (typeof module.subscribe === 'function') {
          try {
            const subscriptions = await module.subscribe();

            // Register event handlers from the plugin
            for (const [eventName, handler] of Object.entries(subscriptions)) {
              if (!eventSubscriptions.has(eventName)) {
                eventSubscriptions.set(eventName, new Map());
              }
              eventSubscriptions.get(eventName).set(pluginId, handler);
              console.log(`[ExtensionHost] Plugin ${pluginId} subscribed to event: ${eventName}`);
            }
          } catch (error) {
            console.error(`[ExtensionHost] Failed to subscribe plugin ${pluginId}:`, error);
          }
        }

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

      case 'emitEvent': {
        const { eventName, data } = event.data;
        const results = {};

        // Get all plugins subscribed to this event
        const subscribers = eventSubscriptions.get(eventName);

        if (subscribers) {
          // Call all subscribed handlers in parallel
          const promises = Array.from(subscribers.entries()).map(async ([pluginId, handler]) => {
            try {
              const result = await handler(data);
              return { pluginId, result };
            } catch (error) {
              console.error(`[ExtensionHost] Plugin ${pluginId} error handling ${eventName}:`, error);
              return { pluginId, error: error.message };
            }
          });

          const responses = await Promise.all(promises);

          // Organize results by plugin ID
          for (const { pluginId, result, error } of responses) {
            results[pluginId] = error ? { error } : result;
          }
        }

        self.postMessage({ id, type: 'result', result: results });
        break;
      }

      case 'unloadPlugin': {
        // Remove plugin's event subscriptions
        for (const [eventName, subscribers] of eventSubscriptions.entries()) {
          subscribers.delete(pluginId);
          if (subscribers.size === 0) {
            eventSubscriptions.delete(eventName);
          }
        }

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
