/*!
 * UI API - Control UI elements
 *
 * Requires permissions:
 * - `ui.panel` - Update panel content
 * - `ui.statusBar` - Update status bar items
 */

use wasm_bindgen::prelude::*;

/// UI API - Control panels, status bar, and other UI elements
pub struct UiAPI;

impl UiAPI {
    /// Create a new UiAPI instance
    pub fn new() -> Self {
        UiAPI
    }

    /// Update a panel's content
    ///
    /// Requires permission: `ui.panel`
    ///
    /// # Arguments
    /// * `panel_id` - The ID of the panel (from manifest contribution)
    /// * `html` - HTML content to display
    pub fn update_panel(&self, panel_id: &str, html: &str) -> Result<(), JsValue> {
        // Would call host API in full implementation
        // For now, plugins return HTML directly
        Ok(())
    }

    /// Update a status bar item
    ///
    /// Requires permission: `ui.statusBar`
    ///
    /// # Arguments
    /// * `item_id` - The ID of the status bar item (from manifest contribution)
    /// * `text` - Text to display
    pub fn update_status_bar(&self, item_id: &str, text: &str) -> Result<(), JsValue> {
        // Would call host API in full implementation
        Ok(())
    }
}

impl Default for UiAPI {
    fn default() -> Self {
        Self::new()
    }
}
