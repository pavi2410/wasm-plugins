use wasm_plugin_sdk::prelude::*;
use pulldown_cmark::{Parser, Options, html};
use serde::Serialize;

#[derive(Serialize)]
struct RenderResult {
    #[serde(rename = "type")]
    result_type: String,
    html: String,
}

/// Plugin activation - Register event handlers at runtime
#[wasm_bindgen]
pub fn activate() {
    console_log("Markdown Renderer activated");

    // Register handler for content.changed event
    register_event("content.changed", |data| {
        // Extract content from event data
        let content = match from_value::<serde_json::Value>(data) {
            Ok(val) => val.get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            Err(_) => String::new()
        };

        if content.is_empty() {
            return JsValue::NULL;
        }

        // Render markdown to HTML
        let html = render_markdown(&content);

        // Return result
        let result = RenderResult {
            result_type: "render".to_string(),
            html,
        };

        to_value(&result).unwrap_or(JsValue::NULL)
    });
}

/// Plugin deactivation - called before plugin is unloaded
#[wasm_bindgen]
pub fn deactivate() {
    console_log("Markdown Renderer deactivated");
}

/// Internal function to render markdown to HTML
/// Not exported - only used by event handler
fn render_markdown(markdown: &str) -> String {
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
