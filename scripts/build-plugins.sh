#!/bin/bash
set -e

echo "Building WASM plugins..."

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

cd plugins

# Build each plugin
for plugin in markdown word-counter tag-manager; do
    echo "Building $plugin..."
    cd $plugin
    wasm-pack build --target web --out-dir ../../site/public/plugins/$plugin --release
    cd ..
done

echo "All plugins built successfully!"
