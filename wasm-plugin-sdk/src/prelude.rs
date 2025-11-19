/*!
 * Prelude module - Import everything needed for plugin development
 *
 * ## Usage
 *
 * ```rust
 * use wasm_plugin_sdk::prelude::*;
 * ```
 */

pub use crate::{console_log, console_error, console_warn, PluginResult};
pub use crate::api::*;
pub use wasm_bindgen::prelude::*;
pub use serde::{Serialize, Deserialize};
pub use serde_wasm_bindgen::{to_value, from_value};
