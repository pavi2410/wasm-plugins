/**
 * Markdown Plugin - Event-based wrapper
 * Subscribes to 'content.changed' events and provides markdown rendering
 */

import init, { render, get_plugin_info } from './markdown_plugin.js';

// Re-export WASM functions for backward compatibility
export { render, get_plugin_info };

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
        const html = render(content);
        return {
          type: 'render',
          html
        };
      } catch (error) {
        console.error('[MarkdownPlugin] Error rendering:', error);
        throw error;
      }
    }
  };
}
