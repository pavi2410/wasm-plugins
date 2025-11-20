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
 *     // Register command handler at runtime
 *     register_event("content.changed", |data| {
 *         let content = extract_string(&data, "content");
 *         let html = render_markdown(&content);
 *         create_result("render", &html)
 *     });
 *
 *     console_log("Plugin activated!");
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

/// Runtime registration APIs provided by extension host
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = pluginAPI)]
    pub fn registerCommand(commandId: &str, handler: &js_sys::Function);

    #[wasm_bindgen(js_namespace = pluginAPI)]
    pub fn registerEvent(eventName: &str, handler: &js_sys::Function);

    #[wasm_bindgen(js_namespace = pluginAPI)]
    pub fn unregisterCommand(commandId: &str);

    #[wasm_bindgen(js_namespace = pluginAPI)]
    pub fn unregisterEvent(eventName: &str);
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

/// Register a command handler at runtime
///
/// # Example
/// ```rust
/// register_command("markdown.render", |data| {
///     // Handle command
///     JsValue::from_str("result")
/// });
/// ```
pub fn register_command<F>(command_id: &str, handler: F)
where
    F: Fn(JsValue) -> JsValue + 'static,
{
    let closure = Closure::wrap(Box::new(handler) as Box<dyn Fn(JsValue) -> JsValue>);
    registerCommand(command_id, closure.as_ref().unchecked_ref());
    closure.forget();  // Keep closure alive
}

/// Register an event handler at runtime
///
/// # Example
/// ```rust
/// register_event("content.changed", |data| {
///     // Handle event
///     JsValue::from_str("result")
/// });
/// ```
pub fn register_event<F>(event_name: &str, handler: F)
where
    F: Fn(JsValue) -> JsValue + 'static,
{
    let closure = Closure::wrap(Box::new(handler) as Box<dyn Fn(JsValue) -> JsValue>);
    registerEvent(event_name, closure.as_ref().unchecked_ref());
    closure.forget();  // Keep closure alive
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
