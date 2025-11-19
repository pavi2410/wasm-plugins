/*!
 * Plugin API modules
 *
 * Provides typed, safe APIs for interacting with the host application.
 * Access is controlled by capabilities declared in the plugin manifest.
 */

pub mod text;
pub mod ui;

pub use text::*;
pub use ui::*;
