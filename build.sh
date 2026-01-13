#!/bin/bash
# Build script to workaround UNC path issues in WSL

# Find the TypeScript compiler
TSC_PATH="node_modules/typescript/lib/tsc.js"

if [ ! -f "$TSC_PATH" ]; then
    echo "Error: TypeScript compiler not found at $TSC_PATH"
    exit 1
fi

# Use Windows node to compile (since npm is Windows-based)
"/mnt/c/Program Files/nodejs/node.exe" "$TSC_PATH" "$@"
