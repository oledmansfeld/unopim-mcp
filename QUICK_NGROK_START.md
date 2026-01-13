# Quick Start: Expose UnoPim MCP Server via ngrok

## 🚀 Fast Setup (3 Steps)

### Step 1: Start the HTTP Server

```bash
cd /home/odm/projects/unoMcp
./start-http.sh
```

You'll see:
```
╔═══════════════════════════════════════════════════════════╗
║      UnoPim MCP Server (HTTP Mode) - RUNNING             ║
╚═══════════════════════════════════════════════════════════╝

🌐 Server listening on: http://localhost:3000
📡 SSE endpoint: http://localhost:3000/sse
💚 Health check: http://localhost:3000/health
```

### Step 2: Install & Configure ngrok (First Time Only)

```bash
# Install ngrok
sudo snap install ngrok

# Or download from: https://ngrok.com/download

# Authenticate (get token from https://dashboard.ngrok.com/get-started/your-authtoken)
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### Step 3: Expose via ngrok

In a **new terminal**:

```bash
ngrok http 3000
```

You'll get a public URL like: `https://abc123.ngrok.io`

**That's it!** Your MCP server is now accessible remotely.

## 🧪 Test It

```bash
# Test health endpoint
curl https://YOUR-NGROK-URL.ngrok.io/health

# Expected response:
{"status":"healthy","version":"1.0.0"}
```

## 📊 Monitor

View real-time traffic at: http://127.0.0.1:4040

## 🔒 Security Notes

**⚠️ Important:**
- The server is now publicly accessible
- Consider adding API key authentication
- Don't share your ngrok URL publicly
- Free tier has rate limits (40 connections/min)

## 💡 Use Cases

1. **Remote Development**: Access your local MCP server from anywhere
2. **Team Collaboration**: Share MCP server with team members
3. **Testing**: Test integrations without deploying
4. **Demos**: Show clients your MCP server functionality

## 🛑 Stop Everything

```bash
# Press Ctrl+C in both terminals
# 1. Stop MCP server (./start-http.sh)
# 2. Stop ngrok (ngrok http 3000)
```

## 📝 What You Have Now

✅ **Local Version**: `dist/index.js` (stdio) for Claude Desktop
✅ **HTTP Version**: `dist/index-http.js` for remote access via ngrok
✅ **Easy Start**: `./start-http.sh` script
✅ **Documentation**: Full guide in `NGROK_SETUP.md`

Choose the right version for your use case:
- **Local use in Claude Desktop**: Use stdio version (original setup)
- **Remote access/sharing**: Use HTTP version with ngrok

---

**Note:** The current MCP SDK primarily supports stdio transport for Claude Desktop. The HTTP version is useful for custom clients and remote API access. Check the latest MCP documentation for HTTP transport support in Claude Desktop.
