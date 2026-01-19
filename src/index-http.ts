#!/usr/bin/env node

/**
 * UnoPim MCP Server - HTTP Transport
 * Exposes MCP server over HTTP for remote access (e.g., via ngrok)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import http from 'http';
import crypto from 'crypto';

import { loadConfig } from './config.js';
import { OAuthManager } from './auth/oauth.js';
import { UnoPimClient } from './client/unopim-client.js';

// Import tool implementations
import {
  getSchema,
  getAttributes,
  getFamilies,
  GetSchemaInputSchema,
  GetAttributesInputSchema,
  GetFamiliesInputSchema,
} from './tools/schema.js';

import {
  createAttribute,
  createAttributeOptions,
  getAttributeOptions,
  CreateAttributeInputSchema,
  CreateAttributeOptionsInputSchema,
  GetAttributeOptionsInputSchema,
} from './tools/attributes.js';

import {
  getAttributeGroups,
  createAttributeGroup,
  GetAttributeGroupsInputSchema,
  CreateAttributeGroupInputSchema,
} from './tools/groups.js';

import {
  createFamily,
  updateFamily,
  CreateFamilyInputSchema,
  UpdateFamilyInputSchema,
} from './tools/families.js';

import {
  getCategories,
  createCategory,
  GetCategoriesInputSchema,
  CreateCategoryInputSchema,
} from './tools/categories.js';

import {
  createProduct,
  createConfigurableProduct,
  bulkCreateProducts,
  getProducts,
  getProduct,
  updateProduct,
  upsertProduct,
  smartCreateProduct,
  getFamilySchema,
  uploadProductMedia,
  uploadCategoryMedia,
  CreateProductInputSchema,
  CreateConfigurableProductInputSchema,
  BulkCreateProductsInputSchema,
  GetProductsInputSchema,
  GetProductInputSchema,
  UpdateProductInputSchema,
  UpsertProductInputSchema,
  SmartCreateProductInputSchema,
  GetFamilySchemaInputSchema,
  UploadProductMediaInputSchema,
  UploadCategoryMediaInputSchema,
} from './tools/products.js';

// ============================================================================
// HTTP Server Setup
// ============================================================================

class UnoPimHttpServer {
  private server: Server;
  private client: UnoPimClient;
  private httpServer!: http.Server;
  private port: number;
  private transports: Map<string, SSEServerTransport> = new Map();
  private streamableTransports: Map<string, StreamableHTTPServerTransport> = new Map();
  private apiKey: string | undefined;

  constructor(port: number = 3000) {
    this.port = port;
    this.apiKey = process.env.MCP_API_KEY || process.env.UNOPIM_CLIENT_ID;

    // Load configuration
    const config = loadConfig();

    // Initialize OAuth manager
    const authManager = new OAuthManager(config.baseUrl, {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      username: config.username,
      password: config.password,
    });

    // Initialize UnoPim client
    this.client = new UnoPimClient(config.baseUrl, authManager);

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'unopim-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupHttpServer();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Schema Tools
        {
          name: 'unopim_get_schema',
          description: 'Fetch complete datamodel overview from UnoPim including attributes, families, categories, channels, and locales',
          inputSchema: {
            type: 'object',
            properties: {
              include_attributes: { type: 'boolean', default: true },
              include_families: { type: 'boolean', default: true },
              include_categories: { type: 'boolean', default: true },
              include_channels: { type: 'boolean', default: false },
              include_locales: { type: 'boolean', default: false },
            },
          },
        },
        {
          name: 'unopim_get_attributes',
          description: 'List all attributes with optional filtering by type or group',
          inputSchema: {
            type: 'object',
            properties: {
              filter_by_type: { type: 'string' },
              filter_by_group: { type: 'string' },
              limit: { type: 'number', default: 100 },
              page: { type: 'number', default: 1 },
            },
          },
        },
        {
          name: 'unopim_get_families',
          description: 'List all product families',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', default: 100 },
              page: { type: 'number', default: 1 },
            },
          },
        },
        {
          name: 'unopim_create_attribute',
          description: `Create a new attribute in UnoPim.

IMPORTANT - Attribute Types:
- type must be one of: text, textarea, boolean, price, select, multiselect, image
- For NUMBER/INTEGER fields: use type="text" with validation="number"
- For DECIMAL/FLOAT fields: use type="text" with validation="decimal"
- For EMAIL fields: use type="text" with validation="email"
- For URL fields: use type="text" with validation="url"
- For DATE fields: use type="text" (dates are stored as text)

Example for decimal attribute:
{
  "code": "weight",
  "type": "text",
  "validation": "decimal",
  "labels": { "en_US": "Weight" }
}`,
          inputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'Unique attribute code (lowercase, underscores allowed)' },
              type: { type: 'string', enum: ['text', 'textarea', 'boolean', 'price', 'select', 'multiselect', 'image'], description: 'Attribute type. Use "text" with validation for number/decimal/email/url' },
              validation: { type: 'string', enum: ['decimal', 'number', 'email', 'url', 'regexp'], description: 'Validation rule for text fields. Use "decimal" for floats, "number" for integers' },
              labels: { type: 'object', description: 'Labels by locale, e.g. { "en_US": "My Label" }' },
              is_required: { type: 'boolean', default: false },
              is_unique: { type: 'boolean', default: false },
              is_configurable: { type: 'boolean', default: false, description: 'Set true for attributes used in configurable products (e.g., color, size)' },
              value_per_locale: { type: 'boolean', default: false },
              value_per_channel: { type: 'boolean', default: false },
            },
            required: ['code', 'type', 'labels'],
          },
        },
        {
          name: 'unopim_create_attribute_options',
          description: `Create options for select/multiselect attributes.

🔴 CRITICAL: Option codes MUST be lowercase with underscores only!
Pattern: /^[a-z0-9_]+$/

Example:
{
  "attribute_code": "color",
  "options": [
    { "code": "black", "labels": { "da_DK": "Sort", "en_US": "Black" }, "sort_order": 1 },
    { "code": "white", "labels": { "da_DK": "Hvid", "en_US": "White" }, "sort_order": 2 },
    { "code": "navy_blue", "labels": { "da_DK": "Marineblå", "en_US": "Navy Blue" }, "sort_order": 3 }
  ]
}

⚠️ When you later create variants, use the EXACT same code:
✅ CORRECT: { "color": "black" }
❌ WRONG:   { "color": "Black" }  ← Uppercase = WILL FAIL!
❌ WRONG:   { "color": "Sort" }   ← This is the LABEL, not the CODE!

VALID: lowercase letters, numbers, underscores (black, size_xl, color_01)
INVALID: uppercase, spaces, special chars (Black, Size XL, Color-01)`,
          inputSchema: {
            type: 'object',
            properties: {
              attribute_code: { type: 'string', description: 'The attribute code to add options to' },
              options: { type: 'array', description: 'Array of options with code, labels, sort_order' },
            },
            required: ['attribute_code', 'options'],
          },
        },
        {
          name: 'unopim_get_attribute_options',
          description: `Get all options for a select/multiselect attribute.

⚠️ ALWAYS call this BEFORE using option values in products/variants!
Option codes are always lowercase - use them exactly as returned.

Use this to:
1. Check which options already exist
2. Get the EXACT code values to use in products/variants (e.g., "black", "navy_blue")
3. Verify correct lowercase format before creating variants`,
          inputSchema: {
            type: 'object',
            properties: {
              attribute_code: { type: 'string', description: 'The attribute code (e.g., "color", "size")' },
            },
            required: ['attribute_code'],
          },
        },
        {
          name: 'unopim_get_attribute_groups',
          description: `Get all attribute groups from UnoPim.

Attribute groups are used to organize attributes in families. Use this to:
1. Check which groups exist before creating a family
2. Find group codes to reference in families

Common groups: "general", "marketing", "technical", "media"`,
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', default: 100 },
              page: { type: 'number', default: 1 },
            },
          },
        },
        {
          name: 'unopim_create_attribute_group',
          description: `Create a new attribute group. Groups organize attributes within families.

WORKFLOW for setting up a product structure:
1. Create attribute groups (e.g., "general", "prices", "media")
2. Create attributes (e.g., "name", "price", "image")
3. Create family with groups and assign attributes to groups
4. Create products using the family

Example:
{
  "code": "technical_specs",
  "labels": { "en_US": "Technical Specifications", "da_DK": "Tekniske Specifikationer" }
}`,
          inputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'Unique group code (lowercase, underscores)' },
              labels: { type: 'object', description: 'Labels by locale' },
              position: { type: 'number', description: 'Sort order position' },
            },
            required: ['code', 'labels'],
          },
        },
        {
          name: 'unopim_create_family',
          description: `Create a product family. Families define which attributes a product type has.

⚠️ MANDATORY PRE-REQUISITES:
1. Call unopim_get_schema() FIRST to check what exists
2. ALL attributes in custom_attributes MUST exist (use unopim_create_attribute first!)
3. For select/multiselect attributes, options MUST exist (use unopim_create_attribute_options)
4. ONLY THEN create the family

❌ THIS WILL FAIL IF:
- Any attribute code in custom_attributes does not exist
- Attribute group code is invalid

✅ CORRECT ORDER:
1. unopim_get_attributes() - Check what exists
2. unopim_create_attribute() - For EACH missing attribute
3. unopim_create_attribute_options() - For select/multiselect types
4. unopim_create_family() - Only after all attributes exist

IMPORTANT - attribute_groups format:
Each group MUST have: code, position (number), custom_attributes (array)

Example:
{
  "code": "clothing",
  "labels": { "en_US": "Clothing" },
  "attribute_groups": [
    {
      "code": "general",
      "position": 1,
      "custom_attributes": [
        { "code": "sku", "position": 1 },
        { "code": "name", "position": 2 }
      ]
    }
  ]
}`,
          inputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'Unique family code' },
              labels: { type: 'object', description: 'Labels by locale' },
              attribute_groups: { 
                type: 'array', 
                description: 'Array of attribute groups. Each group needs: code (string), position (number, REQUIRED), custom_attributes (array of {code, position}, REQUIRED)'
              },
            },
            required: ['code', 'labels', 'attribute_groups'],
          },
        },
        {
          name: 'unopim_update_family',
          description: 'Update an existing family',
          inputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              add_attributes: { type: 'array' },
              remove_attributes: { type: 'array' },
              update_labels: { type: 'object' },
            },
            required: ['code'],
          },
        },
        {
          name: 'unopim_get_categories',
          description: 'Fetch category tree',
          inputSchema: {
            type: 'object',
            properties: {
              parent_code: { type: 'string' },
              limit: { type: 'number', default: 100 },
              page: { type: 'number', default: 1 },
            },
          },
        },
        {
          name: 'unopim_create_category',
          description: `Create a new category in the product catalog.

Example:
{
  "code": "electronics",
  "parent": "root",
  "labels": { "en_US": "Electronics" },
  "additional_data": {
    "locale_specific": { "en_US": { "description": "Electronic products" } }
  }
}

NOTE: Use "root" or null for top-level categories`,
          inputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'Unique category code' },
              parent: { type: 'string', description: 'Parent category code. Use "root" or null for top-level' },
              labels: { type: 'object', description: 'Labels by locale, e.g. { "en_US": "Category Name" }' },
              additional_data: { type: 'object', description: 'Additional category fields (locale_specific, etc.)' },
            },
            required: ['code', 'labels'],
          },
        },
        {
          name: 'unopim_create_product',
          description: `Create a simple product in UnoPim.

⚠️ MANDATORY PRE-REQUISITES (in order):
1. Call unopim_get_schema() FIRST to check what exists
2. Ensure ALL required attributes exist (use unopim_create_attribute if not)
3. Ensure attribute options exist for select types (use unopim_create_attribute_options)
4. Ensure family exists (use unopim_create_family if not)
5. Ensure categories exist (use unopim_create_category if not)
6. ONLY THEN create the product

❌ THIS WILL FAIL IF:
- Family does not exist
- Required attributes missing from family
- Category codes don't exist
- Using option values that don't exist (case-sensitive!)

WORKING EXAMPLE:
{
  "sku": "product-001",
  "family": "default",
  "values": {
    "common": { "sku": "product-001" },
    "channel_locale_specific": {
      "default": {
        "en_US": {
          "name": "Product Name",
          "price": { "EUR": "99.99" },
          "description": "<p>Description</p>"
        }
      }
    },
    "categories": ["category_code"],
    "associations": {
      "up_sells": [],
      "cross_sells": [],
      "related_products": []
    }
  }
}

CRITICAL NOTES:
- "name" attribute requires channel_locale_specific format (NOT common!) because it has value_per_locale=1 AND value_per_channel=1
- categories goes at top level of values, NOT inside common!
- To create a variant of a configurable product, use unopim_add_variant instead`,
          inputSchema: {
            type: 'object',
            properties: {
              sku: { type: 'string', description: 'Unique product SKU' },
              family: { type: 'string', description: 'Family code (e.g., "default", "clothing")' },
              values: { 
                type: 'object', 
                description: 'Product values with: common (attributes), categories (array at top level!), locale_specific, channel_specific, associations'
              },
            },
            required: ['sku', 'family', 'values'],
          },
        },
        {
          name: 'unopim_create_configurable_product',
          description: `Create a configurable product (parent product with variants like T-shirt with colors).

🔴 CRITICAL: CREATE PARENT FIRST, THEN VARIANTS!
This creates the PARENT product only. Variants must be added AFTER with unopim_add_variant.

⚠️ MANDATORY PRE-REQUISITES (in order):
1. Call unopim_get_schema() FIRST to check what exists
2. Ensure super_attributes exist as SELECT type with is_configurable=true
3. Ensure super_attributes have OPTIONS defined (use unopim_get_attribute_options)
4. Ensure ALL other required attributes exist
5. Ensure family exists with all attributes
6. ONLY THEN create the configurable product (parent)
7. AFTER parent exists, add variants with unopim_add_variant

❌ COMMON MISTAKES (WILL FAIL):
- Creating variants before parent product
- Using non-select type as super_attribute
- Super_attribute missing is_configurable=true flag
- Options don't exist for super_attributes

✅ CORRECT ORDER:
1. unopim_create_configurable_product() ← Creates PARENT only
2. unopim_add_variant() ← Add variant 1
3. unopim_add_variant() ← Add variant 2
4. ... repeat for each variant

WORKING EXAMPLE:
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

CRITICAL NOTES:
- "name" MUST be in channel_locale_specific (NOT common!)
- super_attributes must be select-type attributes (e.g., color, size)
- The "variants" array is IGNORED by API - use unopim_add_variant instead
- Use unopim_get_attribute_options to find valid option codes`,
          inputSchema: {
            type: 'object',
            properties: {
              sku: { type: 'string', description: 'Unique SKU for the configurable product' },
              family: { type: 'string', description: 'Family code' },
              super_attributes: { type: 'array', description: 'Array of attribute codes used for variants (e.g., ["color", "size"])' },
              values: { type: 'object', description: 'Product values with common, categories, associations, channel_specific, channel_locale_specific' },
              variants: { type: 'array', description: 'Array of variants, each with sku and attributes object matching super_attributes' },
            },
            required: ['sku', 'family', 'super_attributes', 'values'],
          },
        },
        {
          name: 'unopim_add_variant',
          description: `Add a variant (child product) to an existing configurable product.

🔴 CRITICAL: PARENT MUST EXIST FIRST!
The parent configurable product MUST be created with unopim_create_configurable_product BEFORE calling this.

🔴 CRITICAL: OPTION VALUES MUST BE LOWERCASE!
Option codes are always lowercase with underscores only (e.g., "red", "navy_blue", "size_xl")

❌ THIS WILL FAIL IF:
- Parent product does not exist
- Parent is not a configurable product
- variant_attributes don't match parent's super_attributes
- Option values not lowercase (e.g., "Red" instead of "red")

✅ CORRECT ORDER:
1. FIRST: unopim_create_configurable_product() ← Parent
2. THEN: unopim_add_variant() ← This tool, for each variant

WORKING EXAMPLE:
{
  "parent": "tshirt-config-001",
  "family": "default",
  "sku": "tshirt-red-001",
  "values": {
    "common": { "sku": "tshirt-red-001", "color": "red" },
    "channel_locale_specific": {
      "default": {
        "en_US": { "name": "T-Shirt Red" }
      }
    },
    "categories": []
  },
  "variant_attributes": { "color": "red" }
}

CRITICAL NOTES:
- parent must be an existing configurable product SKU (create it first!)
- variant_attributes MUST match the super_attributes of the parent
- Option values MUST be lowercase (e.g., "red" not "Red")
- Also set the super_attribute value in values.common (e.g., "color": "red")
- "name" MUST be in channel_locale_specific (NOT common!)
- Use unopim_get_attribute_options to verify correct option codes
- family must be same as parent's family`,
          inputSchema: {
            type: 'object',
            properties: {
              parent: { type: 'string', description: 'SKU of the parent configurable product' },
              family: { type: 'string', description: 'Family code (same as parent)' },
              sku: { type: 'string', description: 'Unique SKU for the variant' },
              values: { type: 'object', description: 'Product values with common, categories, associations, channel_specific, channel_locale_specific' },
              variant_attributes: { type: 'object', description: 'Object with super_attribute values, e.g., { "color": "red", "size": "small" }' },
            },
            required: ['parent', 'family', 'sku', 'values', 'variant_attributes'],
          },
        },
        {
          name: 'unopim_update_configurable_product',
          description: `Update an existing configurable product's values.

WORKING EXAMPLE:
{
  "sku": "tshirt-config-001",
  "values": {
    "common": { "sku": "tshirt-config-001" },
    "channel_locale_specific": {
      "default": {
        "en_US": { "name": "T-Shirt Configurable Updated" }
      }
    },
    "categories": ["clothing"],
    "associations": { "up_sells": [], "cross_sells": [], "related_products": [] }
  },
  "super_attributes": ["color"]
}

NOTES:
- Uses PUT to /api/v1/rest/configrable-products/{sku} (note: typo in API endpoint)
- "name" MUST be in channel_locale_specific (NOT common!)
- To add new variants, use unopim_add_variant`,
          inputSchema: {
            type: 'object',
            properties: {
              sku: { type: 'string', description: 'SKU of the configurable product to update' },
              values: { type: 'object', description: 'Product values with common, categories, associations' },
              super_attributes: { type: 'array', description: 'Array of attribute codes used for variants' },
              variants: { type: 'array', description: 'Array of variants with sku and attributes' },
            },
            required: ['sku', 'values'],
          },
        },
        {
          name: 'unopim_bulk_create_products',
          description: 'Batch create multiple products',
          inputSchema: {
            type: 'object',
            properties: {
              products: { type: 'array' },
              on_error: { type: 'string', enum: ['stop', 'continue'], default: 'continue' },
            },
            required: ['products'],
          },
        },
        {
          name: 'unopim_get_products',
          description: 'List products with optional filtering by SKU, family, or type',
          inputSchema: {
            type: 'object',
            properties: {
              filter_sku: { type: 'string', description: 'Filter by SKU (partial match)' },
              filter_family: { type: 'string', description: 'Filter by family code' },
              filter_type: { type: 'string', enum: ['simple', 'configurable'], description: 'Filter by product type' },
              limit: { type: 'number', default: 100 },
              page: { type: 'number', default: 1 },
            },
          },
        },
        {
          name: 'unopim_get_product',
          description: 'Get a single product by SKU. Returns found=false if product does not exist.',
          inputSchema: {
            type: 'object',
            properties: {
              sku: { type: 'string', description: 'The product SKU' },
            },
            required: ['sku'],
          },
        },
        {
          name: 'unopim_update_product',
          description: 'Update an existing product by SKU',
          inputSchema: {
            type: 'object',
            properties: {
              sku: { type: 'string', description: 'The product SKU to update' },
              values: { type: 'object', description: 'The product values to update' },
            },
            required: ['sku', 'values'],
          },
        },
        {
          name: 'unopim_upsert_product',
          description: `Create or update a product. If SKU exists, updates it; otherwise creates new product.

IMPORTANT - values structure (same as create_product):
{
  "common": { "sku": "ABC123", "name": "Product Name" },
  "categories": ["category_code1"],
  "locale_specific": { "en_US": { "description": "Desc" } },
  "channel_specific": { "default": { "attr": "value" } }
}

NOTE: categories at top level of values, NOT inside common!`,
          inputSchema: {
            type: 'object',
            properties: {
              sku: { type: 'string', description: 'The product SKU' },
              family: { type: 'string', description: 'The family code (required for creation)' },
              values: { type: 'object', description: 'The product values' },
            },
            required: ['sku', 'family', 'values'],
          },
        },
        {
          name: 'unopim_get_family_schema',
          description: `Get detailed schema for a product family. Returns:
- All attributes in the family with their types and scopes
- Which attributes are REQUIRED vs optional
- Correct structure for values object
- Example values template

ALWAYS call this BEFORE creating products to understand:
1. What attributes are required
2. Where each attribute should go (common, locale_specific, channel_locale_specific)

This is essential because required fields and scopes are configurable per installation!`,
          inputSchema: {
            type: 'object',
            properties: {
              family: { type: 'string', description: 'The family code to get schema for' },
            },
            required: ['family'],
          },
        },
        {
          name: 'unopim_smart_create_product',
          description: `RECOMMENDED: Intelligently creates a product with automatic value structuring.

Unlike basic create_product, this tool:
1. Fetches family schema to understand required fields
2. Auto-places values in correct scope (common/locale/channel)
3. Validates BEFORE submission
4. Returns detailed error info

USAGE: Provide flat values object - tool auto-structures it:
{
  "sku": "PROD001",
  "family": "default",
  "locale": "en_US",
  "channel": "default",
  "values": {
    "sku": "PROD001",
    "url_key": "prod001",
    "name": "My Product",
    "description": "<p>Description</p>",
    "price": {"EUR": "99.99"}
  },
  "validate_only": false
}

The tool knows where to put each attribute based on family config!`,
          inputSchema: {
            type: 'object',
            properties: {
              sku: { type: 'string', description: 'Unique product identifier' },
              family: { type: 'string', description: 'Family code' },
              locale: { type: 'string', description: 'Locale for locale-specific values (default: en_US)' },
              channel: { type: 'string', description: 'Channel for channel-specific values (default: default)' },
              values: { type: 'object', description: 'Flat object with ALL attribute values - will be auto-structured' },
              categories: { type: 'array', items: { type: 'string' }, description: 'Category codes' },
              validate_only: { type: 'boolean', description: 'If true, only validates without creating' },
            },
            required: ['sku', 'family', 'values'],
          },
        },
        {
          name: 'unopim_upload_product_media',
          description: `Upload an image or file to a product attribute AND automatically link it to the product.

This is a COMPLETE workflow that:
1. Uploads the file to UnoPim storage
2. Fetches attribute metadata to determine correct scope (common/locale_specific/channel_specific/channel_locale_specific)
3. Updates the product to reference the uploaded file in the correct value structure
4. Returns success with the filePath

After calling this tool, the image will be IMMEDIATELY VISIBLE on the product in UnoPim UI.

EXAMPLE - Upload from URL:
{
  "sku": "PROD001",
  "attribute": "image",
  "file_url": "https://example.com/image.jpg"
}

EXAMPLE - Upload from base64:
{
  "sku": "PROD001",
  "attribute": "image",
  "file_base64": "iVBORw0KGgo...",
  "filename": "product-image.jpg"
}

NOTES:
- The product must exist before uploading media
- The attribute must be an image/file type attribute in the product's family
- Provide EITHER file_url OR file_base64, not both
- The tool automatically determines the correct value scope based on attribute settings
- No need to manually update product values after upload - it's done automatically`,
          inputSchema: {
            type: 'object',
            properties: {
              sku: { type: 'string', description: 'The product SKU to attach media to' },
              attribute: { type: 'string', description: 'The attribute code (e.g., "image")' },
              file_url: { type: 'string', description: 'URL to fetch the file from' },
              file_base64: { type: 'string', description: 'Base64-encoded file content' },
              filename: { type: 'string', description: 'Filename (required for base64, optional for URL)' },
            },
            required: ['sku', 'attribute'],
          },
        },
        {
          name: 'unopim_upload_category_media',
          description: `Upload an image or file to a category field.

EXAMPLE:
{
  "code": "electronics",
  "category_field": "image",
  "file_url": "https://example.com/category-image.jpg"
}

NOTES:
- The category must exist before uploading media
- category_field must be a file/image type field`,
          inputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'The category code' },
              category_field: { type: 'string', description: 'The category field code (e.g., "image")' },
              file_url: { type: 'string', description: 'URL to fetch the file from' },
              file_base64: { type: 'string', description: 'Base64-encoded file content' },
              filename: { type: 'string', description: 'Filename (required for base64, optional for URL)' },
            },
            required: ['code', 'category_field'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'unopim_get_schema': {
            const input = GetSchemaInputSchema.parse(args);
            const result = await getSchema(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_get_attributes': {
            const input = GetAttributesInputSchema.parse(args);
            const result = await getAttributes(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_get_families': {
            const input = GetFamiliesInputSchema.parse(args);
            const result = await getFamilies(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_create_attribute': {
            const input = CreateAttributeInputSchema.parse(args);
            const result = await createAttribute(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_create_attribute_options': {
            const input = CreateAttributeOptionsInputSchema.parse(args);
            const result = await createAttributeOptions(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_get_attribute_options': {
            const input = GetAttributeOptionsInputSchema.parse(args);
            const result = await getAttributeOptions(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_get_attribute_groups': {
            const input = GetAttributeGroupsInputSchema.parse(args);
            const result = await getAttributeGroups(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_create_attribute_group': {
            const input = CreateAttributeGroupInputSchema.parse(args);
            const result = await createAttributeGroup(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_create_family': {
            const input = CreateFamilyInputSchema.parse(args);
            const result = await createFamily(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_update_family': {
            const input = UpdateFamilyInputSchema.parse(args);
            const result = await updateFamily(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_get_categories': {
            const input = GetCategoriesInputSchema.parse(args);
            const result = await getCategories(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_create_category': {
            const input = CreateCategoryInputSchema.parse(args);
            const result = await createCategory(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_create_product': {
            const input = CreateProductInputSchema.parse(args);
            const result = await createProduct(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_create_configurable_product': {
            const input = CreateConfigurableProductInputSchema.parse(args);
            const result = await createConfigurableProduct(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_add_variant': {
            // Add variant to existing configurable product
            const { parent, family, sku, values, variant_attributes } = args as {
              parent: string;
              family: string;
              sku: string;
              values: Record<string, unknown>;
              variant_attributes: Record<string, string>;
            };
            
            // Ensure SKU is in values.common
            const variantValues = { ...values };
            if (!variantValues.common) {
              variantValues.common = {};
            }
            (variantValues.common as Record<string, unknown>)['sku'] = sku;

            const variantData = {
              parent: parent,
              family: family,
              additional: null,
              values: variantValues,
              variant: {
                attributes: variant_attributes
              }
            };

            const response = await this.client.post<{ success?: boolean; message?: string; data?: unknown }>(
              '/api/v1/rest/products',
              variantData
            );

            return { content: [{ type: 'text', text: JSON.stringify({
              success: true,
              message: response.message || 'Variant created successfully',
              sku: sku,
              parent: parent,
              variant_attributes: variant_attributes
            }, null, 2) }] };
          }
          case 'unopim_update_configurable_product': {
            // Update configurable product
            const { sku, values, super_attributes, variants } = args as {
              sku: string;
              values: Record<string, unknown>;
              super_attributes?: string[];
              variants?: Array<{ sku: string; attributes: Record<string, string> }>;
            };
            
            // Ensure SKU is in values.common
            const updateValues = { ...values };
            if (!updateValues.common) {
              updateValues.common = {};
            }
            (updateValues.common as Record<string, unknown>)['sku'] = sku;

            const updateData: Record<string, unknown> = {
              parent: null,
              additional: null,
              values: updateValues,
            };

            if (super_attributes) {
              updateData.super_attributes = super_attributes;
            }
            if (variants) {
              updateData.variants = variants;
            }

            // Use PUT to /api/v1/rest/configrable-products/{sku} (note: typo in API)
            const response = await this.client.put<{ success?: boolean; message?: string; data?: unknown }>(
              `/api/v1/rest/configrable-products/${encodeURIComponent(sku)}`,
              updateData
            );

            return { content: [{ type: 'text', text: JSON.stringify({
              success: true,
              message: response.message || 'Configurable product updated successfully',
              sku: sku
            }, null, 2) }] };
          }
          case 'unopim_bulk_create_products': {
            const input = BulkCreateProductsInputSchema.parse(args);
            const result = await bulkCreateProducts(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_get_products': {
            const input = GetProductsInputSchema.parse(args);
            const result = await getProducts(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_get_product': {
            const input = GetProductInputSchema.parse(args);
            const result = await getProduct(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_update_product': {
            const input = UpdateProductInputSchema.parse(args);
            const result = await updateProduct(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_upsert_product': {
            const input = UpsertProductInputSchema.parse(args);
            const result = await upsertProduct(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_get_family_schema': {
            const input = GetFamilySchemaInputSchema.parse(args);
            const result = await getFamilySchema(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_smart_create_product': {
            const input = SmartCreateProductInputSchema.parse(args);
            const result = await smartCreateProduct(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_upload_product_media': {
            const input = UploadProductMediaInputSchema.parse(args);
            const result = await uploadProductMedia(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'unopim_upload_category_media': {
            const input = UploadCategoryMediaInputSchema.parse(args);
            const result = await uploadCategoryMedia(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        // Log detailed error for debugging
        console.error(`\n❌ Tool '${name}' failed:`);
        console.error(`   Error: ${error}`);
        
        if (error instanceof McpError) {
          throw error;
        }
        
        // Check for UnoPimApiError with details
        if (error instanceof Error && 'details' in error) {
          const apiError = error as Error & { details?: unknown; code?: string; statusCode?: number };
          const details = apiError.details;
          console.error(`   API Details:`, JSON.stringify(details, null, 2));
          
          // Format detailed error message
          let detailMessage = '';
          if (details && typeof details === 'object') {
            const d = details as Record<string, unknown>;
            if (d.message) {
              detailMessage = String(d.message);
            }
            if (d.errors && typeof d.errors === 'object') {
              const errorEntries = Object.entries(d.errors as Record<string, unknown>);
              const errorMessages = errorEntries.map(([field, msgs]) => {
                const msgArr = Array.isArray(msgs) ? msgs : [msgs];
                return `${field}: ${msgArr.join(', ')}`;
              });
              detailMessage += (detailMessage ? ' - ' : '') + errorMessages.join('; ');
            }
          }
          
          throw new McpError(
            ErrorCode.InternalError,
            `API Error (${apiError.code || 'unknown'}): ${apiError.message}${detailMessage ? ` - ${detailMessage}` : ''}`
          );
        }
        
        if (error instanceof Error && error.name === 'ZodError') {
          throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private setupHttpServer() {
    this.httpServer = http.createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Health endpoint - no auth required
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', version: '1.0.0' }));
        return;
      }

      // OAuth 2.0 Authorization Server Metadata (RFC 8414)
      // Return empty/minimal response indicating no auth required
      if (req.url === '/.well-known/oauth-authorization-server' ||
          req.url?.startsWith('/.well-known/oauth-authorization-server/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          issuer: `http://localhost:${this.port}`,
          authorization_endpoint: `http://localhost:${this.port}/authorize`,
          token_endpoint: `http://localhost:${this.port}/token`,
          registration_endpoint: `http://localhost:${this.port}/register`,
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code'],
          code_challenge_methods_supported: ['S256']
        }));
        return;
      }

      // OAuth 2.0 Dynamic Client Registration (RFC 7591)
      // Accept registration but we don't actually need auth
      if (req.url === '/register' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const registration = JSON.parse(body || '{}');
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              client_id: 'unopim-mcp-client',
              client_secret: 'not-required',
              client_id_issued_at: Math.floor(Date.now() / 1000),
              client_secret_expires_at: 0,
              redirect_uris: registration.redirect_uris || [],
              token_endpoint_auth_method: 'none',
              grant_types: ['authorization_code'],
              response_types: ['code'],
              client_name: registration.client_name || 'MCP Client'
            }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_request' }));
          }
        });
        return;
      }

      // OAuth 2.0 Protected Resource Metadata (RFC 9728)
      // Claude Desktop checks this endpoint to discover authentication requirements
      if (req.url === '/.well-known/oauth-protected-resource' || 
          req.url?.startsWith('/.well-known/oauth-protected-resource/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          resource: `http://localhost:${this.port}`,
          // No authorization servers = no auth required
          bearer_methods_supported: ['header'],
          resource_documentation: 'https://github.com/picopublish/unopim-mcp'
        }));
        return;
      }

      // Streamable HTTP endpoint (modern MCP transport) - with API key auth
      if (req.url === '/mcp' && (req.method === 'POST' || req.method === 'GET' || req.method === 'DELETE')) {
        // API Key validation for /mcp endpoint
        if (this.apiKey) {
          const authHeader = req.headers['authorization'];
          const apiKeyHeader = req.headers['x-api-key'];
          
          let providedKey: string | undefined;
          
          // Check Authorization: Bearer <key> or Authorization: ApiKey <key>
          if (authHeader) {
            if (authHeader.startsWith('Bearer ')) {
              providedKey = authHeader.slice(7);
            } else if (authHeader.toLowerCase().startsWith('apikey ')) {
              providedKey = authHeader.slice(7);
            }
          }
          
          // Check X-API-Key header
          if (!providedKey && apiKeyHeader) {
            providedKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
          }
          
          if (providedKey !== this.apiKey) {
            console.log(`🔒 Auth failed on /mcp - provided: ${providedKey ? '***' + providedKey.slice(-4) : 'none'}`);
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              error: 'Unauthorized', 
              message: 'Invalid or missing API key. Use Authorization: Bearer <key> or X-API-Key header.' 
            }));
            return;
          }
          console.log('🔓 Auth successful on /mcp');
        }

        console.log(`🔄 Streamable HTTP request: ${req.method} /mcp`);
        try {
          // Check for existing session
          const sessionId = req.headers['mcp-session-id'] as string | undefined;
          let transport: StreamableHTTPServerTransport;
          
          if (sessionId && this.streamableTransports.has(sessionId)) {
            // Reuse existing transport for this session
            transport = this.streamableTransports.get(sessionId)!;
            console.log(`🔄 Reusing session: ${sessionId}`);
          } else {
            // Create new transport for new session
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => crypto.randomUUID(),
            });
            
            // Connect transport to server
            await this.server.connect(transport);
            
            // Store transport for future requests (session will be set after first response)
            transport.onclose = () => {
              const sid = (transport as any).sessionId;
              if (sid) {
                this.streamableTransports.delete(sid);
                console.log(`🔄 Session closed: ${sid}`);
              }
            };
          }
          
          // Handle the request
          await transport.handleRequest(req, res);
          
          // Store transport by session ID after handling (session ID is set in response)
          const newSessionId = (transport as any).sessionId;
          if (newSessionId && !this.streamableTransports.has(newSessionId)) {
            this.streamableTransports.set(newSessionId, transport);
            console.log(`🔄 New session created: ${newSessionId}`);
          }
        } catch (error) {
          console.error('❌ Streamable HTTP error:', error);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        }
        return;
      }

      // SSE endpoint (legacy transport) - no auth required
      if (req.url === '/sse' && req.method === 'GET') {
        console.log('📡 New SSE connection request');
        const transport = new SSEServerTransport('/message', res);
        const sessionId = transport.sessionId;
        this.transports.set(sessionId, transport);
        
        // Clean up on disconnect
        res.on('close', () => {
          console.log(`📡 SSE connection closed: ${sessionId}`);
          this.transports.delete(sessionId);
        });
        
        await this.server.connect(transport);
        console.log(`📡 SSE connection established: ${sessionId}`);
        return;
      }

      if (req.url?.startsWith('/message') && req.method === 'POST') {
        // Extract session ID from query string
        const url = new URL(req.url, `http://localhost:${this.port}`);
        const sessionId = url.searchParams.get('sessionId');
        
        if (!sessionId) {
          console.error('❌ POST /message missing sessionId');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing sessionId parameter' }));
          return;
        }
        
        const transport = this.transports.get(sessionId);
        if (!transport) {
          console.error(`❌ POST /message unknown session: ${sessionId}`);
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Session not found' }));
          return;
        }
        
        // Handle the message through the transport
        await transport.handlePostMessage(req, res);
        return;
      }

      // Also handle POST to /sse (some clients send it there)
      if (req.url?.startsWith('/sse') && req.method === 'POST') {
        const url = new URL(req.url, `http://localhost:${this.port}`);
        const sessionId = url.searchParams.get('sessionId');
        
        if (sessionId) {
          const transport = this.transports.get(sessionId);
          if (transport) {
            await transport.handlePostMessage(req, res);
            return;
          }
        }
        
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });
  }

  async start() {
    return new Promise<void>((resolve) => {
      this.httpServer.listen(this.port, () => {
        console.log(`╔═══════════════════════════════════════════════════════════╗`);
        console.log(`║                                                           ║`);
        console.log(`║      UnoPim MCP Server (HTTP Mode) - RUNNING             ║`);
        console.log(`║                                                           ║`);
        console.log(`╚═══════════════════════════════════════════════════════════╝`);
        console.log();
        console.log(`🌐 Server listening on: http://localhost:${this.port}`);
        console.log(`🔄 Streamable HTTP: http://localhost:${this.port}/mcp`);
        console.log(`📡 SSE endpoint: http://localhost:${this.port}/sse`);
        console.log(`💚 Health check: http://localhost:${this.port}/health`);
        if (this.apiKey) {
          console.log(`🔐 API Key auth: ENABLED (use Authorization: Bearer <key> or X-API-Key header)`);
        } else {
          console.log(`🔓 API Key auth: DISABLED (set MCP_API_KEY to enable)`);
        }
        console.log();
        console.log(`To expose via ngrok:`);
        console.log(`  ngrok http ${this.port}`);
        console.log();
        resolve();
      });
    });
  }
}

// ============================================================================
// Start Server
// ============================================================================

const port = parseInt(process.env.PORT || '3000', 10);
const server = new UnoPimHttpServer(port);

server.start().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
