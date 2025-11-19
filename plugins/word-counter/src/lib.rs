use wasm_plugin_sdk::prelude::*;

#[derive(Serialize)]
pub struct Stats {
    words: usize,
    characters: usize,
    characters_no_spaces: usize,
    lines: usize,
    paragraphs: usize,
}

#[derive(Serialize)]
struct StatsResult {
    #[serde(rename = "type")]
    result_type: String,
    stats: Stats,
}

/// Plugin activation - Register event handlers at runtime
#[wasm_bindgen]
pub fn activate() {
    console_log("Word Counter activated");

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

        // Count statistics
        let stats = count_stats(&content);

        // Return result
        let result = StatsResult {
            result_type: "stats".to_string(),
            stats,
        };

        to_value(&result).unwrap_or(JsValue::NULL)
    });
}

/// Plugin deactivation - called before plugin is unloaded
#[wasm_bindgen]
pub fn deactivate() {
    console_log("Word Counter deactivated");
}

/// Internal function to count stats
/// Not exported - only used by event handler
fn count_stats(text: &str) -> Stats {
    let words = text
        .split_whitespace()
        .filter(|s| !s.is_empty())
        .count();

    let characters = text.chars().count();
    let characters_no_spaces = text.chars().filter(|c| !c.is_whitespace()).count();
    let lines = text.lines().count().max(1);

    let paragraphs = text
        .split("\n\n")
        .filter(|s| !s.trim().is_empty())
        .count()
        .max(1);

    Stats {
        words,
        characters,
        characters_no_spaces,
        lines,
        paragraphs,
    }
}

/// Get plugin information (for display in plugin manager)
#[wasm_bindgen]
pub fn get_plugin_info() -> String {
    r#"{"name":"Word Counter","version":"0.1.0","description":"Counts words, characters, and lines"}"#.to_string()
}
