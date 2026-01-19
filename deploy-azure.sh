#!/bin/bash
# Azure Deployment Script for UnoPim MCP Server
# Usage: ./deploy-azure.sh

set -e

echo "🚀 UnoPim MCP Server - Azure Deployment"
echo "========================================"

# Configuration - Microsoft naming conventions
# Format: {resource-type}-{workload}-{environment}-{region}-{instance}
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-unopim-mcp-dev-weu-001}"
LOCATION="${LOCATION:-westeurope}"
APP_NAME="${APP_NAME:-app-unopim-mcp-dev-weu-001}"
ACR_NAME="${ACR_NAME:-acrunopimmcpdevweu001}"
APP_SERVICE_PLAN="${APP_SERVICE_PLAN:-asp-unopim-mcp-dev-weu-001}"

echo ""
echo "Configuration:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Location: $LOCATION"
echo "  App Name: $APP_NAME"
echo "  ACR Name: $ACR_NAME"
echo ""

# Check prerequisites
command -v az >/dev/null 2>&1 || { echo "❌ Azure CLI not installed. Install from https://docs.microsoft.com/cli/azure/install-azure-cli"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker not installed."; exit 1; }

# Check Azure login
az account show >/dev/null 2>&1 || { echo "❌ Not logged in to Azure. Run 'az login' first."; exit 1; }

echo "✅ Prerequisites checked"

# Build locally first
echo ""
echo "📦 Building project..."
npm run build

# Step 1: Create Resource Group
echo ""
echo "1️⃣ Creating Resource Group..."
az group create --name $RESOURCE_GROUP --location $LOCATION --output none
echo "   ✅ Resource group created"

# Step 2: Create Container Registry
echo ""
echo "2️⃣ Creating Azure Container Registry..."
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled true --output none
echo "   ✅ Container registry created"

# Get ACR details
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

# Step 3: Build and Push Docker Image
echo ""
echo "3️⃣ Building and pushing Docker image..."
az acr login --name $ACR_NAME
docker build -t $ACR_LOGIN_SERVER/unopim-mcp:latest .
docker push $ACR_LOGIN_SERVER/unopim-mcp:latest
echo "   ✅ Image pushed to registry"

# Step 4: Create App Service Plan
echo ""
echo "4️⃣ Creating App Service Plan..."
az appservice plan create \
  --name "$APP_SERVICE_PLAN" \
  --resource-group $RESOURCE_GROUP \
  --is-linux \
  --sku B1 \
  --output none
echo "   ✅ App Service Plan created"

# Step 5: Create Web App
echo ""
echo "5️⃣ Creating Web App..."
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan "$APP_SERVICE_PLAN" \
  --name $APP_NAME \
  --docker-registry-server-url "https://$ACR_LOGIN_SERVER" \
  --docker-registry-server-user $ACR_NAME \
  --docker-registry-server-password "$ACR_PASSWORD" \
  --deployment-container-image-name "$ACR_LOGIN_SERVER/unopim-mcp:latest" \
  --output none
echo "   ✅ Web App created"

# Step 6: Configure port
echo ""
echo "6️⃣ Configuring app settings..."
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings WEBSITES_PORT=3000 \
  --output none
echo "   ✅ Port configured"

# Done!
echo ""
echo "========================================"
echo "🎉 Deployment Complete!"
echo "========================================"
echo ""
echo "📍 Your MCP Server URL:"
echo "   https://${APP_NAME}.azurewebsites.net"
echo ""
echo "🔄 Streamable HTTP (recommended):"
echo "   https://${APP_NAME}.azurewebsites.net/mcp"
echo ""
echo "📡 SSE Endpoint (legacy):"
echo "   https://${APP_NAME}.azurewebsites.net/sse"
echo ""
echo "💚 Health Check:"
echo "   https://${APP_NAME}.azurewebsites.net/health"
echo ""
echo "⚠️  NEXT STEP: Configure environment variables:"
echo ""
echo "az webapp config appsettings set \\"
echo "  --resource-group $RESOURCE_GROUP \\"
echo "  --name $APP_NAME \\"
echo "  --settings \\"
echo "    UNOPIM_BASE_URL=\"https://your-unopim.com\" \\"
echo "    UNOPIM_CLIENT_ID=\"your-client-id\" \\"
echo "    UNOPIM_CLIENT_SECRET=\"your-client-secret\" \\"
echo "    UNOPIM_USERNAME=\"your-username\" \\"
echo "    UNOPIM_PASSWORD=\"your-password\""
echo ""
echo "📋 Claude Desktop config:"
echo '{'
echo '  "mcpServers": {'
echo '    "unopim": {'
echo "      \"url\": \"https://${APP_NAME}.azurewebsites.net/mcp\""
echo '    }'
echo '  }'
echo '}'
echo ""
echo "🗑️  To delete everything later:"
echo "   az group delete --name $RESOURCE_GROUP --yes"
