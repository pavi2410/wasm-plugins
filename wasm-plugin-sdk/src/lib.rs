/*!
 * WASM Plugin SDK
 *
 * Provides a safe, ergonomic API for building WASM plugins with capability-based security.
 *
 * ## Example
 *
 * ```rust
 * use wasm_plugin_sdk::prelude::*;
 *
 * #[wasm_bindgen]
 * pub fn activate() {
 *     console_log("Plugin activated!");
 * }
 *
 * #[wasm_bindgen]
 * pub fn render(content: &str) -> String {
 *     // Your plugin logic here
 *     format!("<p>{}</p>", content)
 * }
 * ```
 */

pub mod api;
pub mod prelude;

pub use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

/// Console logging utilities
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    pub fn log(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    pub fn error(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    pub fn warn(s: &str);
}

/// Log to console with plugin prefix
pub fn console_log(msg: &str) {
    log(&format!("[Plugin] {}", msg));
}

/// Log error to console with plugin prefix
pub fn console_error(msg: &str) {
    error(&format!("[Plugin] {}", msg));
}

/// Log warning to console with plugin prefix
pub fn console_warn(msg: &str) {
    warn(&format!("[Plugin] {}", msg));
}

/// Plugin manifest structure (read from manifest.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub permissions: Vec<String>,
}

/// Result type for plugin operations
pub type PluginResult<T> = Result<T, JsValue>;
