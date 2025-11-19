use wasm_plugin_sdk::prelude::*;
use pulldown_cmark::{Parser, Options, html};

/// Plugin activation - called when plugin is loaded
#[wasm_bindgen]
pub fn activate() {
    console_log("Markdown Renderer activated");
}

/// Plugin deactivation - called before plugin is unloaded
#[wasm_bindgen]
pub fn deactivate() {
    console_log("Markdown Renderer deactivated");
}

/// Render markdown to HTML
///
/// This is the main command handler registered in manifest.json
#[wasm_bindgen]
pub fn render(markdown: &str) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_TASKLISTS);

    let parser = Parser::new_ext(markdown, options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);

    html_output
}

/// Get plugin information (for display in plugin manager)
#[wasm_bindgen]
pub fn get_plugin_info() -> String {
    r#"{"name":"Markdown Renderer","version":"0.1.0","description":"Converts markdown to HTML"}"#.to_string()
}
