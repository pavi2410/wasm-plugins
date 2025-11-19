use wasm_bindgen::prelude::*;
use serde::Serialize;

#[derive(Serialize)]
pub struct Stats {
    words: usize,
    characters: usize,
    characters_no_spaces: usize,
    lines: usize,
    paragraphs: usize,
}

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

    serde_wasm_bindgen::to_value(&stats).unwrap()
}

#[wasm_bindgen]
pub fn get_plugin_info() -> String {
    r#"{"name":"Word Counter","version":"0.1.0","description":"Counts words, characters, and lines"}"#.to_string()
}
