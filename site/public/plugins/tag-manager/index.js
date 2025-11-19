/**
 * Tag Manager Plugin - Event-based wrapper
 * Subscribes to 'content.changed' events and provides tag extraction
 */

import init, { extract_tags, highlight_tags, get_plugin_info } from './tag_manager_plugin.js';

// Re-export WASM functions for backward compatibility
export { extract_tags, highlight_tags, get_plugin_info };

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
        const tags = extract_tags(content);
        return {
          type: 'tags',
          tags
        };
      } catch (error) {
        console.error('[TagManagerPlugin] Error extracting tags:', error);
        throw error;
      }
    }
  };
}
