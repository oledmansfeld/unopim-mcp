# UnoPim MCP Server - Build Documentation

**Date:** January 19, 2026  
**Version:** 1.0.0

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Features Built](#features-built)
4. [Azure Deployment](#azure-deployment)
5. [API Endpoints](#api-endpoints)
6. [Authentication](#authentication)
7. [Configuration](#configuration)
8. [Client Integration](#client-integration)
9. [Available MCP Tools](#available-mcp-tools)
10. [Troubleshooting](#troubleshooting)
11. [Cost & Cleanup](#cost--cleanup)

---

## Project Overview

The **UnoPim MCP Server** is a Model Context Protocol (MCP) server that acts as an intelligent facade for UnoPim's REST API. It enables AI assistants like Claude Desktop and Microsoft Copilot Studio to interact with UnoPim PIM (Product Information Management) systems through natural language.

### Primary Use Cases

- **Rapid customer onboarding**: Receive product data (CSV/JSON/Excel), analyze structure, and auto-create data model
- **Data model evolution**: Extend existing models when new product types or attributes are introduced
- **Bulk product import**: Import products after data model is established
- **AI-assisted PIM management**: Create attributes, families, categories, and products through conversation

---

## Architecture

```
┌─────────────────────┐     ┌─────────────────────────────────────┐
│   Claude Desktop    │     │      Microsoft Copilot Studio       │
│   (SSE Transport)   │     │    (Streamable HTTP Transport)      │
└──────────┬──────────┘     └──────────────────┬──────────────────┘
           │                                    │
           │ /sse (no auth)                     │ /mcp (API key auth)
           │                                    │
           └────────────────┬───────────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │    Azure App Service        │
              │  app-unopim-mcp-dev-weu-001 │
              │                             │
              │  ┌───────────────────────┐  │
              │  │   UnoPim MCP Server   │  │
              │  │      (Node.js)        │  │
              │  └───────────┬───────────┘  │
              └──────────────┼──────────────┘
                             │
                             │ OAuth2 + REST API
                             ▼
              ┌─────────────────────────────┐
              │         UnoPim PIM          │
              │  https://your-instance.pim  │
              └─────────────────────────────┘
```

### Transport Modes

| Transport | Endpoint | Auth | Use Case |
|-----------|----------|------|----------|
| **Streamable HTTP** | `/mcp` | API Key | Copilot Studio, modern MCP clients |
| **SSE** | `/sse` | None | Claude Desktop |
| **Health** | `/health` | None | Monitoring, load balancers |

---

## Features Built

### 1. HTTP Streaming Endpoint (`/mcp`)

Added Streamable HTTP transport for modern MCP clients:

- Single request/response pattern (better for cloud/serverless)
- Session management with `Mcp-Session-Id` header
- Supports both streaming and direct responses
- Compatible with Microsoft Copilot Studio

### 2. API Key Authentication

Added API key authentication specifically for the `/mcp` endpoint:

- Accepts `Authorization: Bearer <key>` header
- Accepts `X-API-Key: <key>` header
- Uses `UNOPIM_CLIENT_ID` as the API key by default
- Can be overridden with `MCP_API_KEY` environment variable

### 3. Azure Deployment

Complete Azure deployment infrastructure:

- **Dockerfile** - Multi-stage build for Node.js
- **deploy-azure.sh** - One-click deployment script
- **Azure Container Registry** - Stores Docker images
- **Azure App Service** - Hosts the MCP server

### 4. Session Management

Fixed Streamable HTTP to maintain sessions across requests:

- Sessions stored in memory by `Mcp-Session-Id`
- Automatic cleanup on connection close
- Required for MCP protocol compliance

---

## Azure Deployment

### Resources Created

| Resource | Name | Purpose |
|----------|------|---------|
| Resource Group | `rg-unopim-mcp-dev-weu-001` | Contains all resources |
| Container Registry | `acrunopimmcpdevweu001` | Stores Docker images |
| App Service Plan | `asp-unopim-mcp-dev-weu-001` | Compute (B1 tier) |
| Web App | `app-unopim-mcp-dev-weu-001` | Hosts MCP server |

### Deployment Commands

```bash
# One-click deploy (if Docker available locally)
./deploy-azure.sh

# Or manual steps:

# 1. Create resource group
az group create --name rg-unopim-mcp-dev-weu-001 --location westeurope

# 2. Create container registry
az acr create --resource-group rg-unopim-mcp-dev-weu-001 \
  --name acrunopimmcpdevweu001 --sku Basic --admin-enabled true

# 3. Build image in Azure (no local Docker needed)
az acr build --registry acrunopimmcpdevweu001 --image unopim-mcp:latest .

# 4. Create App Service Plan
az appservice plan create \
  --name asp-unopim-mcp-dev-weu-001 \
  --resource-group rg-unopim-mcp-dev-weu-001 \
  --is-linux --sku B1

# 5. Create Web App
az webapp create \
  --resource-group rg-unopim-mcp-dev-weu-001 \
  --plan asp-unopim-mcp-dev-weu-001 \
  --name app-unopim-mcp-dev-weu-001 \
  --container-image-name acrunopimmcpdevweu001.azurecr.io/unopim-mcp:latest

# 6. Configure environment variables
az webapp config appsettings set \
  --resource-group rg-unopim-mcp-dev-weu-001 \
  --name app-unopim-mcp-dev-weu-001 \
  --settings \
    WEBSITES_PORT=3000 \
    UNOPIM_BASE_URL="https://your-instance.pim.dk" \
    UNOPIM_CLIENT_ID="your-client-id" \
    UNOPIM_CLIENT_SECRET="your-client-secret" \
    UNOPIM_USERNAME="your-username" \
    UNOPIM_PASSWORD="your-password" \
    UNOPIM_DEFAULT_LOCALE="da_DK" \
    UNOPIM_DEFAULT_CURRENCY="DKK"
```

### Redeploying After Code Changes

```bash
# Build and push new image
az acr build --registry acrunopimmcpdevweu001 --image unopim-mcp:latest .

# Restart app to pull new image
az webapp restart --name app-unopim-mcp-dev-weu-001 \
  --resource-group rg-unopim-mcp-dev-weu-001
```

---

## API Endpoints

### Production URLs

| Endpoint | URL |
|----------|-----|
| **Base URL** | `https://app-unopim-mcp-dev-weu-001.azurewebsites.net` |
| **Streamable HTTP** | `https://app-unopim-mcp-dev-weu-001.azurewebsites.net/mcp` |
| **SSE** | `https://app-unopim-mcp-dev-weu-001.azurewebsites.net/sse` |
| **Health Check** | `https://app-unopim-mcp-dev-weu-001.azurewebsites.net/health` |

### Health Check Response

```json
{"status":"healthy","version":"1.0.0"}
```

---

## Authentication

### API Key Authentication (for `/mcp` endpoint)

**API Key:** Set via `MCP_API_KEY` or defaults to `UNOPIM_CLIENT_ID` environment variable.

**Supported Headers:**

```http
Authorization: Bearer <your-api-key>
```

or

```http
X-API-Key: <your-api-key>
```

### Testing Authentication

```bash
# Without API key (should return 401)
curl -s -X POST \
  -H "Accept: application/json, text/event-stream" \
  https://app-unopim-mcp-dev-weu-001.azurewebsites.net/mcp

# With API key (should pass)
curl -s -X POST \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer <your-api-key>" \
  https://app-unopim-mcp-dev-weu-001.azurewebsites.net/mcp
```

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `UNOPIM_BASE_URL` | ✅ | UnoPim API URL |
| `UNOPIM_CLIENT_ID` | ✅ | OAuth2 Client ID (also used as API key) |
| `UNOPIM_CLIENT_SECRET` | ✅ | OAuth2 Client Secret |
| `UNOPIM_USERNAME` | ✅ | API username |
| `UNOPIM_PASSWORD` | ✅ | API password |
| `UNOPIM_DEFAULT_LOCALE` | ❌ | Default: `en_US` |
| `UNOPIM_DEFAULT_CHANNEL` | ❌ | Default: `default` |
| `UNOPIM_DEFAULT_CURRENCY` | ❌ | Default: `USD` |
| `PORT` | ❌ | Server port (default: `3000`) |
| `MCP_API_KEY` | ❌ | Override API key (defaults to CLIENT_ID) |

### Configuration Template

```bash
UNOPIM_BASE_URL=https://your-instance.pim.dk
UNOPIM_CLIENT_ID=your-client-id
UNOPIM_CLIENT_SECRET=your-client-secret
UNOPIM_USERNAME=your-username@example.com
UNOPIM_PASSWORD=your-password
UNOPIM_DEFAULT_LOCALE=da_DK
UNOPIM_DEFAULT_CURRENCY=DKK
```

---

## Client Integration

### Claude Desktop

Add to `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "unopim": {
      "url": "https://app-unopim-mcp-dev-weu-001.azurewebsites.net/sse"
    }
  }
}
```

Or for the authenticated endpoint:

```json
{
  "mcpServers": {
    "unopim": {
      "url": "https://app-unopim-mcp-dev-weu-001.azurewebsites.net/mcp"
    }
  }
}
```

### Microsoft Copilot Studio

1. **Endpoint URL:** `https://app-unopim-mcp-dev-weu-001.azurewebsites.net/mcp`
2. **Authentication Type:** API Key
3. **Header:** `Authorization: Bearer <your-api-key>`

### MCP Protocol Flow

```
Client                          Server
  │                               │
  │  POST /mcp (initialize)       │
  │──────────────────────────────▶│
  │                               │
  │  200 + Mcp-Session-Id header  │
  │◀──────────────────────────────│
  │                               │
  │  POST /mcp (tools/list)       │
  │  + Mcp-Session-Id header      │
  │──────────────────────────────▶│
  │                               │
  │  200 + tools array            │
  │◀──────────────────────────────│
  │                               │
  │  POST /mcp (tools/call)       │
  │  + Mcp-Session-Id header      │
  │──────────────────────────────▶│
  │                               │
  │  200 + result                 │
  │◀──────────────────────────────│
```

---

## Available MCP Tools

### Schema & Discovery (4 tools)

| Tool | Description |
|------|-------------|
| `unopim_get_schema` | Fetch complete data model |
| `unopim_get_attributes` | List all attributes with types |
| `unopim_get_families` | List all product families |
| `unopim_get_family_schema` | Get detailed schema for a specific family |

### Attribute Management (5 tools)

| Tool | Description |
|------|-------------|
| `unopim_create_attribute` | Create attribute (text, select, boolean, price, etc.) |
| `unopim_create_attribute_options` | Create options for select attributes |
| `unopim_get_attribute_options` | Get options for a select attribute |
| `unopim_get_attribute_groups` | List attribute groups |
| `unopim_create_attribute_group` | Create attribute group |

### Family Management (2 tools)

| Tool | Description |
|------|-------------|
| `unopim_create_family` | Create product family |
| `unopim_update_family` | Update family |

### Category Management (2 tools)

| Tool | Description |
|------|-------------|
| `unopim_get_categories` | Fetch category tree |
| `unopim_create_category` | Create category |

### Product Management (9 tools)

| Tool | Description |
|------|-------------|
| `unopim_get_products` | List products with filtering |
| `unopim_get_product` | Get single product by SKU |
| `unopim_create_product` | Create simple product |
| `unopim_update_product` | Update product |
| `unopim_upsert_product` | Create or update product |
| `unopim_smart_create_product` | Auto-validates against family schema |
| `unopim_bulk_create_products` | Batch create products |
| `unopim_create_configurable_product` | Create parent product with variants |
| `unopim_add_variant` | Add variant to configurable product |

### Media Upload (2 tools)

| Tool | Description |
|------|-------------|
| `unopim_upload_product_media` | Upload image and auto-link to product |
| `unopim_upload_category_media` | Upload image and auto-link to category |

---

## Troubleshooting

### Check Logs

```bash
az webapp log tail --name app-unopim-mcp-dev-weu-001 \
  --resource-group rg-unopim-mcp-dev-weu-001
```

### Restart App

```bash
az webapp restart --name app-unopim-mcp-dev-weu-001 \
  --resource-group rg-unopim-mcp-dev-weu-001
```

### SSH into Container

```bash
az webapp ssh --name app-unopim-mcp-dev-weu-001 \
  --resource-group rg-unopim-mcp-dev-weu-001
```

### Common Issues

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check API key in Authorization header |
| "Server not initialized" | Ensure session ID is passed in subsequent requests |
| No tools visible | Client must send `initialize` first, then `tools/list` |
| Container not starting | Check logs, verify environment variables |

---

## Cost & Cleanup

### Monthly Cost Estimate

| Resource | SKU | ~Cost/Month |
|----------|-----|-------------|
| App Service Plan | B1 | ~$13 |
| Container Registry | Basic | ~$5 |
| **Total** | | **~$18** |

### Cleanup All Resources

```bash
az group delete --name rg-unopim-mcp-dev-weu-001 --yes --no-wait
```

---

## Files Created/Modified

| File | Purpose |
|------|---------|
| `Dockerfile` | Container image definition |
| `.dockerignore` | Excludes files from Docker build |
| `deploy-azure.sh` | Azure deployment script |
| `AZURE_DEPLOY.md` | Azure deployment guide |
| `src/index-http.ts` | Added Streamable HTTP + API key auth |

---

## Summary

Today we built:

1. ✅ **Streamable HTTP transport** (`/mcp`) for modern MCP clients
2. ✅ **API key authentication** on the `/mcp` endpoint
3. ✅ **Azure deployment** with App Service + Container Registry
4. ✅ **Session management** for Streamable HTTP protocol compliance
5. ✅ **Full documentation**

The UnoPim MCP Server is now live at:
- **https://app-unopim-mcp-dev-weu-001.azurewebsites.net**

And ready for use with Claude Desktop and Microsoft Copilot Studio! 🚀
