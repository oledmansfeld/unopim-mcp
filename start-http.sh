#!/bin/bash
# Start UnoPim MCP Server in HTTP mode
# This script loads environment variables and starts the server

# Load environment variables from .env file
if [ -f .env ]; then
  echo "Loading environment from .env..."
  export $(cat .env | grep -v '^#' | xargs)
else
  echo "ERROR: .env file not found!"
  echo "Please create a .env file with your UnoPim credentials."
  exit 1
fi

# Check if dist folder exists
if [ ! -d "dist" ]; then
  echo "ERROR: dist folder not found. Building project..."
  npm run build
fi

# Start the HTTP server
echo "Starting UnoPim MCP HTTP server on port 3000..."
echo "Base URL: $UNOPIM_BASE_URL"
echo "Locale: $UNOPIM_DEFAULT_LOCALE"
echo ""
echo "Ready for ngrok connection!"
echo "Run in another terminal: ngrok http 3000"
echo ""

node dist/index-http.js
