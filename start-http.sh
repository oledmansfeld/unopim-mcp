#!/bin/bash
# Start UnoPim MCP Server in HTTP mode for ngrok access

echo "Starting UnoPim MCP Server (HTTP Mode)..."
echo ""

# Set environment variables and run node
UNOPIM_BASE_URL="http://REDACTED-IP:8000" \
UNOPIM_CLIENT_ID="REDACTED-CLIENT-ID" \
UNOPIM_CLIENT_SECRET="REDACTED-SECRET" \
UNOPIM_USERNAME="REDACTED-EMAIL" \
UNOPIM_PASSWORD="REDACTED-PASSWORD" \
UNOPIM_DEFAULT_LOCALE="da_DK" \
UNOPIM_DEFAULT_CURRENCY="DKK" \
PORT="${PORT:-3000}" \
"/mnt/c/Program Files/nodejs/node.exe" dist/index-http.js
