# Starting the UnoPim MCP HTTP Server

## ✅ EASIEST METHOD - Double-click the batch file

**Windows Users:**
1. Navigate to: `C:\Users\YourUser\`
2. Double-click: `start-unopim-wsl.bat`
3. Server will start automatically

The batch file is at: `C:\Users\YourUser\start-unopim-wsl.bat`

## Alternative: Command Line

### From Windows Command Prompt:
```cmd
cd C:\Users\YourUser
start-unopim-wsl.bat
```

### From WSL Terminal:
```bash
cd /path/to/unopim-mcp
./start-http.sh
```

## What You'll See:

```
╔═══════════════════════════════════════════════════════════╗
║      UnoPim MCP Server (HTTP Mode) - RUNNING             ║
╚═══════════════════════════════════════════════════════════╝

🌐 Server listening on: http://localhost:3000
📡 SSE endpoint: http://localhost:3000/sse
💚 Health check: http://localhost:3000/health

To expose via ngrok:
  ngrok http 3000
```

## Test Connection:

Open browser or use curl:
```
http://localhost:3000/health
```

Expected response:
```json
{"status":"healthy","version":"1.0.0"}
```

## Expose via ngrok:

In a **new** terminal/command prompt:
```
ngrok http 3000
```

You'll get a public URL like: `https://abc123.ngrok.io`

## Stop the Server:

Press `Ctrl+C` in the command window

