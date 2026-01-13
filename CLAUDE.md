# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that acts as an intelligent facade for UnoPim's REST API. The server enables Claude to analyze raw product data and automatically create the necessary data model in UnoPim, including attributes, families, categories, and products.

**Primary use cases:**
- Rapid customer onboarding: Receive product data (CSV/JSON/Excel), analyze structure, and auto-create data model
- Data model evolution: Extend existing models when new product types or attributes are introduced
- Bulk product import after data model is established

## Development Commands

### Setup
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node tsup
npx tsc --init
```

### Build
```bash
npm run build
```

### Local Testing
```bash
# Test with MCP Inspector
npx @modelcontextprotocol/inspector dist/index.js
```

### Environment Variables
Required for each UnoPim instance:
- `UNOPIM_BASE_URL` - UnoPim API base URL (e.g., `https://kunde-a.pim.dk`)
- `UNOPIM_CLIENT_ID` - OAuth2 Client ID
- `UNOPIM_CLIENT_SECRET` - OAuth2 Client Secret
- `UNOPIM_USERNAME` - API username
- `UNOPIM_PASSWORD` - API password
- `UNOPIM_DEFAULT_LOCALE` - Default locale (default: `en_US`)
- `UNOPIM_DEFAULT_CHANNEL` - Default channel (default: `default`)
- `UNOPIM_DEFAULT_CURRENCY` - Default currency (default: `USD`)

## Architecture

### Multi-tenant Design
Each customer gets their own MCP server instance with isolated configuration via environment variables in `claude_desktop_config.json`. The same codebase serves multiple UnoPim instances.

### Project Structure
```
unopim-mcp/
├── src/
│   ├── index.ts              # Entry point, MCP server setup
│   ├── config.ts             # Environment configuration
│   ├── auth/
│   │   └── oauth.ts          # OAuth2 token management
│   ├── client/
│   │   └── unopim-client.ts  # Base API client
│   ├── tools/
│   │   ├── schema.ts         # Schema inspection tools
│   │   ├── attributes.ts     # Attribute management
│   │   ├── families.ts       # Family management
│   │   ├── categories.ts     # Category management
│   │   └── products.ts       # Product management
│   └── types/
│       ├── unopim.ts         # UnoPim API types
│       └── tools.ts          # Tool input/output types
├── package.json
├── tsconfig.json
└── README.md
```

### Implementation Order
Follow this sequence to avoid dependency issues:

1. `src/config.ts` - Environment variables and configuration
2. `src/auth/oauth.ts` - Token management with automatic refresh
3. `src/client/unopim-client.ts` - Base HTTP client with auth
4. `src/types/` - TypeScript interfaces for UnoPim API
5. `src/tools/schema.ts` - Start with read-only tools (get_schema, get_attributes, get_families)
6. `src/tools/attributes.ts`, `families.ts`, etc. - Write operations
7. `src/index.ts` - MCP server setup that registers all tools

## Authentication

UnoPim uses OAuth2 password grant flow. The implementation must:

**Token Request:**
```typescript
const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

const response = await fetch(`${baseUrl}/oauth/token`, {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username,
    password,
    grant_type: 'password'
  })
});
```

**Token Management Requirements:**
- Cache access token in memory (never persist to disk)
- Track expiry and refresh proactively (5 minutes before expiration)
- Automatically refresh on 401 responses
- Implement retry logic with exponential backoff (max 3 attempts: immediate, 1s, 3s)

## MCP Tools

The server exposes 15 tools organized into 5 categories:

### Schema Tools
- `unopim_get_schema` - Fetch complete data model (attributes, families, categories, channels, locales)
- `unopim_get_attributes` - List all attributes with filtering
- `unopim_get_families` - List all product families

### Attribute Tools
- `unopim_create_attribute` - Create new attribute (text, textarea, boolean, date, datetime, number, decimal, price, select, multiselect, image, file)
- `unopim_create_attribute_options` - Create options for select/multiselect attributes

### Attribute Group Tools
- `unopim_create_attribute_group` - Create logical grouping of attributes

### Family Tools
- `unopim_create_family` - Create product family with linked attributes
- `unopim_update_family` - Update existing family with new attributes

### Category Tools
- `unopim_get_categories` - Fetch category tree
- `unopim_create_category` - Create new category with optional parent

### Product Tools
- `unopim_create_product` - Create simple product
- `unopim_create_configurable_product` - Create configurable product with variants
- `unopim_bulk_create_products` - Batch create products with error handling

## Critical Dependencies Order

UnoPim requires strict creation order due to foreign key relationships:

```
1. Locales & Channels (typically pre-configured)
      ↓
2. Attributes
      ↓
3. Attribute Options (for select types)
      ↓
4. Attribute Groups
      ↓
5. Families (references groups and attributes)
      ↓
6. Categories
      ↓
7. Products (references family and categories)
```

**Never** attempt to create a product before its family exists, or a family before its attributes exist.

## Typical Workflow

When handling customer onboarding:

1. Claude analyzes provided product data (CSV/JSON/Excel)
2. Call `unopim_get_schema()` to understand existing setup
3. Create missing attributes via `unopim_create_attribute()`
4. Create options for select attributes via `unopim_create_attribute_options()`
5. Create attribute groups via `unopim_create_attribute_group()`
6. Create or update family via `unopim_create_family()` or `unopim_update_family()`
7. Create categories if needed via `unopim_create_category()`
8. Import products via `unopim_bulk_create_products()`

## Error Handling

All tools return errors in consistent format:
```typescript
{
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: any;
    retry_possible: boolean;
  };
}
```

**Retryable error codes:** `AUTH_FAILED`, `TOKEN_EXPIRED`, `RATE_LIMITED`, `SERVER_ERROR`, `NETWORK_ERROR`

**Non-retryable error codes:** `NOT_FOUND`, `VALIDATION_ERROR`, `DUPLICATE_CODE`, `DEPENDENCY_MISSING`

## Product Data Structure

Products in UnoPim have a complex value structure supporting localization and channels:

```typescript
{
  sku: string;
  family: string;
  values: {
    common?: Record<string, any>;                    // Non-localized values
    categories?: string[];                           // Category codes
    locale_specific?: Record<locale, Record<attr, value>>;
    channel_specific?: Record<channel, Record<attr, value>>;
    channel_locale_specific?: Record<channel, Record<locale, Record<attr, value>>>;
    associations?: {
      up_sells?: string[];
      cross_sells?: string[];
      related_products?: string[];
    };
  };
}
```

**Example:**
```json
{
  "sku": "TSHIRT-001",
  "family": "clothing",
  "values": {
    "common": {
      "color": "black",
      "size": "large",
      "status": "true"
    },
    "categories": ["clothing", "mens", "tshirts"],
    "channel_locale_specific": {
      "default": {
        "da_DK": {
          "name": "Klassisk T-Shirt",
          "description": "<p>Blød bomulds t-shirt</p>",
          "price": {"DKK": "299"}
        }
      }
    }
  }
}
```

## Configurable Products

Configurable products have variants defined by `super_attributes` (typically color, size):

```typescript
{
  sku: "TSHIRT-CONFIG",
  family: "clothing",
  super_attributes: ["color", "size"],  // Must be is_configurable: true
  variants: [
    {
      sku: "TSHIRT-BLACK-S",
      attributes: {"color": "black", "size": "small"}
    },
    {
      sku: "TSHIRT-BLACK-M",
      attributes: {"color": "black", "size": "medium"}
    }
  ]
}
```

Variants are created as separate simple products linked to the parent.

## Input Validation

All tool inputs must be validated using Zod schemas. Key validation rules:

- **Code fields:** Only alphanumeric + underscore (snake_case recommended)
- **Labels:** Must include at least the default locale
- **Required fields:** Strictly enforce required parameters
- **Type checking:** Validate enum values (attribute types, error codes, etc.)

## UnoPim API Endpoints

Base URL format: `https://{customer}.pim.dk/api/v1/rest/`

| Resource | Endpoint |
|----------|----------|
| Auth | `/oauth/token` |
| Locales | `/locales` |
| Channels | `/channels` |
| Categories | `/categories` |
| Attributes | `/attributes` |
| Attribute Options | `/attributes/{code}/options` |
| Attribute Groups | `/attribute-groups` |
| Families | `/families` |
| Products | `/products` |
| Configurable Products | `/configrable-products` (note: typo in API) |

## Security Considerations

- **Never** log or include credentials in error messages
- Token cache must be in-memory only, never persisted
- Validate and sanitize all code fields to prevent injection
- Respect rate limits with client-side throttling
- Implement exponential backoff for 429 responses

## Technology Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript 5.x
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **HTTP Client:** `fetch` (native)
- **Validation:** `zod`
- **Build:** `tsup` or `esbuild`
