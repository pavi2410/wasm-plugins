/**
 * Word Counter Plugin - Event-based wrapper
 * Subscribes to 'content.changed' events and provides text statistics
 */

import init, { count, get_plugin_info } from './word_counter_plugin.js';

// Re-export WASM functions for backward compatibility
export { count, get_plugin_info };

// Export default initialization
export default init;

/**
 * Subscribe to events
 * @returns {Object} Map of event names to handler functions
 */
export function subscribe() {
  return {
    'content.changed': async (data) => {
      const { content } = data;

      if (!content) {
        return null;
      }

      try {
        const stats = count(content);
        return {
          type: 'stats',
          stats
        };
      } catch (error) {
        console.error('[WordCounterPlugin] Error counting:', error);
        throw error;
      }
    }
  };
}
