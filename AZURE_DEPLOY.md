# Azure Deployment Guide - UnoPim MCP Server

Simple POC deployment to Azure App Service using Docker containers.

## Prerequisites

- Azure CLI installed (`az --version`)
- Docker installed
- Azure subscription

## Quick Deploy (5 Steps)

### Step 1: Login to Azure

```bash
az login
```

### Step 2: Create Resources

```bash
# Set variables
RESOURCE_GROUP="unopim-mcp-rg"
LOCATION="westeurope"
APP_NAME="unopim-mcp-$(date +%s)"  # Unique name
ACR_NAME="unopimmcpacr$(date +%s)"  # Must be globally unique, alphanumeric only

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Azure Container Registry
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled true

# Get ACR credentials
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)
```

### Step 3: Build & Push Docker Image

```bash
# Login to ACR
az acr login --name $ACR_NAME

# Build and push
docker build -t $ACR_LOGIN_SERVER/unopim-mcp:latest .
docker push $ACR_LOGIN_SERVER/unopim-mcp:latest
```

### Step 4: Create App Service

```bash
# Create App Service Plan (B1 is cheapest production tier)
az appservice plan create \
  --name "${APP_NAME}-plan" \
  --resource-group $RESOURCE_GROUP \
  --is-linux \
  --sku B1

# Create Web App with container
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan "${APP_NAME}-plan" \
  --name $APP_NAME \
  --docker-registry-server-url "https://$ACR_LOGIN_SERVER" \
  --docker-registry-server-user $ACR_NAME \
  --docker-registry-server-password $ACR_PASSWORD \
  --deployment-container-image-name "$ACR_LOGIN_SERVER/unopim-mcp:latest"
```

### Step 5: Configure Environment Variables

```bash
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings \
    UNOPIM_BASE_URL="https://your-unopim-instance.com" \
    UNOPIM_CLIENT_ID="your-client-id" \
    UNOPIM_CLIENT_SECRET="your-client-secret" \
    UNOPIM_USERNAME="your-username" \
    UNOPIM_PASSWORD="your-password" \
    UNOPIM_DEFAULT_LOCALE="en_US" \
    UNOPIM_DEFAULT_CURRENCY="USD" \
    WEBSITES_PORT=3000
```

### Step 6: Get Your URL

```bash
echo "Your MCP Server URL: https://${APP_NAME}.azurewebsites.net"
echo "SSE Endpoint: https://${APP_NAME}.azurewebsites.net/sse"
echo "Health Check: https://${APP_NAME}.azurewebsites.net/health"
```

## Test Deployment

```bash
# Health check
curl https://${APP_NAME}.azurewebsites.net/health

# Should return: {"status":"healthy","version":"1.0.0"}
```

## Configure Claude Desktop

Add to `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "unopim": {
      "url": "https://YOUR-APP-NAME.azurewebsites.net/sse"
    }
  }
}
```

---

## Alternative: One-Command Deploy Script

Save all steps to a script:

```bash
./deploy-azure.sh
```

---

## Cost Estimate (POC)

| Resource | SKU | ~Monthly Cost |
|----------|-----|---------------|
| App Service | B1 | ~$13 |
| Container Registry | Basic | ~$5 |
| **Total** | | **~$18/month** |

*Use F1 (Free) tier for App Service during testing - limited to 60 min/day*

---

## Cleanup

```bash
# Delete everything when done
az group delete --name $RESOURCE_GROUP --yes --no-wait
```

---

## Troubleshooting

### Check logs
```bash
az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP
```

### Restart app
```bash
az webapp restart --name $APP_NAME --resource-group $RESOURCE_GROUP
```

### SSH into container
```bash
az webapp ssh --name $APP_NAME --resource-group $RESOURCE_GROUP
```
