use wasm_plugin_sdk::prelude::*;

#[derive(Serialize)]
pub struct Stats {
    words: usize,
    characters: usize,
    characters_no_spaces: usize,
    lines: usize,
    paragraphs: usize,
}

/// Plugin activation - called when plugin is loaded
#[wasm_bindgen]
pub fn activate() {
    console_log("Word Counter activated");
}

/// Plugin deactivation - called before plugin is unloaded
#[wasm_bindgen]
pub fn deactivate() {
    console_log("Word Counter deactivated");
}

/// Count words, characters, lines, and paragraphs
///
/// This is the main command handler registered in manifest.json
#[wasm_bindgen]
pub fn count(text: &str) -> JsValue {
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

    let stats = Stats {
        words,
        characters,
        characters_no_spaces,
        lines,
        paragraphs,
    };

    to_value(&stats).unwrap()
}

/// Get plugin information (for display in plugin manager)
#[wasm_bindgen]
pub fn get_plugin_info() -> String {
    r#"{"name":"Word Counter","version":"0.1.0","description":"Counts words, characters, and lines"}"#.to_string()
}
