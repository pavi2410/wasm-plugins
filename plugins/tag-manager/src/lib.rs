use wasm_plugin_sdk::prelude::*;
use std::collections::HashSet;

#[derive(Serialize)]
struct TagsResult {
    #[serde(rename = "type")]
    result_type: String,
    tags: Vec<String>,
}

/// Plugin activation - Register event handlers at runtime
#[wasm_bindgen]
pub fn activate() {
    console_log("Tag Manager activated");

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

        // Extract tags
        let tags = extract_tags_internal(&content);

        // Return result
        let result = TagsResult {
            result_type: "tags".to_string(),
            tags,
        };

        to_value(&result).unwrap_or(JsValue::NULL)
    });
}

/// Plugin deactivation - called before plugin is unloaded
#[wasm_bindgen]
pub fn deactivate() {
    console_log("Tag Manager deactivated");
}

/// Internal function to extract hashtags from text
/// Not exported - only used by event handler
fn extract_tags_internal(text: &str) -> Vec<String> {
    let mut tags: HashSet<String> = HashSet::new();

    for word in text.split_whitespace() {
        if word.starts_with('#') && word.len() > 1 {
            let tag = word.trim_start_matches('#')
                .trim_end_matches(|c: char| !c.is_alphanumeric() && c != '-' && c != '_')
                .to_lowercase();

            if !tag.is_empty() {
                tags.insert(tag);
            }
        }
    }

    let mut tags_vec: Vec<String> = tags.into_iter().collect();
    tags_vec.sort();

    tags_vec
}

/// Get plugin information (for display in plugin manager)
#[wasm_bindgen]
pub fn get_plugin_info() -> String {
    r#"{"name":"Tag Manager","version":"0.1.0","description":"Extracts and manages hashtags"}"#.to_string()
}
