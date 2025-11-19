use wasm_bindgen::prelude::*;
use std::collections::HashSet;

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

    serde_wasm_bindgen::to_value(&tags_vec).unwrap()
}

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

#[wasm_bindgen]
pub fn get_plugin_info() -> String {
    r#"{"name":"Tag Manager","version":"0.1.0","description":"Extracts and manages hashtags"}"#.to_string()
}
