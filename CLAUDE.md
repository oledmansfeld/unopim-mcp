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

The server exposes 24 tools organized into 6 categories:

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
- `unopim_get_products` - List products with filtering
- `unopim_get_product` - Get single product by SKU
- `unopim_update_product` - Update existing product
- `unopim_upsert_product` - Create or update product (checks if SKU exists)
- `unopim_create_configurable_product` - Create configurable product with variants
- `unopim_bulk_create_products` - Batch create products with error handling
- `unopim_delete_product` - Permanently delete a product by SKU (IRREVERSIBLE! For configurable products, delete variants first, then parent)

### Media Upload Tools ⭐ AUTOMATIC LINKING
- `unopim_upload_product_media` - Upload image/file to product AND automatically link it
- `unopim_upload_category_media` - Upload image/file to category AND automatically link it

**IMPORTANT:** Media upload tools are now COMPLETE workflows:
1. Upload file to UnoPim storage
2. Fetch attribute metadata to determine correct scope (common/locale_specific/channel_specific/channel_locale_specific)
3. **Automatically update product/category** with the file path in the correct value structure
4. Return success - **image is immediately visible in UnoPim UI**

You do NOT need to manually update product values after uploading media. The tool handles everything automatically based on the attribute's `value_per_locale` and `value_per_channel` settings.

## ⚠️ MANDATORY: Critical Dependencies Order

**THIS IS THE MOST IMPORTANT SECTION - READ CAREFULLY**

UnoPim has strict foreign key relationships. Creating resources in the wrong order **WILL FAIL**.

### Dependency Hierarchy (MUST follow this order):

```
LEVEL 1: Foundation (typically pre-configured)
├── Locales (e.g., da_DK, en_US)
└── Channels (e.g., default)
         ↓
LEVEL 2: Attributes (MUST exist before families)
├── Create ALL needed attributes first
├── Text, Number, Select, Image, etc.
└── Each attribute has a unique code
         ↓
LEVEL 3: Attribute Options (MUST exist before products use them)
├── Only for select/multiselect attributes
└── Options are case-sensitive!
         ↓
LEVEL 4: Attribute Groups (MUST exist before families reference them)
├── Logical groupings of attributes
└── e.g., "technical_specs", "marketing"
         ↓
LEVEL 5: Families (MUST exist before products)
├── References attribute codes
├── Defines which attributes a product can have
└── Product CANNOT be created without a valid family
         ↓
LEVEL 6: Categories (Can be created anytime before products)
├── Hierarchical tree structure
└── Products reference category codes
         ↓
LEVEL 7: Products (LAST - after everything else exists)
├── Simple products
├── Configurable products (parent FIRST, then variants)
└── References: family, categories, attribute values
         ↓
LEVEL 8: Media (LAST - after products exist)
└── Product must exist before uploading images
```

### ❌ COMMON MISTAKES TO AVOID:

1. **Creating products before family exists** → WILL FAIL
2. **Creating family before attributes exist** → WILL FAIL
3. **Creating variant products before parent product** → WILL FAIL
4. **Using attribute option values that don't exist** → WILL FAIL
5. **Uploading media to non-existent product** → WILL FAIL
6. **Using wrong case for option values** → WILL FAIL (see below!)
7. **Deleting a configurable parent before its variants** → Variants become orphaned! Delete variants FIRST, then parent
8. **Deleting without user confirmation** → Deletion is IRREVERSIBLE, always confirm with the user first

### 🔴 CRITICAL: OPTION CODES MUST BE LOWERCASE

**Option codes MUST be lowercase letters, numbers, and underscores only!**
Pattern: `/^[a-z0-9_]+$/`

This applies to:
- Attribute option codes (color, size, etc.)
- All codes must use lowercase snake_case format

**Example - Color Options:**
```
✅ CORRECT option codes:
{ "code": "black", "labels": {"da_DK": "Sort", "en_US": "Black"} }
{ "code": "navy_blue", "labels": {"da_DK": "Marineblå", "en_US": "Navy Blue"} }
{ "code": "size_xl", "labels": {"da_DK": "XL", "en_US": "XL"} }

❌ WRONG option codes (will fail validation):
{ "code": "Black" }      ← Uppercase = WILL FAIL!
{ "code": "Navy Blue" }  ← Spaces = WILL FAIL!
{ "code": "Size-XL" }    ← Hyphens = WILL FAIL!
```

**Using options in variants:**
```
If you created option: { code: "black", labels: {...} }

✅ CORRECT: variant_attributes: { "color": "black" }
❌ WRONG:   variant_attributes: { "color": "Black" }  ← Wrong case!
❌ WRONG:   variant_attributes: { "color": "Sort" }   ← Wrong! Use CODE not label!
```

**Before using any option value:**
1. Call `unopim_get_attribute_options({ attribute_code: "color" })`
2. Note the EXACT lowercase code values returned (e.g., "black", "red", "navy_blue")
3. Use these EXACT values in your product/variant creation

**Valid vs Invalid option codes:**
| VALID (lowercase) | INVALID (will fail) |
|-------------------|---------------------|
| `black` | `Black` (uppercase) |
| `navy_blue` | `Navy Blue` (spaces) |
| `size_xl` | `Size-XL` (hyphen, uppercase) |
| `color_01` | `Color#01` (special chars) |

## 📋 MANDATORY Pre-Flight Checklist

**BEFORE creating ANY product, you MUST verify:**

### Step 1: Get Current Schema
```
ALWAYS START HERE: unopim_get_schema()
```
This shows you what already exists in UnoPim.

### Step 2: Check/Create Attributes
For EACH attribute your product needs:
```
IF attribute does NOT exist in schema:
  → unopim_create_attribute()

IF attribute is select/multiselect AND needs new options:
  → unopim_create_attribute_options()
```

### Step 3: Check/Create Attribute Groups
```
IF you need a new attribute group:
  → unopim_create_attribute_group()
```

### Step 4: Check/Create Family
```
IF family does NOT exist:
  → unopim_create_family() with ALL attribute codes

IF family exists but missing attributes:
  → unopim_update_family() to add attributes
```

### Step 5: Check/Create Categories
```
IF categories do NOT exist:
  → unopim_create_category()
```

### Step 6: NOW Create Products
```
ONLY AFTER steps 1-5 are complete:
  → unopim_create_product() or unopim_bulk_create_products()
```

### Step 7: Upload Media (LAST)
```
ONLY AFTER product exists:
  → unopim_upload_product_media()
```

## 🔴 SPECIAL RULES FOR CONFIGURABLE PRODUCTS

**Configurable products have EXTRA requirements:**

### Rule 1: Super Attributes MUST be select type with is_configurable=true
```
Before creating configurable product, verify:
- Attribute exists (e.g., "color", "size")
- Attribute type is "select"
- Attribute has is_configurable: true
- Attribute has options defined
```

### Rule 2: Parent Product MUST be created FIRST
```
CORRECT ORDER:
1. Create parent: unopim_create_configurable_product()
2. Then variants: unopim_add_variant() for each variant

WRONG ORDER (WILL FAIL):
1. Create variants first ❌
2. Then try to create parent ❌
```

### Rule 3: Variant attribute values MUST match option codes exactly
```
If color options are: ["Red", "Blue", "Black"]

CORRECT: variant_attributes: { "color": "Red" }
WRONG:   variant_attributes: { "color": "red" }  ← Case sensitive!
```

## ✅ Complete Workflow Example

When user asks to import products, follow this EXACT sequence:

```
1. ANALYZE data to identify:
   - What attributes are needed
   - What families are needed
   - What categories are needed
   - Is this simple or configurable products?

2. GET SCHEMA to see what exists:
   → unopim_get_schema()

3. CREATE MISSING ATTRIBUTES (if any):
   → For each missing attribute:
     unopim_create_attribute({
       code: "attribute_code",
       type: "text|select|number|image|...",
       labels: {"da_DK": "Label", "en_US": "Label"}
     })

4. CREATE ATTRIBUTE OPTIONS (for select/multiselect):
   → For each select attribute needing options:
     unopim_create_attribute_options({
       attribute_code: "color",
       options: [
         {code: "Red", labels: {...}},
         {code: "Blue", labels: {...}}
       ]
     })

5. CREATE/UPDATE ATTRIBUTE GROUPS (if needed):
   → unopim_create_attribute_group({
       code: "group_code",
       labels: {"da_DK": "...", "en_US": "..."}
     })

6. CREATE/UPDATE FAMILY:
   → unopim_create_family({
       code: "family_code",
       labels: {...},
       attribute_codes: ["sku", "name", "description", "price", ...]
     })

   OR if family exists, add missing attributes:
   → unopim_update_family({
       code: "family_code",
       attribute_codes: ["new_attribute_1", "new_attribute_2"]
     })

7. CREATE CATEGORIES (if needed):
   → unopim_create_category({
       code: "category_code",
       labels: {...},
       parent_code: "parent_if_any"
     })

8. CREATE PRODUCTS:
   For SIMPLE products:
   → unopim_create_product() or unopim_bulk_create_products()

   For CONFIGURABLE products:
   → FIRST: unopim_create_configurable_product() ← Parent
   → THEN: unopim_add_variant() for EACH variant ← Children

9. UPLOAD MEDIA (after products exist):
   → unopim_upload_product_media({
       sku: "product_sku",
       attribute: "image",
       file_url: "https://..."
     })
```

## ⚡ Quick Reference: Tool Order

| When you want to... | First ensure... | Then call... |
|---------------------|-----------------|--------------|
| Create a product | Family exists | `unopim_create_product` |
| Create a family | Attributes exist | `unopim_create_family` |
| Create configurable product | Super attributes are select type | `unopim_create_configurable_product` |
| Add a variant | Parent product exists | `unopim_add_variant` |
| Upload product image | Product exists | `unopim_upload_product_media` |
| Use select option value | Option exists in attribute | Check `unopim_get_attribute_options` |

## 🚫 What NOT to do

```
❌ NEVER skip step 1 (get_schema)
❌ NEVER create product without checking family exists
❌ NEVER create variant before parent configurable product
❌ NEVER assume attributes/options exist - always verify
❌ NEVER upload media before product is created
❌ NEVER use option values that don't exist (case sensitive!)
❌ NEVER delete products without explicit user confirmation (irreversible!)
❌ NEVER delete a configurable parent before deleting its variants
```

## 💡 Tips for Success

1. **Always start with `unopim_get_schema()`** - This shows what exists
2. **When in doubt, check first** - Use get_ tools before create_ tools
3. **Create dependencies bottom-up** - Attributes → Groups → Families → Products
4. **For configurable products** - Parent FIRST, then variants one by one
5. **Media is always LAST** - Product must exist before uploading images

## Typical Workflow Summary

```
📊 Analyze Data
     ↓
🔍 unopim_get_schema() - Check what exists
     ↓
➕ Create missing Attributes
     ↓
➕ Create Attribute Options (for select types)
     ↓
➕ Create Attribute Groups (if needed)
     ↓
➕ Create/Update Family
     ↓
➕ Create Categories (if needed)
     ↓
📦 Create Products (parent before variants!)
     ↓
📸 Upload Media (last step)
```

**Note on Media Upload:**
- Always upload media AFTER creating the product
- Use `unopim_upload_product_media()` for product images/files
- The tool automatically determines the correct value scope and updates the product
- Images are immediately visible in UnoPim UI after successful upload
- No manual product update needed - it's fully automated

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
