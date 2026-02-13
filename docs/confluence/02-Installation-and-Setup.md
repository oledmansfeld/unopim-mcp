# UnoPim MCP Server - Installation & Setup

## Prerequisites

### System Requirements
- **Node.js**: Version 20.x or higher
- **npm**: Version 10.x or higher
- **Operating System**: Linux, macOS, or Windows with WSL
- **Network**: Access to UnoPim API endpoint

### UnoPim Requirements
- **API Access**: OAuth2 credentials (Client ID, Client Secret)
- **User Account**: UnoPim user with appropriate permissions
- **Base URL**: UnoPim instance URL (e.g., `http://your-instance.pim.dk`)

### Optional Tools
- **ngrok**: For remote access via Claude Desktop (recommended)
- **MCP Inspector**: For testing tools locally

## Installation Steps

### 1. Clone or Download Repository

```bash
cd ~/AI-projects
git clone https://github.com/your-org/unopim-mcp.git
cd unopim-mcp
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `zod` - Input validation
- `typescript` - Type checking and compilation

### 3. Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### 4. Configure Environment Variables

#### Option A: Using `.env` File (Recommended for Development)

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# UnoPim API Configuration
UNOPIM_BASE_URL=https://your-instance.pim.dk
UNOPIM_CLIENT_ID=your-client-id
UNOPIM_CLIENT_SECRET=your-client-secret
UNOPIM_USERNAME=your-username@example.com
UNOPIM_PASSWORD=your-password

# Optional Configuration
UNOPIM_DEFAULT_LOCALE=da_DK
UNOPIM_DEFAULT_CHANNEL=default
UNOPIM_DEFAULT_CURRENCY=USD
```

**⚠️ Important:** Add `.env` to `.gitignore`:
```bash
echo ".env" >> .gitignore
```

#### Option B: Environment Variables (Production)

For production, export variables in your shell:

```bash
export UNOPIM_BASE_URL="https://your-instance.pim.dk"
export UNOPIM_CLIENT_ID="your-client-id"
export UNOPIM_CLIENT_SECRET="your-client-secret"
export UNOPIM_USERNAME="your-username@example.com"
export UNOPIM_PASSWORD="your-password"
export UNOPIM_DEFAULT_LOCALE="da_DK"
export UNOPIM_DEFAULT_CHANNEL="default"
export UNOPIM_DEFAULT_CURRENCY="USD"
```

#### Option C: Claude Desktop Config (For Claude Desktop)

Edit your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "unopim": {
      "command": "node",
      "args": ["/path/to/unopim-mcp/dist/index.js"],
      "env": {
        "UNOPIM_BASE_URL": "https://your-instance.pim.dk",
        "UNOPIM_CLIENT_ID": "your-client-id",
        "UNOPIM_CLIENT_SECRET": "your-client-secret",
        "UNOPIM_USERNAME": "your-username@example.com",
        "UNOPIM_PASSWORD": "your-password",
        "UNOPIM_DEFAULT_LOCALE": "da_DK",
        "UNOPIM_DEFAULT_CHANNEL": "default",
        "UNOPIM_DEFAULT_CURRENCY": "USD"
      }
    }
  }
}
```

## Running the MCP Server

### Mode 1: Local stdio (For Claude Desktop Direct Connection)

This mode connects directly to Claude Desktop via the config file:

```bash
node dist/index.js
```

Claude Desktop will automatically launch this when you start a conversation.

### Mode 2: HTTP/SSE (For Remote Access via ngrok) ⭐ Recommended

#### Terminal 1: Start the MCP Server

Using the helper script:
```bash
./start-http.sh
```

Or manually:
```bash
# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Start server
node dist/index-http.js
```

You should see:
```
Loading environment from .env...
Starting UnoPim MCP HTTP server on port 3000...
Base URL: http://your-instance.pim.dk
Locale: da_DK

Ready for ngrok connection!
Run in another terminal: ngrok http 3000
```

#### Terminal 2: Expose with ngrok

```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding   https://ae6ab5d4095a.ngrok-free.app -> http://localhost:3000
```

#### Configure Claude Desktop with ngrok URL

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "unopim": {
      "url": "https://ae6ab5d4095a.ngrok-free.app/sse"
    }
  }
}
```

**⚠️ Important:** Add `/sse` to the end of the ngrok URL!

#### Restart Claude Desktop

Close and reopen Claude Desktop to load the new configuration.

## Testing the Connection

### Option 1: Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector dist/index.js
```

Open your browser to the URL shown and test tools interactively.

### Option 2: Test with Claude Desktop

1. Start a new conversation in Claude Desktop
2. Type: "List all attributes in UnoPim"
3. Claude should respond with attribute data from your UnoPim instance

### Option 3: Test with curl (HTTP mode)

```bash
# Test server is running
curl http://localhost:3000/health

# Test tool listing
curl -X POST http://localhost:3000/mcp/v1/tools \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Verification Checklist

After setup, verify:

- [ ] Build completed without errors: `npm run build`
- [ ] Environment variables loaded correctly
- [ ] Server starts without errors
- [ ] ngrok tunnel established (if using HTTP mode)
- [ ] Claude Desktop config updated
- [ ] Claude Desktop restarted
- [ ] Test query returns data from UnoPim

## Common Setup Issues

### Issue: "Missing required environment variables"

**Solution:** Ensure all required variables are set:
```bash
# Check variables are set
echo $UNOPIM_BASE_URL
echo $UNOPIM_CLIENT_ID

# If empty, load .env file
export $(cat .env | grep -v '^#' | xargs)
```

### Issue: "OAuth token failed"

**Solution:** Verify credentials are correct:
- Check Client ID and Client Secret in UnoPim admin
- Verify username and password work in UnoPim UI
- Ensure user has API access permissions

### Issue: "Connection refused"

**Solution:** Check base URL is accessible:
```bash
curl http://your-instance.pim.dk/api/v1/rest/locales
```

### Issue: "Claude Desktop not seeing tools"

**Solution:**
1. Verify config file path is correct
2. Check JSON syntax is valid
3. Restart Claude Desktop completely (quit, not just close window)
4. Check logs: `~/Library/Logs/Claude/` (macOS)

## Production Deployment

### Recommended Setup

1. **Use Secrets Manager**
   - Azure Key Vault
   - AWS Secrets Manager
   - HashiCorp Vault

2. **Run as System Service**

Create `/etc/systemd/system/unopim-mcp.service`:

```ini
[Unit]
Description=UnoPim MCP Server
After=network.target

[Service]
Type=simple
User=mcp-user
WorkingDirectory=/opt/unopim-mcp
EnvironmentFile=/etc/unopim-mcp/env
ExecStart=/usr/bin/node /opt/unopim-mcp/dist/index-http.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable unopim-mcp
sudo systemctl start unopim-mcp
sudo systemctl status unopim-mcp
```

3. **Use Reverse Proxy**

Nginx config example:
```nginx
location /unopim-mcp {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

4. **Enable Monitoring**
   - Set up health check endpoint monitoring
   - Log aggregation (ELK, Splunk, etc.)
   - Alert on authentication failures
   - Track API usage metrics

## Security Best Practices

### ✅ Do This
- Store credentials in environment variables, never in code
- Use separate credentials per environment (dev/staging/prod)
- Rotate credentials regularly
- Enable MFA on UnoPim user accounts
- Use HTTPS for production deployments
- Implement rate limiting

### ❌ Never Do This
- Commit credentials to git
- Share production credentials
- Use production credentials in development
- Disable SSL verification
- Store tokens in localStorage or files
- Log credentials in error messages

## Next Steps

Now that your MCP server is set up:

1. **Explore Available Tools**: See "Available Tools Reference" page
2. **Try Examples**: See "Usage Examples" page
3. **Learn Workflows**: See "Common Workflows" page
4. **Troubleshoot**: See "Troubleshooting" page

---

**Last Updated**: 2026-01-13
**Setup Time**: ~15 minutes
**Difficulty**: Intermediate
