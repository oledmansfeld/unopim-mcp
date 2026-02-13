# UnoPim MCP Server - ngrok Remote Access Setup

This guide shows how to expose your UnoPim MCP Server via ngrok for remote access.

## What is ngrok?

ngrok creates a secure tunnel from a public URL to your local server, allowing remote access to your MCP server from anywhere.

## Prerequisites

1. UnoPim MCP Server built and configured
2. ngrok installed (download from https://ngrok.com/download)
3. ngrok account (free tier works fine)

## Setup Instructions

### Step 1: Install ngrok

**Linux/macOS:**
```bash
# Download and install
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok

# Or use snap
sudo snap install ngrok
```

**Windows:**
Download from https://ngrok.com/download and run the installer.

### Step 2: Authenticate ngrok

Get your auth token from https://dashboard.ngrok.com/get-started/your-authtoken

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### Step 3: Build HTTP Version

```bash
cd /path/to/unopim-mcp
./build.sh
```

### Step 4: Start the MCP Server (HTTP Mode)

Open a terminal and run:

```bash
export UNOPIM_BASE_URL="https://your-instance.pim.dk"
export UNOPIM_CLIENT_ID="your-client-id"
export UNOPIM_CLIENT_SECRET="your-client-secret"
export UNOPIM_USERNAME="your-username@example.com"
export UNOPIM_PASSWORD="your-password"
export UNOPIM_DEFAULT_LOCALE="da_DK"
export UNOPIM_DEFAULT_CURRENCY="DKK"
export PORT=3000

node dist/index-http.js
```

You should see:
```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║      UnoPim MCP Server (HTTP Mode) - RUNNING             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

🌐 Server listening on: http://localhost:3000
📡 SSE endpoint: http://localhost:3000/sse
💚 Health check: http://localhost:3000/health
```

### Step 5: Expose via ngrok

In a **new terminal**, run:

```bash
ngrok http 3000
```

You'll see output like:
```
ngrok

Session Status                online
Account                       your-email@example.com
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok.io -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**Important:** Copy the `https://abc123.ngrok.io` URL - this is your public endpoint!

### Step 6: Test the Public Endpoint

```bash
# Test health endpoint
curl https://YOUR-NGROK-URL.ngrok.io/health

# Should return:
# {"status":"healthy","version":"1.0.0"}
```

## Connect from Remote Claude

### Option 1: Claude Desktop (Remote URL - If Supported)

*Note: As of now, Claude Desktop primarily supports local stdio connections. Check latest documentation for remote HTTP transport support.*

### Option 2: Custom Client

You can build a custom client that connects to your ngrok URL:

```javascript
// Example client connection
const sseUrl = 'https://YOUR-NGROK-URL.ngrok.io/sse';
const eventSource = new EventSource(sseUrl);

eventSource.onmessage = (event) => {
  console.log('Received:', event.data);
};
```

### Option 3: API Gateway Pattern

Use the ngrok URL as a backend API that your local Claude Desktop connects to via a proxy.

## Security Considerations

### ⚠️ Important Security Notes

1. **Authentication**: The current implementation doesn't have additional authentication beyond UnoPim's OAuth2. Consider adding:
   - API key authentication
   - IP whitelisting
   - Rate limiting

2. **HTTPS**: ngrok provides HTTPS by default, but your UnoPim instance uses HTTP. Consider:
   - Setting up HTTPS for UnoPim
   - Using ngrok's TCP tunnel for end-to-end encryption

3. **Credentials**: Never commit your ngrok URLs or credentials to version control.

4. **Free Tier Limits**: ngrok free tier has:
   - 1 online ngrok process
   - 4 tunnels per process
   - 40 connections/minute

## Enhanced Security Setup

### Add API Key Authentication

Create `.env.local`:
```bash
MCP_API_KEY=your-secure-random-key-here
```

Modify the HTTP server to check for API key in headers:
```typescript
if (req.headers['x-api-key'] !== process.env.MCP_API_KEY) {
  res.writeHead(401);
  res.end('Unauthorized');
  return;
}
```

### Add Rate Limiting

Install rate limiter:
```bash
npm install express-rate-limit
```

## Monitoring

### ngrok Dashboard

Access the web interface at http://127.0.0.1:4040 to see:
- Real-time request logs
- Traffic inspection
- Response times
- Connection status

### Health Check Monitoring

Set up a monitoring service to ping:
```
https://YOUR-NGROK-URL.ngrok.io/health
```

## Troubleshooting

### "ngrok not found"

```bash
# Install via snap
sudo snap install ngrok

# Or download manually
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/
```

### "Connection refused"

Make sure the MCP server is running on port 3000:
```bash
curl http://localhost:3000/health
```

### "Tunnel not found"

Your ngrok session may have expired. Free tier tunnels expire after 2 hours. Restart ngrok.

### "CORS errors"

The server includes CORS headers. If you still see issues, check browser console for specific errors.

## Production Deployment

For production use, consider:

1. **Dedicated Server**: Deploy on a VPS instead of using ngrok
2. **Reverse Proxy**: Use nginx/Apache with SSL certificates
3. **Container**: Docker deployment for easy scaling
4. **Load Balancer**: For high availability
5. **Monitoring**: Set up proper logging and alerts

## Alternative: Direct HTTP Deployment

Instead of ngrok, you can deploy directly:

```bash
# On a server with public IP
export PORT=8080
node dist/index-http.js

# Configure firewall
sudo ufw allow 8080/tcp

# Access via: http://YOUR-SERVER-IP:8080
```

## Summary

✅ **Local Access**: `http://localhost:3000`
✅ **Public Access**: `https://YOUR-NGROK-URL.ngrok.io`
✅ **Health Check**: `/health` endpoint
✅ **SSE Endpoint**: `/sse` for MCP connections

Your UnoPim MCP Server is now accessible remotely via ngrok! 🚀
