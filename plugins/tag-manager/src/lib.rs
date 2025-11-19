use wasm_plugin_sdk::prelude::*;
use std::collections::HashSet;

/// Plugin activation - called when plugin is loaded
#[wasm_bindgen]
pub fn activate() {
    console_log("Tag Manager activated");
}

/// Plugin deactivation - called before plugin is unloaded
#[wasm_bindgen]
pub fn deactivate() {
    console_log("Tag Manager deactivated");
}

/// Extract hashtags from text
///
/// This is the main command handler registered in manifest.json
#[wasm_bindgen]
pub fn extract_tags(text: &str) -> JsValue {
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

    to_value(&tags_vec).unwrap()
}

/// Highlight tags in HTML
#[wasm_bindgen]
pub fn highlight_tags(text: &str) -> String {
    let mut result = text.to_string();

    for word in text.split_whitespace() {
        if word.starts_with('#') && word.len() > 1 {
            let highlighted = format!("<span class=\"tag\">{}</span>", word);
            result = result.replace(word, &highlighted);
        }
    }

    result
}

/// Get plugin information (for display in plugin manager)
#[wasm_bindgen]
pub fn get_plugin_info() -> String {
    r#"{"name":"Tag Manager","version":"0.1.0","description":"Extracts and manages hashtags"}"#.to_string()
}
