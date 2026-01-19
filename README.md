# UnoPim MCP Server 🚀

A powerful **Model Context Protocol (MCP) server** that enables Claude Desktop to manage your UnoPim Product Information Management system. Create products, manage attributes, upload media, and handle complex configurable products - all through natural language conversations with Claude.

## ✨ Features

- **🔌 Full UnoPim API Integration** - Create and manage attributes, families, categories, and products
- **👕 Configurable Products** - Full support for products with variants (e.g., T-shirts with color/size options)
- **📸 Media Upload** - Upload product images and category media via URL or base64
- **🧠 Smart Product Creation** - Automatically validates against family schema before creating
- **🌐 HTTP/SSE Transport** - Expose via ngrok for Claude Desktop remote access
- **🔄 Automatic Token Refresh** - OAuth2 with automatic token management

## 🚀 Quick Start

### 1. Install dependencies

```bash
npm install
npm run build
```

### 2. Configure environment

```bash
export UNOPIM_BASE_URL="http://your-unopim:8000"
export UNOPIM_CLIENT_ID="your_client_id"
export UNOPIM_CLIENT_SECRET="your_client_secret"
export UNOPIM_USERNAME="api-user@email.com"
export UNOPIM_PASSWORD="password"
```

### 3. Start the server

```bash
# HTTP mode (recommended for Claude Desktop)
node dist/index-http.js
```

### 4. Expose via ngrok (for remote access)

```bash
ngrok http 3000
```

## 📋 Claude Desktop Configuration

### Remote HTTP mode (Azure/Cloud) ⭐ Recommended

```json
{
  "mcpServers": {
    "unopim": {
      "url": "https://your-server.azurewebsites.net/mcp"
    }
  }
}
```

### Remote SSE mode (alternative)

```json
{
  "mcpServers": {
    "unopim": {
      "url": "https://your-server.azurewebsites.net/sse"
    }
  }
}
```

### Local (stdio) mode

```json
{
  "mcpServers": {
    "unopim": {
      "command": "node",
      "args": ["/path/to/unopim-mcp/dist/index.js"],
      "env": {
        "UNOPIM_BASE_URL": "https://your-unopim.com",
        "UNOPIM_CLIENT_ID": "your_client_id",
        "UNOPIM_CLIENT_SECRET": "your_client_secret",
        "UNOPIM_USERNAME": "api-user",
        "UNOPIM_PASSWORD": "password"
      }
    }
  }
}
```

## 🛠️ Available Tools (24 tools)

### Schema & Discovery
| Tool | Description |
|------|-------------|
| `unopim_get_schema` | Fetch complete data model |
| `unopim_get_attributes` | List all attributes with types |
| `unopim_get_families` | List all product families |
| `unopim_get_family_schema` | Get detailed schema for a specific family |

### Attribute Management
| Tool | Description |
|------|-------------|
| `unopim_create_attribute` | Create attribute (text, select, boolean, price, etc.) |
| `unopim_create_attribute_options` | Create options for select attributes |
| `unopim_get_attribute_options` | Get options for a select attribute |
| `unopim_get_attribute_groups` | List attribute groups |
| `unopim_create_attribute_group` | Create attribute group |

### Family Management
| Tool | Description |
|------|-------------|
| `unopim_create_family` | Create product family |
| `unopim_update_family` | Update family |

### Category Management
| Tool | Description |
|------|-------------|
| `unopim_get_categories` | Fetch category tree |
| `unopim_create_category` | Create category |

### Product Management
| Tool | Description |
|------|-------------|
| `unopim_get_products` | List products with filtering |
| `unopim_get_product` | Get single product by SKU |
| `unopim_create_product` | Create simple product |
| `unopim_update_product` | Update product |
| `unopim_upsert_product` | Create or update product |
| `unopim_smart_create_product` | ⭐ Auto-validates against family schema |
| `unopim_bulk_create_products` | Batch create products |

### Configurable Products
| Tool | Description |
|------|-------------|
| `unopim_create_configurable_product` | Create parent product with variants |
| `unopim_add_variant` | Add variant to configurable product |
| `unopim_update_configurable_product` | Update configurable product |

### Media Upload ⭐ Automatic Linking
| Tool | Description |
|------|-------------|
| `unopim_upload_product_media` | ⭐ Upload image and **auto-link** to product |
| `unopim_upload_category_media` | Upload image and auto-link to category |

**Note:** Media upload tools now automatically update the product/category with the uploaded file path. Images are immediately visible in UnoPim UI after upload!

---

## 👕 Configurable Products Workflow

Creating a configurable product (e.g., T-shirt with color variants):

### Step 1: Create the configurable product (parent)

```json
{
  "sku": "tshirt-config-001",
  "family": "default",
  "super_attributes": ["color"],
  "values": {
    "common": { "sku": "tshirt-config-001" },
    "channel_locale_specific": {
      "default": {
        "en_US": { "name": "T-Shirt Configurable" }
      }
    },
    "categories": [],
    "associations": { "up_sells": [], "cross_sells": [], "related_products": [] }
  }
}
```

### Step 2: Add variants (one at a time)

```json
{
  "parent": "tshirt-config-001",
  "family": "default",
  "sku": "tshirt-red-001",
  "values": {
    "common": { "sku": "tshirt-red-001", "color": "Red" },
    "channel_locale_specific": {
      "default": {
        "en_US": { "name": "T-Shirt Red" }
      }
    },
    "categories": []
  },
  "variant_attributes": { "color": "Red" }
}
```

### Step 3: Add product image

```json
{
  "sku": "tshirt-red-001",
  "attribute": "image",
  "file_url": "https://example.com/tshirt-red.jpg"
}
```

---

## 📸 Media Upload

Upload product images via URL or base64 - **images are automatically linked to the product**:

```json
// Via URL
{
  "sku": "PROD001",
  "attribute": "image",
  "file_url": "https://example.com/product.jpg"
}

// Via Base64
{
  "sku": "PROD001",
  "attribute": "image",
  "file_base64": "iVBORw0KGgo...",
  "filename": "product-image.jpg"
}
```

**What happens automatically:**
1. ✅ File uploads to UnoPim storage
2. ✅ Attribute metadata fetched to determine scope (common/locale_specific/channel_specific/channel_locale_specific)
3. ✅ Product updated with file path in correct value structure
4. ✅ **Image immediately visible in UnoPim UI**

No manual product update needed - the tool handles everything!

---

## ⚠️ Important API Notes

### Attribute Value Structure

UnoPim attributes have different scoping based on `value_per_locale` and `value_per_channel`:

| Scope | When | Structure |
|-------|------|-----------|
| `common` | Both = 0 | `values.common.attr` |
| `locale_specific` | locale=1, channel=0 | `values.locale_specific.en_US.attr` |
| `channel_specific` | locale=0, channel=1 | `values.channel_specific.default.attr` |
| `channel_locale_specific` | Both = 1 | `values.channel_locale_specific.default.en_US.attr` |

**Example:** The `name` attribute typically requires `channel_locale_specific`:

```json
{
  "values": {
    "common": { "sku": "PROD001" },
    "channel_locale_specific": {
      "default": {
        "en_US": { "name": "Product Name" }
      }
    }
  }
}
```

### 🐛 Known API Quirks

| Issue | Workaround |
|-------|------------|
| Configurable endpoint typo | API uses `/configrable-products` (missing 'u') - MCP server handles this |
| Attribute options array | Returns flat array `[...]` not `{ data: [...] }` |
| Variants not auto-created | Must add variants separately with `unopim_add_variant` |
| Case-sensitive options | Option codes like "Red" must match exactly |

---

## 🔧 Development

```bash
# Build
npm run build

# Watch mode
npm run watch

# Type check
npm run typecheck

# Test with MCP Inspector
npx @modelcontextprotocol/inspector dist/index.js
```

## 📊 Environment Variables

### Required
| Variable | Description |
|----------|-------------|
| `UNOPIM_BASE_URL` | UnoPim API URL (e.g., `http://localhost:8000`) |
| `UNOPIM_CLIENT_ID` | OAuth2 Client ID |
| `UNOPIM_CLIENT_SECRET` | OAuth2 Client Secret |
| `UNOPIM_USERNAME` | API username |
| `UNOPIM_PASSWORD` | API password |

### Optional
| Variable | Default | Description |
|----------|---------|-------------|
| `UNOPIM_DEFAULT_LOCALE` | `en_US` | Default locale |
| `UNOPIM_DEFAULT_CHANNEL` | `default` | Default channel |
| `UNOPIM_DEFAULT_CURRENCY` | `USD` | Default currency |
| `PORT` | `3000` | HTTP server port |

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Claude Desktop │────▶│   ngrok      │────▶│  MCP Server │
│                 │ SSE │              │     │  (Node.js)  │
└─────────────────┘     └──────────────┘     └──────┬──────┘
                                                     │
                                                     │ OAuth2
                                                     │ REST API
                                                     ▼
                                              ┌─────────────┐
                                              │   UnoPim    │
                                              │    PIM      │
                                              └─────────────┘
```

## 📁 Project Structure

```
src/
├── index-http.ts      # HTTP server with SSE (for ngrok)
├── index.ts           # stdio server (for local)
├── config.ts          # Configuration loader
├── auth/
│   └── oauth.ts       # OAuth2 token management
├── client/
│   └── unopim-client.ts  # HTTP client with retry logic
├── tools/
│   ├── attributes.ts  # Attribute CRUD
│   ├── categories.ts  # Category management
│   ├── families.ts    # Family management
│   ├── groups.ts      # Attribute groups
│   ├── products.ts    # Product CRUD + media upload
│   └── schema.ts      # Schema discovery
└── types/
    ├── errors.ts      # Error handling
    ├── oauth.ts       # OAuth types
    └── unopim.ts      # API types
```

---

## 🎉 Example Conversation with Claude

> **You:** Create a T-shirt product family with name, description, price and color attributes

> **Claude:** I'll create the family with those attributes...
> *(Uses `unopim_create_family`, `unopim_create_attribute`, etc.)*

> **You:** Now create a configurable T-shirt with red, blue and green variants at $29.99

> **Claude:** I'll create the configurable product and add the color variants...
> *(Uses `unopim_create_configurable_product`, `unopim_add_variant`)*

> **You:** Upload this image for the red variant: https://example.com/red-shirt.jpg

> **Claude:** Uploading the image to the red variant...
> *(Uses `unopim_upload_product_media`)*

---

## 📄 License

ISC

---

## 🙏 Credits

Built with:
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- [UnoPim PIM](https://unopim.com/)
- [TypeScript](https://www.typescriptlang.org/)

Made with ❤️ for seamless PIM management through AI
