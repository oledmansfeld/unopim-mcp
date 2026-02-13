#!/bin/bash
# Start UnoPim MCP Server (HTTP Mode)
# Copy this file and fill in your credentials, or use a .env file instead.

cd "$(dirname "$0")"

UNOPIM_BASE_URL='https://your-instance.pim.dk' \
UNOPIM_CLIENT_ID='your-client-id' \
UNOPIM_CLIENT_SECRET='your-client-secret' \
UNOPIM_USERNAME='your-username@example.com' \
UNOPIM_PASSWORD='your-password' \
UNOPIM_DEFAULT_LOCALE='da_DK' \
UNOPIM_DEFAULT_CURRENCY='DKK' \
PORT='3000' \
node dist/index-http.js
