# UnoPim MCP Server - Overview

## What is the UnoPim MCP Server?

The UnoPim MCP (Model Context Protocol) Server is an intelligent interface that enables Claude Desktop and other AI assistants to manage your UnoPim Product Information Management system through natural language conversations.

## Key Capabilities

### 🤖 Natural Language Control
Talk to Claude to manage your PIM system:
- "Create a new product family for electronics with these attributes..."
- "Import 500 products from this CSV file"
- "Upload product images for all items in the coffee machines category"

### 🔌 Full UnoPim API Integration
- Complete CRUD operations for products, families, attributes, and categories
- OAuth2 authentication with automatic token refresh
- Automatic retry logic for failed requests
- Smart error handling and validation

### 📸 Intelligent Media Upload
- Upload product images from URLs or base64 data
- **Automatic linking** - images appear immediately in UnoPim UI
- Smart scope detection (common/locale/channel/channel-locale)
- Supports both product and category media

### 👕 Configurable Product Support
- Full support for products with variants (e.g., T-shirts with color/size options)
- Parent/variant relationship management
- Automatic variant attribute validation

### 🧠 Smart Product Creation
- Validates product data against family schema before creation
- Auto-detects correct value scopes based on attribute settings
- Bulk import with error handling (continue on error or stop)

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Claude Desktop │────▶│   ngrok      │────▶│  MCP Server │
│                 │ SSE │   (tunnel)   │     │  (Node.js)  │
└─────────────────┘     └──────────────┘     └──────┬──────┘
                                                     │
                                                     │ OAuth2
                                                     │ REST API
                                                     ▼
                                              ┌─────────────┐
                                              │   UnoPim    │
                                              │ PIM System  │
                                              └─────────────┘
```

## Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ |
| Language | TypeScript 5.x |
| MCP SDK | @modelcontextprotocol/sdk |
| HTTP Client | Native fetch API |
| Validation | Zod |
| Build Tool | Custom build.sh / TypeScript |

## Use Cases

### 1. Rapid Customer Onboarding
- Receive product data (CSV/JSON/Excel)
- Analyze structure automatically
- Create data model (attributes, families, categories)
- Import all products in minutes

### 2. Data Model Evolution
- Add new attributes when product types expand
- Update families with new requirements
- Extend existing models without manual API calls

### 3. Bulk Operations
- Import hundreds of products at once
- Upload images for entire product catalogs
- Update product data across multiple items

### 4. Interactive PIM Management
- Ask Claude "What attributes are in the electronics family?"
- Request "Show me all products without images"
- Command "Update all coffee machine prices by 10%"

## Key Features

### Multi-tenant Design
- Each customer gets their own MCP server instance
- Isolated configuration via environment variables
- Same codebase serves multiple UnoPim instances

### Automatic Token Management
- OAuth2 password grant flow
- Tokens cached in memory (never persisted to disk)
- Automatic refresh 5 minutes before expiration
- Automatic retry on 401 responses

### Smart Error Handling
- Consistent error format across all tools
- Retryable vs non-retryable error classification
- Detailed error messages with context
- Validation errors with field-level detail

### Production Ready
- Built-in retry logic with exponential backoff
- Rate limiting awareness
- Security best practices
- Comprehensive logging

## Tool Categories

The MCP server exposes **24 tools** organized into **6 categories**:

1. **Schema & Discovery** (4 tools) - Explore data model
2. **Attribute Management** (5 tools) - Create and manage attributes
3. **Family Management** (2 tools) - Product family operations
4. **Category Management** (2 tools) - Category tree operations
5. **Product Management** (9 tools) - Product CRUD and bulk operations
6. **Media Upload** (2 tools) - Image/file upload with auto-linking

## Getting Started

See child pages:
- **Installation & Setup** - How to install and configure
- **Available Tools Reference** - Complete tool documentation
- **Usage Examples** - Common workflows and examples
- **Troubleshooting** - Common issues and solutions

## Benefits

### For Developers
- ✅ No need to write custom API integration code
- ✅ Natural language interface reduces development time
- ✅ Built-in validation and error handling
- ✅ Comprehensive TypeScript types

### For Business Users
- ✅ Import products through conversation
- ✅ No technical knowledge required
- ✅ Fast onboarding of new customers
- ✅ Self-service data management

### For Operations
- ✅ Consistent data quality through validation
- ✅ Audit trail through Claude conversation history
- ✅ Reduced manual data entry errors
- ✅ Faster time-to-market for new products

## Security Considerations

### ✅ What's Secure
- OAuth2 credentials in environment variables only
- Tokens never persisted to disk
- No credentials in logs or error messages
- Input validation on all tool calls

### ⚠️ Important Notes
- Credentials in `claude_desktop_config.json` are stored in plaintext
- For production, use secrets management (Azure Key Vault, AWS Secrets Manager)
- Implement rate limiting and monitoring
- Use separate credentials per environment (dev/staging/prod)

## Support & Documentation

- **GitHub Repository**: [unopim-mcp](https://github.com/your-org/unopim-mcp)
- **UnoPim Documentation**: [unopim.com/docs](https://unopim.com/docs)
- **Claude MCP Guide**: [docs.anthropic.com/mcp](https://docs.anthropic.com)

---

**Last Updated**: 2026-01-13
**Version**: 1.0.0
**Status**: ✅ Production Ready
