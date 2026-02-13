# UnoPim MCP Server - Quick Start Guide

Get the UnoPim MCP Server up and running in 5 minutes.

## Prerequisites

- Node.js 20+ installed
- Access to a UnoPim instance
- OAuth2 credentials for UnoPim API

## Installation

The server is already built and ready to use!

```bash
cd /path/to/unopim-mcp
./build.sh  # Rebuild if needed
```

## Configuration

### Option 1: Test with Environment Variables

For quick testing, export your credentials:

```bash
export UNOPIM_BASE_URL="https://your-instance.pim.dk"
export UNOPIM_CLIENT_ID="your-client-id"
export UNOPIM_CLIENT_SECRET="your-client-secret"
export UNOPIM_USERNAME="your-username@example.com"
export UNOPIM_PASSWORD="your-password"
export UNOPIM_DEFAULT_LOCALE="da_DK"
export UNOPIM_DEFAULT_CURRENCY="DKK"

# Test connectivity
node dist/test-client.js
```

### Option 2: Configure Claude Desktop (Recommended)

Edit your Claude Desktop configuration file:

**Linux/macOS:** `~/.config/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add this configuration:

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
        "UNOPIM_DEFAULT_CURRENCY": "DKK"
      }
    }
  }
}
```

**Note:** Replace the path with your actual project path and update `UNOPIM_BASE_URL` to your instance URL.

## Verify Installation

### Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector dist/index.js
```

This will open a web interface where you can:
- See all 15 available tools
- Test tool calls interactively
- View request/response data

### Test in Claude Desktop

1. Restart Claude Desktop after configuration
2. Start a new conversation
3. Try these commands:

```
"Can you show me the current UnoPim schema?"
```

```
"List all attributes in the system"
```

```
"Create a new text attribute called 'product_description' with Danish and English labels"
```

## Common Use Cases

### 1. Customer Onboarding

```
"I have a CSV file with product data. Can you analyze it and create the necessary
data model in UnoPim?"
```

Claude will:
1. Call `unopim_get_schema()` to understand existing setup
2. Create missing attributes
3. Create attribute options for select fields
4. Create attribute groups
5. Create or update product family
6. Import products

### 2. Add New Product Attributes

```
"Add a new attribute called 'warranty_period' that stores the warranty in months"
```

Claude will:
1. Create the attribute with appropriate type
2. Add it to relevant families

### 3. Bulk Product Import

```
"Import these 50 products from my JSON file"
```

Claude will:
1. Validate product data
2. Use `unopim_bulk_create_products()` for efficient import
3. Report success/failure for each product

## Available Tools

All 15 tools are available:

### Schema Inspection
- `unopim_get_schema` - Fetch complete datamodel
- `unopim_get_attributes` - List attributes with filters
- `unopim_get_families` - List product families

### Data Modeling
- `unopim_create_attribute` - Create attributes (12 types supported)
- `unopim_create_attribute_options` - Add options to select attributes
- `unopim_create_attribute_group` - Group related attributes
- `unopim_create_family` - Create product families
- `unopim_update_family` - Update existing families

### Categories
- `unopim_get_categories` - Fetch category tree
- `unopim_create_category` - Create categories

### Products
- `unopim_create_product` - Create simple products
- `unopim_create_configurable_product` - Create products with variants
- `unopim_bulk_create_products` - Batch import products

## Troubleshooting

### "Missing required environment variables"

Make sure all credentials are configured either in:
- Environment variables (for testing)
- Claude Desktop config (for production use)

### "Authentication failed"

Verify your credentials:
- Base URL should not have trailing slash
- Client ID and Secret are correct
- Username and password are valid

### "Token expired"

The server handles this automatically. If you still see errors:
- Check your system clock is correct
- Verify UnoPim instance is accessible

### "Cannot find module"

Rebuild the project:
```bash
./build.sh
```

## Next Steps

1. **Read the Tools Reference**: See `TOOLS.md` for detailed tool documentation
2. **Check the Code**: See `CLAUDE.md` for development guidelines
3. **Test with Your Data**: Start importing your product catalogs!

## Support

For issues or questions:
- Check the specification: `specs.md`
- Review implementation: `src/` directory
- Test individual components: `test-client.ts`, `test-config.ts`

## Multi-Tenant Setup

To support multiple customers, add multiple server configurations:

```json
{
  "mcpServers": {
    "unopim-customer-a": {
      "command": "node",
      "args": ["/path/to/unopim-mcp/dist/index.js"],
      "env": {
        "UNOPIM_BASE_URL": "https://customer-a.pim.dk",
        ...
      }
    },
    "unopim-customer-b": {
      "command": "node",
      "args": ["/path/to/unopim-mcp/dist/index.js"],
      "env": {
        "UNOPIM_BASE_URL": "https://customer-b.pim.dk",
        ...
      }
    }
  }
}
```

Each instance runs independently with its own credentials.

---

**Ready to go!** Start using the UnoPim MCP Server in Claude Desktop to streamline your product data management.
